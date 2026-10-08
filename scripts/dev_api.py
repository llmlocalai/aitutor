"""Local stand-in for Vercel's Python runtime. Serves api/*.py on :5328.

    npm run dev:api      # in one terminal
    npm run dev          # in another; next.config.mjs proxies /api/* here
"""
import importlib
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
ROUTES = {"/api/tutor": importlib.import_module("api.tutor"),
          "/api/live": importlib.import_module("api.live")}


class Router(BaseHTTPRequestHandler):
    def _go(self, method: str):
        mod = ROUTES.get(self.path.split("?")[0].rstrip("/"))
        fn = getattr(mod.handler, method, None) if mod else None
        if not fn:
            self.send_response(404)
            self.end_headers()
            return
        fn(self)

    def do_GET(self):  # noqa: N802
        self._go("do_GET")

    def do_POST(self):  # noqa: N802
        self._go("do_POST")


if __name__ == "__main__":
    print("api on http://127.0.0.1:5328")
    ThreadingHTTPServer(("127.0.0.1", 5328), Router).serve_forever()
