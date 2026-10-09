"""Step 2. Probe what a model endpoint can actually do, before you design the harness around it.

  python3 harness/probe/probe.py --base-url http://localhost:11434/v1 --model qwen3.6:35b-a3b
  python3 harness/probe/probe.py --base-url https://api.example.com/v1 --model some-model --api-key-env MY_KEY
  python3 harness/probe/probe.py --api anthropic --model <model id> --api-key-env ANTHROPIC_API_KEY
  python3 harness/probe/probe.py --api responses --base-url https://api.openai.com/v1 --model <model id> --api-key-env OPENAI_API_KEY

Six probes, each a pass, a fail or a note, written to harness/probe/out/<model>.json:
  chat        a plain answer comes back
  tool_call   a tool call with valid JSON arguments for a declared tool
  parallel    two independent calls in one assistant message (or one at a time)
  round_trip  the model uses a tool result in its answer
  replay      which extra fields the assistant message carries (reasoning_content, reasoning, thinking)
              that the loop must send back unchanged
  context     a code word placed at the START of a long system prompt is still recalled at each size;
              a miss means the server truncated the prompt (on Ollama, raise num_ctx / OLLAMA_CONTEXT_LENGTH)
The probe never changes anything; it only reads replies. Facts it finds go into families.yml by hand.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "runtime"))
import adapters  # noqa: E402
import loop  # noqa: E402

WEATHER = [{"type": "function", "function": {
    "name": "get_weather", "description": "Current temperature in Celsius for one city.",
    "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}}}]
KNOWN = {"role", "content", "tool_calls", "refusal", "annotations", "audio", "function_call", "name"}
# _raw_content (Anthropic blocks) and _items (Responses items) are the adapters' copies of the provider's
# raw output; they show up as extra fields and the loop already replays them.


def _calls(msg: dict) -> list[dict]:
    return msg.get("tool_calls") or []


def _valid(tc: dict) -> bool:
    try:
        args = tc["function"]["arguments"]
        args = json.loads(args) if isinstance(args, str) else args
        return tc["function"]["name"] == "get_weather" and isinstance(args, dict) and bool(args.get("city"))
    except (KeyError, TypeError, ValueError):
        return False


def probe(chat, sizes: tuple[int, ...] = (2000, 6000, 12000)) -> dict:
    r: dict = {}
    m = chat([{"role": "user", "content": "Reply with the single word: ready"}], [])["message"]
    r["chat"] = {"ok": "ready" in (m.get("content") or "").lower(), "reply": (m.get("content") or "")[:80]}

    q = [{"role": "user", "content": "What is the temperature in Paris right now? Use the tool."}]
    m = chat(q, WEATHER)["message"]
    tcs = _calls(m)
    r["tool_call"] = {"ok": bool(tcs) and all(_valid(t) for t in tcs), "calls": len(tcs)}
    r["replay"] = {"extra_fields": sorted(k for k in m if k not in KNOWN and m.get(k))}

    if tcs:
        res = [{"role": "tool", "tool_call_id": t.get("id", ""), "name": "get_weather", "content": json.dumps({"celsius": 17.5})}
               for t in tcs]
        m2 = chat(q + [m] + res, WEATHER)["message"]
        r["round_trip"] = {"ok": "17.5" in (m2.get("content") or ""), "reply": (m2.get("content") or "")[:80]}
    else:
        r["round_trip"] = {"ok": False, "reply": "no tool call to answer"}

    m = chat([{"role": "user", "content": "What is the temperature in Paris and in Rome? Use the tool for each city."}], WEATHER)["message"]
    n = len(_calls(m))
    r["parallel"] = {"ok": n >= 2, "calls_in_first_message": n,
                     "note": "parallel calls supported" if n >= 2 else "one call per message: keep the loop serial"}

    r["context"] = {}
    for size in sizes:
        filler = " ".join(f"line {i}: the archive holds routine records." for i in range(size // 9))
        system = "The code word is MARIGOLD-47. Remember it.\n" + filler
        m = chat([{"role": "system", "content": system}, {"role": "user", "content": "What is the code word? Reply with it only."}], [])["message"]
        r["context"][str(size)] = "MARIGOLD-47" in (m.get("content") or "").upper()
    lost = [s for s, ok in r["context"].items() if not ok]
    r["advice"] = advice(r, lost)
    return r


def advice(r: dict, lost: list[str]) -> list[str]:
    out = []
    if not r["tool_call"]["ok"]:
        out.append("No valid native tool call: check the model's chat template supports tools before writing any prompt-level tool format.")
    if not r["parallel"]["ok"]:
        out.append("No parallel calls: keep tools independent of call order and expect one call per step (raise max_steps).")
    if r["replay"]["extra_fields"]:
        out.append(f"Assistant messages carry {r['replay']['extra_fields']}: the loop must send them back unchanged.")
    if lost:
        out.append(f"Code word lost at {', '.join(lost)} tokens: the server truncates the prompt. Raise the context length, or keep prompt plus tools well under the smallest failing size.")
    if not r["round_trip"]["ok"]:
        out.append("The tool result was not used in the answer: check the tool message format (role tool, tool_call_id) for this server.")
    return out or ["No blocking issue found by these probes."]


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", choices=["chat", "responses", "anthropic"], default="chat")
    ap.add_argument("--base-url")
    ap.add_argument("--model", required=True)
    ap.add_argument("--api-key-env", help="name of an environment variable holding the key; never pass a key itself")
    a = ap.parse_args(argv)
    key = os.environ.get(a.api_key_env) if a.api_key_env else None
    if a.api == "anthropic":
        if not key:
            raise SystemExit("--api anthropic needs --api-key-env naming a variable that holds the key")
        chat = adapters.anthropic_chat(a.model, api_key=key, base_url=a.base_url or "https://api.anthropic.com")
    elif not a.base_url:
        raise SystemExit("--base-url is required for --api chat and --api responses")
    elif a.api == "responses":
        chat = adapters.responses_chat(a.base_url, a.model, api_key=key)
    else:
        chat = loop.openai_chat(a.base_url, a.model, api_key=key)
    r = probe(chat)
    out = HERE / "out"
    out.mkdir(exist_ok=True)
    (out / f"{a.model.replace(':', '_').replace('/', '_')}.json").write_text(json.dumps(r, indent=1))
    print(json.dumps(r, indent=1))
    return 0 if r["tool_call"]["ok"] and r["chat"]["ok"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
