"""Start the lab gateway on a port so SDKs have an OpenAI-compatible endpoint to call.

With LAB_BASE_URL unset the gateway answers with the fake model. Set it and the
same SDK code talks to your real model through the same gateway.
"""
from __future__ import annotations

from labs.common.paths import work
from labs.m02_gateway.gateway import serve
from labs.m02_gateway.keys import KeyStore


def start():
    keys = KeyStore(work("m14", fresh=True) / "keys.db")
    key = keys.issue("sdk-lab", scopes="chat,tools", rate_per_min=600)
    server, base = serve(keys)
    return server, base + "/v1", key
