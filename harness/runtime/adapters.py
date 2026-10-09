"""Steps 2 and 6. Chat functions for APIs that are not /chat/completions, with the same contract as
loop.openai_chat: take the loop's messages (OpenAI chat shape) and tools (OpenAI function shape), return
{"message": assistant message in OpenAI shape, "usage": ..., "model": ...}.

  anthropic_chat   Anthropic Messages API (/v1/messages): system as a parameter, tool_use and
                   tool_result blocks, thinking blocks with signatures.
  responses_chat   OpenAI Responses API (/v1/responses), which GPT-6 tool calling needs: function_call
                   and function_call_output items, reasoning items passed back with tool outputs.

Rule 1 of the loop still holds: each provider's raw output is kept on the assistant message
(_raw_content for Anthropic, _items for Responses) and sent back unchanged on the next call, so thinking
signatures and reasoning items survive. The translations follow the vendors' API documentation; they
were not executed against the live APIs from the workspace that wrote them, so run probe/probe.py
through them before trusting a result (the unit tests check the translation only).
"""
from __future__ import annotations

import json

from loop import post_json


def to_anthropic(messages: list[dict], tools: list[dict]) -> tuple[str, list[dict], list[dict]]:
    """(system, messages, tools) in Anthropic shape. Consecutive tool results join one user turn."""
    system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
    out: list[dict] = []
    for m in messages:
        if m["role"] == "system":
            continue
        if m["role"] == "tool":
            block = {"type": "tool_result", "tool_use_id": m["tool_call_id"], "content": m["content"]}
            if out and out[-1]["role"] == "user" and isinstance(out[-1]["content"], list) and out[-1].get("_results"):
                out[-1]["content"].append(block)
            else:
                out.append({"role": "user", "content": [block], "_results": True})
            continue
        if m["role"] == "assistant":
            if m.get("_raw_content") is not None:
                out.append({"role": "assistant", "content": m["_raw_content"]})
                continue
            blocks = [{"type": "text", "text": m["content"]}] if m.get("content") else []
            for tc in m.get("tool_calls") or []:
                args = tc["function"]["arguments"]
                blocks.append({"type": "tool_use", "id": tc["id"], "name": tc["function"]["name"],
                               "input": json.loads(args) if isinstance(args, str) else args})
            out.append({"role": "assistant", "content": blocks})
            continue
        out.append({"role": "user", "content": m["content"]})
    for m in out:
        m.pop("_results", None)
    at = [{"name": t["function"]["name"], "description": t["function"]["description"],
           "input_schema": t["function"]["parameters"]} for t in tools]
    return system, out, at


def from_anthropic(data: dict) -> dict:
    blocks = data.get("content") or []
    text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
    calls = [{"id": b["id"], "type": "function", "function": {"name": b["name"], "arguments": json.dumps(b.get("input") or {})}}
             for b in blocks if b.get("type") == "tool_use"]
    msg = {"role": "assistant", "content": text, "_raw_content": blocks}
    if calls:
        msg["tool_calls"] = calls
    return msg


def anthropic_chat(model: str, *, api_key: str, base_url: str = "https://api.anthropic.com", max_tokens: int = 4096,
                   extra: dict | None = None, timeout: float = 300.0):
    """extra can carry thinking={"type": "adaptive"} and output_config={"effort": "medium"}."""
    def chat(messages: list[dict], tools: list[dict]) -> dict:
        system, msgs, at = to_anthropic(messages, tools)
        body = {"model": model, "max_tokens": max_tokens, "system": system, "messages": msgs, **(extra or {})}
        if at:
            body["tools"] = at
        data = post_json(base_url.rstrip("/") + "/v1/messages", body,
                         {"x-api-key": api_key, "anthropic-version": "2023-06-01"}, timeout)
        return {"message": from_anthropic(data), "usage": data.get("usage") or {}, "model": data.get("model", "")}
    return chat


def to_responses(messages: list[dict], tools: list[dict]) -> tuple[list[dict], list[dict]]:
    """(input items, tools) in Responses shape. The system prompt becomes a developer message."""
    items: list[dict] = []
    for m in messages:
        if m["role"] == "system":
            items.append({"role": "developer", "content": m["content"]})
        elif m["role"] == "user":
            items.append({"role": "user", "content": m["content"]})
        elif m["role"] == "tool":
            items.append({"type": "function_call_output", "call_id": m["tool_call_id"], "output": m["content"]})
        elif m.get("_items") is not None:
            items.extend(m["_items"])                     # reasoning, function_call and message items, unchanged
        else:
            if m.get("content"):
                items.append({"role": "assistant", "content": m["content"]})
            for tc in m.get("tool_calls") or []:
                items.append({"type": "function_call", "call_id": tc["id"], "name": tc["function"]["name"],
                              "arguments": tc["function"]["arguments"]})
    rt = [{"type": "function", "name": t["function"]["name"], "description": t["function"]["description"],
           "parameters": t["function"]["parameters"]} for t in tools]
    return items, rt


def from_responses(data: dict) -> dict:
    out = data.get("output") or []
    text = "".join(c.get("text", "") for it in out if it.get("type") == "message"
                   for c in it.get("content") or [] if c.get("type") in ("output_text", "text"))
    calls = [{"id": it["call_id"], "type": "function", "function": {"name": it["name"], "arguments": it.get("arguments") or "{}"}}
             for it in out if it.get("type") == "function_call"]
    msg = {"role": "assistant", "content": text, "_items": out}
    if calls:
        msg["tool_calls"] = calls
    return msg


def responses_chat(base_url: str, model: str, *, api_key: str | None = None, extra: dict | None = None, timeout: float = 300.0):
    """extra can carry reasoning={"effort": "medium"} and text={"verbosity": "low"}. store is off, so
    reasoning items travel in the replayed output; pass include=["reasoning.encrypted_content"] if your
    account needs encrypted reasoning for that."""
    def chat(messages: list[dict], tools: list[dict]) -> dict:
        items, rt = to_responses(messages, tools)
        body = {"model": model, "input": items, "store": False, **(extra or {})}
        if rt:
            body["tools"] = rt
        data = post_json(base_url.rstrip("/") + "/responses", body, {"Authorization": f"Bearer {api_key}"} if api_key else {}, timeout)
        return {"message": from_responses(data), "usage": data.get("usage") or {}, "model": data.get("model", "")}
    return chat
