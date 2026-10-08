"""python3 -m labs.m14_sdk.demo   (skips an SDK that is not installed)"""
from __future__ import annotations

import asyncio

from labs.common.scripts import desk_policy
from labs.m05_rag.demo import build
from labs.m06_tools.tools import build_registry
from labs.m07_harness.loop import Agent
from labs.m14_sdk.serve_fake import start


def main():
    db, _ = build()
    q = "What does the policy say about the lodging cap?"
    r = asyncio.run(Agent(build_registry(db), policy=desk_policy).run([{"role": "user", "content": q}]))
    print("hand-built loop :", r["model_calls"], "model calls, tools", r["tools"])
    server, base, key = start()
    try:
        from labs.m14_sdk import langgraph_agent
        out = langgraph_agent.ask(langgraph_agent.make(base, key), q)
        print("langgraph       :", out["message_types"], "->", out["answer"][:70], "...")
    except ImportError as e:
        print("langgraph       : not installed, skipped (" + str(e) + ")")
    try:
        from labs.m14_sdk import openai_agents_agent
        out = openai_agents_agent.ask(openai_agents_agent.make(base, key), q)
        print("openai-agents   :", out["items"], "->", out["answer"][:70], "...")
    except ImportError as e:
        print("openai-agents   : not installed, skipped (" + str(e) + ")")
    server.shutdown()
    print("same tools, same endpoint, three loops. Only the loop changed.")


if __name__ == "__main__":
    main()
