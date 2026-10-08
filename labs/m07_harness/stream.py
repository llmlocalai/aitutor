"""python3 -m labs.m07_harness.stream

Streaming, added last. Two parts:
  1. tool calls arrive in fragments; accumulate them until each call is whole
  2. answer text is held until the guard passes, then released line by line,
     so a rejected draft never reaches the client
Served over real server-sent events and read back by a real HTTP client.
"""
from __future__ import annotations

import asyncio
import json
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from labs.common.scripts import fabricating_policy
from labs.m05_rag.demo import build
from labs.m06_tools.tools import build_registry
from labs.m07_harness.loop import Agent
from labs.m08_skills.loader import Router
from labs.m10_guard.guard import review


# region: deltas
def merge_tool_call_delta(acc: dict, delta: dict) -> None:
    """Fold one streamed tool-call fragment into the call it belongs to, keyed by index."""
    slot = acc.setdefault(delta["index"], {"id": None, "name": "", "arguments": ""})
    slot["id"] = delta.get("id") or slot["id"]
    fn = delta.get("function", {})
    slot["name"] += fn.get("name") or ""
    slot["arguments"] += fn.get("arguments") or ""
# endregion


# region: gate
def sse(obj) -> bytes:
    return f"data: {obj if isinstance(obj, str) else json.dumps(obj)}\n\n".encode()


def chunk(text: str = "", role: str = "") -> dict:
    delta = {"role": role} if role else {"content": text}
    return {"object": "chat.completion.chunk", "choices": [{"index": 0, "delta": delta}]}


def stream_guarded(agent: Agent, messages: list):
    """Yield SSE events. The role chunk goes out at once so the client sees progress.
    Text goes out only after the agent's guard (and its one retry) is finished."""
    yield sse(chunk(role="assistant"))
    result = asyncio.run(agent.run(messages))
    for line in result["answer"].splitlines(keepends=True) or [result["answer"]]:
        yield sse(chunk(line))
    yield sse("[DONE]")
# endregion


def main():
    frags = [{"index": 0, "id": "call_1", "function": {"name": "query_", "arguments": ""}},
             {"index": 0, "function": {"name": "expenses", "arguments": '{"employ'}},
             {"index": 0, "function": {"arguments": 'ee": "B. Chen", '}},
             {"index": 0, "function": {"arguments": '"category": "lodging"}'}}]
    acc = {}
    for f in frags:
        merge_tool_call_delta(acc, f)
    whole = acc[0]
    print("1 four fragments ->", whole["name"], json.loads(whole["arguments"]))

    db, _ = build()
    agent = Agent(build_registry(db), policy=fabricating_policy, skills=Router().match, guard=review)
    q = [{"role": "user", "content": "Did B. Chen's Boston lodging exceed the lodging cap?"}]

    class H(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802
            self.rfile.read(int(self.headers.get("Content-Length") or 0))
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            for ev in stream_guarded(agent, q):
                self.wfile.write(ev)
                self.wfile.flush()

        def log_message(self, *a):
            return

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    t0 = time.perf_counter()
    req = urllib.request.Request(f"http://127.0.0.1:{srv.server_address[1]}/v1/chat/completions", data=b"{}")
    first, text, events = None, "", 0
    with urllib.request.urlopen(req, timeout=30) as r:
        for raw in r:
            line = raw.decode().strip()
            if not line.startswith("data: "):
                continue
            events += 1
            first = first or time.perf_counter() - t0
            body = line[6:]
            if body == "[DONE]":
                break
            text += json.loads(body)["choices"][0]["delta"].get("content", "")
    srv.shutdown()
    print(f"2 events received: {events}, first event after {first * 1000:.0f} ms")
    print("3 client saw     :", text[:100])
    print("4 rejected draft figure 312.40 reached the client:", "312.40" in text)


if __name__ == "__main__":
    main()
