"""GET /api/live  -- is the local build reachable right now?

Calls the local build's unauthenticated liveness endpoint. Returns only a
yes or no, the round-trip time, and a tool count. The address of the build
never leaves the server.
"""
from __future__ import annotations

import json
import os
import time
import urllib.request
from http.server import BaseHTTPRequestHandler


def probe() -> dict:
    base = os.environ.get("LOCAL_AGENT_URL", "").rstrip("/")
    if not base:
        return {"configured": False, "reachable": False}
    if base.endswith("/v1"):
        base = base[:-3]
    t0 = time.time()
    try:
        with urllib.request.urlopen(f"{base}/health", timeout=4) as r:
            body = json.loads(r.read().decode() or "{}")
        tools = body.get("mcp_tools_registered")
        return {"configured": True, "reachable": body.get("status") == "ok",
                "latency_ms": int((time.time() - t0) * 1000),
                "tools": tools if isinstance(tools, int) else None}
    except Exception:
        return {"configured": True, "reachable": False}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        data = json.dumps(probe()).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        return
