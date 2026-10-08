"""python3 -m labs.m09_memory.tool_check

Recall as a tool bound to one user. The partition is fixed when the tool is
created for the request, so the model has no argument to name another user.
"""
from __future__ import annotations

import asyncio
import json

from labs.common.scripts import desk_policy
from labs.m05_rag.demo import build
from labs.m06_tools.registry import Registry
from labs.m06_tools.tools import build_registry
from labs.m07_harness.loop import Agent
from labs.m09_memory.memory import Memory, recall_tool


# region: bind
def tools_for_request(base: Registry, memory: Memory, partition: str, thread: str) -> Registry:
    """A registry for one request: the shared tools plus a recall tool bound to this caller."""
    reg = Registry()
    reg.tools.update(base.tools)
    fn = recall_tool(memory, partition=partition, thread=thread)
    reg.tool("Search this user's earlier conversations. Use when they refer to something said before.")(fn)
    return reg
# endregion


def main():
    db, _ = build()
    mem = Memory(db)
    base = build_registry(db)
    agent = Agent(base, policy=desk_policy, memory=mem)
    asyncio.run(agent.run([{"role": "user", "content": "What is the nightly lodging cap?"}], partition="user:dana", thread="mon"))
    asyncio.run(agent.run([{"role": "user", "content": "Is alcohol reimbursable?"}], partition="user:eli", thread="mon"))
    mem.flush()

    dana = tools_for_request(base, mem, "user:dana", "tue")
    schema = next(s for s in dana.schemas() if s["function"]["name"] == "recall_conversations")
    print("1 schema properties:", list(schema["function"]["parameters"]["properties"]))
    hit = dana.call("recall_conversations", {"query": "what did we say about the hotel cap"})
    print("2 dana's tool      :", [(h["thread"], h["content"][:40]) for h in hit["results"]])
    err = dana.call("recall_conversations", {"query": "alcohol", "partition": "user:eli"})["error"]
    print("3 asks for eli     : refused,", err.split("() ")[-1])
    miss = dana.call("recall_conversations", {"query": "quarterly revenue forecast spreadsheet"})
    print("4 nothing similar  :", json.dumps(miss))
    eli = tools_for_request(base, mem, "user:eli", "tue")
    print("5 eli's tool, same query:", [h["thread"] for h in eli.call("recall_conversations",
                                         {"query": "what did we say about the hotel cap"})["results"]] or "no results")


if __name__ == "__main__":
    main()
