"""One way to call a model, used by every lab.

Two backends behind the same function:

  real   set LAB_BASE_URL (and LAB_MODEL, LAB_API_KEY if needed) to any
         OpenAI-compatible endpoint: Ollama, vLLM, a gateway, a cloud provider.
           export LAB_BASE_URL=http://127.0.0.1:11434/v1
           export LAB_MODEL=<your model tag>

  fake   the default. A deterministic stand-in that follows simple rules, so
         every lab runs offline and prints the same output every time. It is a
         test double. It shows the plumbing, and it has no intelligence.

Both return the OpenAI chat-completions response shape, so code written
against chat() does not change when you switch.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import urllib.request
from typing import Callable, Optional

Policy = Callable[[list, Optional[list]], dict]


# region: chat
def chat(messages: list, tools: Optional[list] = None, model: Optional[str] = None,
         max_tokens: int = 512, policy: Optional[Policy] = None) -> dict:
    """Send messages, get an OpenAI-shaped completion back."""
    base = os.environ.get("LAB_BASE_URL", "").rstrip("/")
    if not base:
        message = (policy or default_policy)(messages, tools)
        return _wrap(message, messages)
    body = {"model": model or os.environ.get("LAB_MODEL", ""), "messages": messages,
            "max_tokens": max_tokens, "stream": False}
    if tools:
        body["tools"] = tools
    req = urllib.request.Request(
        base + "/chat/completions", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json",
                 "Authorization": "Bearer " + os.environ.get("LAB_API_KEY", "none")})
    with urllib.request.urlopen(req, timeout=float(os.environ.get("LAB_TIMEOUT", "180"))) as r:
        return json.loads(r.read())
# endregion


def _wrap(message: dict, messages: list) -> dict:
    prompt = sum(len(str(m.get("content") or "")) for m in messages) // 4
    out = len(str(message.get("content") or "")) // 4 + 8 * len(message.get("tool_calls") or [])
    return {"id": "fake-" + hashlib.sha1(json.dumps(messages, sort_keys=True, default=str).encode()).hexdigest()[:10],
            "object": "chat.completion", "model": "fake",
            "choices": [{"index": 0, "message": message,
                         "finish_reason": "tool_calls" if message.get("tool_calls") else "stop"}],
            "usage": {"prompt_tokens": prompt, "completion_tokens": out, "total_tokens": prompt + out}}


def tool_call(name: str, arguments: dict, call_id: Optional[str] = None) -> dict:
    """Build one tool call in the OpenAI shape."""
    args = json.dumps(arguments, sort_keys=True)
    cid = call_id or "call_" + hashlib.sha1((name + args).encode()).hexdigest()[:8]
    return {"id": cid, "type": "function", "function": {"name": name, "arguments": args}}


def is_harness_note(m: dict) -> bool:
    """Messages the harness injects (corrections, budget notices) start with [harness]."""
    return m.get("role") == "user" and str(m.get("content") or "").startswith("[harness]")


def last_user(messages: list) -> str:
    for m in reversed(messages):
        if m.get("role") == "user" and not is_harness_note(m):
            return str(m.get("content") or "")
    return ""


def tool_results_since_user(messages: list) -> list:
    out = []
    for m in reversed(messages):
        if m.get("role") == "user" and not is_harness_note(m):
            break
        if m.get("role") == "tool":
            out.append(str(m.get("content") or ""))
    return list(reversed(out))


def default_policy(messages: list, tools: Optional[list]) -> dict:
    """The fake model's whole 'mind': call a matching tool once, then report what came back."""
    results = tool_results_since_user(messages)
    question = last_user(messages)
    if results:
        return {"role": "assistant", "content": "From the tool results: " + " | ".join(r[:240] for r in results)}
    if tools:
        words = set(re.findall(r"[a-z]+", question.lower()))
        best, score = tools[0], -1
        for t in tools:
            fn = t["function"]
            overlap = len(words & set(re.findall(r"[a-z]+", (fn["name"] + " " + fn.get("description", "")).lower())))
            if overlap > score:
                best, score = t, overlap
        props = best["function"].get("parameters", {}).get("properties", {})
        args = {k: question for k, v in props.items() if v.get("type") == "string" and "enum" not in v}
        for k, v in props.items():
            if "enum" in v:
                args[k] = v["enum"][0]
        return {"role": "assistant", "content": None, "tool_calls": [tool_call(best["function"]["name"], args)]}
    return {"role": "assistant", "content": "(fake model) You said: " + question[:200]}


# region: embed
EMBED_DIM = 256


def embed(text: str) -> list:
    """Text to a unit vector.

    Real: set LAB_EMBED_URL to an OpenAI-compatible /v1 base and LAB_EMBED_MODEL.
    Fake: hash each word into one of 256 buckets. Texts that share words land
    close together. It has no notion of meaning, which is exactly why the labs
    pair it with keyword search.
    """
    base = os.environ.get("LAB_EMBED_URL", "").rstrip("/")
    if base:
        body = json.dumps({"model": os.environ.get("LAB_EMBED_MODEL", ""), "input": text}).encode()
        req = urllib.request.Request(base + "/embeddings", data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())["data"][0]["embedding"]
    vec = [0.0] * EMBED_DIM
    for w in re.findall(r"[a-z0-9]+", text.lower()):
        if len(w) < 3:
            continue
        h = int(hashlib.md5(w[:6].encode()).hexdigest(), 16)   # crude stemming: first 6 letters
        vec[h % EMBED_DIM] += 1.0 if (h >> 8) % 2 else -1.0
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def cosine(a: list, b: list) -> float:
    return sum(x * y for x, y in zip(a, b))
# endregion
