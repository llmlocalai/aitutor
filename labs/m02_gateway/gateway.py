"""A small authenticating gateway in front of a model engine.

Public surface:
  GET  /health                 liveness, no key needed, no detail
  GET  /health  + key          detail
  POST /v1/chat/completions    needs a key with scope 'chat'; tools need scope 'tools'

Upstream is LAB_BASE_URL when set, otherwise the fake model. Standard library only.
"""
from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable, Optional

from labs.common import llm
from labs.m02_gateway.keys import KeyStore


# region: gateway
def make_handler(keys: KeyStore, upstream: Optional[Callable] = None):
    upstream = upstream or (lambda body: llm.chat(body.get("messages", []), body.get("tools"),
                                                  body.get("model"), body.get("max_tokens", 512)))

    class Gateway(BaseHTTPRequestHandler):
        def _send(self, status: int, obj: dict) -> None:
            data = json.dumps(obj).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):  # noqa: N802
            if self.path != "/health":
                return self._send(404, {"error": "not found"})
            auth = self.headers.get("Authorization")
            if not auth:                                   # a supervisor needs no key
                return self._send(200, {"status": "ok", "authenticated": False})
            try:
                row = keys.authenticate(auth)
            except PermissionError as e:
                return self._send(e.args[0], {"error": e.args[1]})
            return self._send(200, {"status": "ok", "authenticated": True, "app": row["app"], "scopes": row["scopes"]})

        def do_POST(self):  # noqa: N802
            if self.path != "/v1/chat/completions":
                return self._send(404, {"error": "not found"})
            try:
                row = keys.authenticate(self.headers.get("Authorization"), "chat")
            except PermissionError as e:
                return self._send(e.args[0], {"error": e.args[1]})
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
            if body.get("tools") and "tools" not in row["scopes"]:
                body.pop("tools")                          # scope decides who gets tools
            return self._send(200, upstream(body))

        def log_message(self, *args):
            return

    return Gateway


def serve(keys: KeyStore, port: int = 0, upstream: Optional[Callable] = None):
    """Start in a background thread. Returns (server, base_url)."""
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(keys, upstream))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"
# endregion
