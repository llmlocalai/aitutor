"""python3 -m labs.m02_gateway.route

The model router from lab 1, applied inside the gateway. Callers send no model
name. The gateway decides, forwards, and an explicit choice is never overridden.
"""
from __future__ import annotations

from labs.common import llm
from labs.common.paths import work
from labs.m01_inference.router import resolve_for_request
from labs.m02_gateway.demo import call
from labs.m02_gateway.gateway import serve
from labs.m02_gateway.keys import KeyStore

SEEN = []          # what each forwarded request looked like, for the printout


def forward(body: dict, base_url):
    """Stand-in for the HTTP call to an engine. Records where the request would go."""
    SEEN.append({"model": body.get("model"), "base_url": base_url or "default engine"})
    return llm.chat(body.get("messages", []), None, body.get("model"), body.get("max_tokens", 64))


# region: route
def upstream(body: dict) -> dict:
    choice = resolve_for_request(body) or {}
    if "model" in choice:
        body["model"] = choice["model"]
    base = choice.get("base_url")          # None means the default engine
    return forward(body, base)
# endregion


def main():
    keys = KeyStore(work("m02r", fresh=True) / "keys.db")
    key = keys.issue("website", scopes="chat", rate_per_min=30)
    server, base = serve(keys, upstream=upstream)
    text = {"messages": [{"role": "user", "content": "Summarize the lodging rule."}]}
    image = {"messages": [{"role": "user", "content": [{"type": "image_url", "image_url": {"url": "receipt.png"}}]}]}
    short = {"messages": [{"role": "user", "content": "yes or no?"}], "max_tokens": 16}
    for label, body in (("text, no model   ", text), ("image, no model  ", image),
                        ("short, no model  ", short), ("text, model=mine ", {**text, "model": "mine"})):
        status, _ = call(base + "/v1/chat/completions", key, body)
        print("1" if label.startswith("text, no") else " ", label, "->", status, SEEN[-1])
    server.shutdown()
    print("2 explicit model untouched:", SEEN[-1]["model"] == "mine")


if __name__ == "__main__":
    main()
