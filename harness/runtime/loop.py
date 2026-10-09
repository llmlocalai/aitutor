"""Step 6. The agent loop: model call, tool calls through the gate, results back, until a final answer.

Five rules this loop enforces in code, because each one is a failure the corpus prompts warn about:
1. Replay the assistant message unchanged. Reasoning fields (reasoning_content, reasoning, thinking,
   signatures, raw provider blocks) go back with the tool results. DeepSeek returns 400 without them;
   Claude, Gemini, GLM, Kimi and Mistral lose quality or error. Never rebuild the message from parsed parts.
   The one edit: a tool call that arrives without an id gets one, so the tool result can refer to it.
2. Budgets are hard: max_steps model calls, max_tool_calls tool calls. Running out is a stop reason
   the caller sees, not a silent truncation.
3. Malformed arguments return an error result the model can correct, and are counted.
4. The same call with the same arguments a third time returns repeated_call instead of running:
   a loop is detected in code, not hoped against in the prompt.
5. Untrusted fields are wrapped before the model sees them (the executor does this; see evals/world.py).
Two optional checks run on the final message, each at most once per task:
  stopcheck=True  a final that promises work it could do now gets one nudge (step 12)
  verify=True     amounts or ids no tool returned get one correction request (step 13)

`chat(messages, tools)` returns {"message": {...assistant message...}, "usage": {...}, "model": "..."}.
openai_chat() below talks to any OpenAI-compatible /chat/completions endpoint (Ollama, vLLM, llama.cpp,
LM Studio, and hosted APIs that accept that format); runtime/adapters.py adds the Anthropic Messages API
and the OpenAI Responses API. Tests pass a scripted chat function instead.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request

import stopcheck as stopcheck_mod
import verify as verify_mod


def post_json(url: str, body: dict, headers: dict, timeout: float) -> dict:
    """POST and parse JSON. An HTTP error keeps the server's reason, which is often the whole diagnosis."""
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:400]
        raise RuntimeError(f"HTTP {e.code} from {url}: {detail}") from None


def openai_chat(base_url: str, model: str, *, api_key: str | None = None, sampling: dict | None = None,
                extra: dict | None = None, timeout: float = 300.0):
    """A chat function for an OpenAI-compatible /chat/completions endpoint, standard library only."""
    url = base_url.rstrip("/") + "/chat/completions"

    def chat(messages: list[dict], tools: list[dict]) -> dict:
        body = {"model": model, "messages": messages, "stream": False, **(sampling or {}), **(extra or {})}
        if tools:
            body["tools"] = tools
        data = post_json(url, body, {"Authorization": f"Bearer {api_key}"} if api_key else {}, timeout)
        return {"message": data["choices"][0]["message"], "usage": data.get("usage") or {}, "model": data.get("model", "")}
    return chat


def _args(raw) -> tuple[dict | None, str | None]:
    if isinstance(raw, dict):
        return raw, None
    try:
        v = json.loads(raw or "{}")
    except (TypeError, ValueError) as e:
        return None, f"arguments are not valid JSON: {e}"
    return (v, None) if isinstance(v, dict) else (None, "arguments must be a JSON object")


def run(chat, system: str, tools: list[dict], user: str, execute, *, max_steps: int = 12,
        max_tool_calls: int = 20, history: list[dict] | None = None, stopcheck: bool = False,
        verify: bool = False) -> dict:
    """One task. `execute(name, args)` returns (result, decision), usually runtime.gate.guarded(...)."""
    messages = [{"role": "system", "content": system}, *(history or []), {"role": "user", "content": user}]
    calls, seen = [], {}
    usage = {"prompt_tokens": 0, "completion_tokens": 0}
    malformed, steps, t0 = 0, 0, time.time()
    stop, final, served = "max_steps", "", ""
    nudges: list[str] = []
    while steps < max_steps:
        steps += 1
        out = chat(messages, tools)
        served = out.get("model") or served
        msg = dict(out["message"])
        msg.setdefault("role", "assistant")
        for k in usage:
            u = out.get("usage") or {}
            usage[k] += int(u.get(k) or u.get({"prompt_tokens": "input_tokens", "completion_tokens": "output_tokens"}[k]) or 0)
        tcs = msg.get("tool_calls") or []
        for i, tc in enumerate(tcs):
            if not tc.get("id"):
                tc["id"] = f"call_{steps}_{i}"                 # the only edit: a result needs an id to refer to
        messages.append(msg)                                   # rule 1: the raw message, otherwise unchanged
        if not tcs:
            final, stop = (msg.get("content") or "").strip(), "final"
            if stopcheck and "stopcheck" not in nudges and stopcheck_mod.classify(final) == "promise":
                nudges.append("stopcheck")
                messages.append({"role": "user", "content": stopcheck_mod.NUDGE})
                stop = "max_steps"
                continue
            claims = verify_mod.unverified(final, messages) if verify and "verify" not in nudges else []
            if claims:
                nudges.append("verify")
                messages.append({"role": "user", "content": verify_mod.correction(claims)})
                stop = "max_steps"
                continue
            break
        for tc in tcs:
            fn = tc.get("function") or {}
            name = fn.get("name", "")
            args, err = _args(fn.get("arguments"))
            if len(calls) >= max_tool_calls:
                result, decision = {"error": "tool_budget_exhausted"}, "budget"
            elif err:
                malformed += 1
                result, decision = {"error": "invalid_arguments", "detail": err}, "malformed"
            else:
                key = name + json.dumps(args, sort_keys=True)
                seen[key] = seen.get(key, 0) + 1
                if seen[key] >= 3:
                    result, decision = {"error": "repeated_call", "detail": "Same call three times. Use the earlier result or change approach."}, "repeated"
                else:
                    result, decision = execute(name, args)
            calls.append({"name": name, "args": args, "decision": decision,
                          "status": result.get("status") or ("error" if "error" in result else "ok")})
            messages.append({"role": "tool", "tool_call_id": tc["id"], "name": name, "content": json.dumps(result)})
        if len(calls) >= max_tool_calls:
            stop = "max_tool_calls"                            # rule 2: the budget ends the task here
            break
    return {"final": final, "stop": stop, "steps": steps, "calls": calls, "malformed": malformed, "nudges": nudges,
            "usage": usage, "seconds": round(time.time() - t0, 2), "messages": messages, "served_model": served}
