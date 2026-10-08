"""POST /api/tutor  -- the tutor chat.

Order of attempts:
  1. the local build (LOCAL_AGENT_URL, an OpenAI-compatible endpoint behind a key)
  2. a cloud model (CLOUD_BASE_URL, any OpenAI-compatible provider)

Standard library only, so the function has no dependencies to install.

Environment
  LOCAL_AGENT_URL     https://<your public gateway host>       (no trailing path)
  LOCAL_AGENT_KEY     a key issued for this site, chat scope only, no tools
  LOCAL_MODEL         optional model name; omitted lets the local router choose
  LOCAL_TIMEOUT       seconds to wait for the local build (default 40)
  CLOUD_BASE_URL      e.g. https://api.openai.com/v1 or a gateway's /v1 URL
  CLOUD_API_KEY       key for that provider
  CLOUD_MODEL         model name at that provider
  CLOUD_TIMEOUT       seconds (default 40)
  TUTOR_RATE_PER_MIN  requests per minute per visitor (default 6)
  TUTOR_DAILY_CAP     total requests per day across all visitors (default 400)
  TUTOR_MAX_TOKENS    answer length cap (default 700)
  UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
                      optional. Without them, limits are kept in memory per
                      function instance, which is best effort only.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler

SYSTEM = """You are a tutor for engineers learning to build enterprise agent systems.
The learner is studying a curriculum built from a real local build. Lesson material is
given below as CONTEXT. Use it as your primary source and say so when you go beyond it.

How to teach:
- Answer the question asked, in plain declarative sentences. Be specific and brief.
- Always connect a part to its reason: what it does, why it exists, what must exist
  before it and why, and what breaks without it.
- When asked to quiz, ask one question at a time and wait for the answer. Then say what
  was right, what was missing, and give a model answer.
- When asked how to build something on another platform, map each part to who runs it
  there, and name what the learner still owns.
- If you are not sure a vendor feature exists or what it is called today, say so and
  tell the learner to confirm in current vendor documentation.
- Do not invent file names, numbers, or results that are not in the context.
- Keep answers under 250 words unless the learner asks for more."""

MAX_MESSAGES = 12
MAX_CHARS = 2000
MAX_CONTEXT = 9000

_mem: dict[str, tuple[int, float]] = {}


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def _post_json(url: str, body: dict, headers: dict, timeout: float) -> dict:
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST",
                                 headers={"Content-Type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def _count(key: str, window: int) -> int:
    """Increment a counter that expires after `window` seconds and return its value."""
    url = os.environ.get("UPSTASH_REDIS_REST_URL", "").rstrip("/")
    token = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")
    if url and token:
        try:
            out = _post_json(f"{url}/pipeline",
                             [["INCR", key], ["EXPIRE", key, str(window), "NX"]],  # type: ignore[arg-type]
                             {"Authorization": f"Bearer {token}"}, 3)
            return int(out[0]["result"])
        except Exception:
            pass  # fall through to memory
    now = time.time()
    n, start = _mem.get(key, (0, now))
    if now - start > window:
        n, start = 0, now
    _mem[key] = (n + 1, start)
    if len(_mem) > 5000:
        for k in [k for k, (_, s) in _mem.items() if now - s > 86400]:
            _mem.pop(k, None)
    return n + 1


def _limited(ip: str) -> str | None:
    per_min = _env_int("TUTOR_RATE_PER_MIN", 6)
    daily = _env_int("TUTOR_DAILY_CAP", 400)
    if _count(f"tutor:ip:{ip}:{int(time.time() // 60)}", 60) > per_min:
        return "Too many questions in a minute. Wait a moment and ask again."
    if _count(f"tutor:day:{time.strftime('%Y%m%d', time.gmtime())}", 86400) > daily:
        return "The tutor has reached its daily limit. It resets at midnight UTC."
    return None


def _clean(body: dict) -> tuple[list[dict], str]:
    msgs = []
    for m in (body.get("messages") or [])[-MAX_MESSAGES:]:
        role = m.get("role")
        content = m.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            msgs.append({"role": role, "content": content[:MAX_CHARS]})
    context = body.get("context") if isinstance(body.get("context"), str) else ""
    return msgs, context[:MAX_CONTEXT]


def _chat(base: str, key: str, model: str, messages: list[dict], timeout: float) -> str:
    payload: dict = {"messages": messages, "stream": False,
                     "max_tokens": _env_int("TUTOR_MAX_TOKENS", 700), "temperature": 0.3}
    if model:
        payload["model"] = model
    out = _post_json(f"{base.rstrip('/')}/chat/completions", payload,
                     {"Authorization": f"Bearer {key}"}, timeout)
    text = (out.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    if not text.strip():
        raise ValueError("empty completion")
    return text.strip()


def answer(messages: list[dict], context: str) -> tuple[str, str]:
    """Returns (reply, via). Raises RuntimeError when no backend is usable."""
    system = SYSTEM + ("\n\nCONTEXT\n" + context if context else "")
    full = [{"role": "system", "content": system}] + messages
    tried = []

    local = os.environ.get("LOCAL_AGENT_URL", "").rstrip("/")
    if local.startswith(("https://", "http://127.0.0.1", "http://localhost")):
        try:
            base = local if local.endswith("/v1") else local + "/v1"
            return _chat(base, os.environ.get("LOCAL_AGENT_KEY", ""),
                         os.environ.get("LOCAL_MODEL", ""), full,
                         _env_int("LOCAL_TIMEOUT", 40)), "local"
        except Exception as e:  # unreachable, asleep, timed out, or refused
            tried.append(f"local: {type(e).__name__}")

    cloud = os.environ.get("CLOUD_BASE_URL", "").rstrip("/")
    if cloud and os.environ.get("CLOUD_API_KEY") and os.environ.get("CLOUD_MODEL"):
        try:
            return _chat(cloud, os.environ["CLOUD_API_KEY"], os.environ["CLOUD_MODEL"],
                         full, _env_int("CLOUD_TIMEOUT", 40)), "cloud"
        except Exception as e:
            tried.append(f"cloud: {type(e).__name__}")

    if not tried:
        raise RuntimeError("The tutor is not connected to a model yet. The lessons, map, and "
                           "self-checks work without it.")
    raise RuntimeError("No model answered. The local build may be asleep and no cloud fallback "
                       "is configured or it failed. Try again in a minute.")


def _send(h: BaseHTTPRequestHandler, status: int, obj: dict) -> None:
    data = json.dumps(obj).encode()
    h.send_response(status)
    h.send_header("Content-Type", "application/json")
    h.send_header("Cache-Control", "no-store")
    h.send_header("Content-Length", str(len(data)))
    h.end_headers()
    h.wfile.write(data)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        origin = self.headers.get("Origin")
        host = self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or ""
        if origin and host and origin.split("://", 1)[-1] != host:
            return _send(self, 403, {"error": "Cross-site requests are not accepted."})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length > 40000:
                return _send(self, 413, {"error": "That message is too long."})
            body = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            return _send(self, 400, {"error": "The request was not valid JSON."})

        ip = (self.headers.get("X-Forwarded-For") or self.client_address[0]).split(",")[0].strip()
        blocked = _limited(ip)
        if blocked:
            return _send(self, 429, {"error": blocked})

        messages, context = _clean(body if isinstance(body, dict) else {})
        if not messages or messages[-1]["role"] != "user":
            return _send(self, 400, {"error": "Send at least one question."})
        try:
            reply, via = answer(messages, context)
        except RuntimeError as e:
            return _send(self, 503, {"error": str(e)})
        return _send(self, 200, {"reply": reply, "via": via})

    def do_GET(self):  # noqa: N802
        _send(self, 405, {"error": "Use POST."})

    def log_message(self, *args):  # keep visitor questions out of logs
        return
