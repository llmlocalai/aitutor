"""python3 -m labs.m02_gateway.demo"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

from labs.common.paths import work
from labs.m02_gateway.gateway import serve
from labs.m02_gateway.keys import KeyStore


def call(url: str, key=None, body=None):
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = "Bearer " + key
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body else None, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def main():
    keys = KeyStore(work("m02", fresh=True) / "keys.db")
    site_key = keys.issue("website", scopes="chat", rate_per_min=3)
    agent_key = keys.issue("coding-agent", scopes="chat,tools")
    server, base = serve(keys)
    ask = {"messages": [{"role": "user", "content": "hello"}]}
    tool = [{"type": "function", "function": {"name": "search_policy", "description": "search policy",
                                               "parameters": {"type": "object", "properties": {"query": {"type": "string"}}}}}]

    print("1 liveness, no key      ->", call(base + "/health"))
    print("2 chat, no key          ->", call(base + "/v1/chat/completions", body=ask))
    s, r = call(base + "/v1/chat/completions", site_key, ask)
    print("3 chat, website key     ->", s, r["choices"][0]["message"]["content"])
    s, r = call(base + "/v1/chat/completions", site_key, {**ask, "tools": tool})
    print("4 tools, website key    ->", s, "tool_calls" in r["choices"][0]["message"], "(tools stripped: no scope)")
    s, r = call(base + "/v1/chat/completions", agent_key, {**ask, "tools": tool})
    print("5 tools, agent key      ->", s, r["choices"][0]["message"]["tool_calls"][0]["function"]["name"])
    call(base + "/v1/chat/completions", site_key, ask)            # third call uses up the minute
    print("6 4th call in a minute  ->", call(base + "/v1/chat/completions", site_key, ask))
    keys.revoke("coding-agent")
    print("7 revoked agent key     ->", call(base + "/v1/chat/completions", agent_key, ask))
    s, r = call(base + "/health", site_key)
    print("8 website key unaffected->", s if s != 429 else "429 (still rate limited, and still valid)")
    server.shutdown()


if __name__ == "__main__":
    main()
