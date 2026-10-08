"""python3 -m labs.m09_memory.demo"""
from __future__ import annotations

import asyncio

from labs.common.scripts import desk_policy
from labs.m05_rag.demo import build
from labs.m06_tools.tools import build_registry
from labs.m07_harness.loop import Agent
from labs.m09_memory.memory import Memory


def main():
    db, _ = build()
    mem = Memory(db)
    agent = Agent(build_registry(db), policy=desk_policy, memory=mem)

    asyncio.run(agent.run([{"role": "user", "content": "Call me Dana. My cost center is CC-200 and I'm based in Boston."}],
                          partition="user:dana", thread="mon"))
    asyncio.run(agent.run([{"role": "user", "content": "What is the nightly lodging cap?"}], partition="user:dana", thread="mon"))
    asyncio.run(agent.run([{"role": "user", "content": "My cost center is CC-100."}], partition="user:eli", thread="mon"))
    mem.flush()

    print("1 dana briefing :", mem.briefing("user:dana").replace("\n", " "))
    print("2 eli briefing  :", mem.briefing("user:eli").replace("\n", " "))
    prompt, _ = agent.compose_system_prompt("anything", "user:dana")
    print("3 in dana prompt:", "cost_center: CC-200" in prompt, "| in eli prompt:",
          "CC-200" in agent.compose_system_prompt("anything", "user:eli")[0])
    hit = mem.recall("user:dana", "what did we say about the hotel cap", exclude_thread="tue")
    print("4 recall (dana) :", hit[0]["thread"], hit[0]["role"], "->", hit[0]["content"][:60], "... score", hit[0]["score"])
    print("5 recall (eli)  :", mem.recall("user:eli", "what did we say about the hotel cap", exclude_thread="tue"))
    print("6 same thread   :", mem.recall("user:dana", "hotel cap", exclude_thread="mon"), "(skipped: already in context)")
    print("7 unrelated     :", mem.recall("user:dana", "quarterly revenue forecast spreadsheet", exclude_thread="tue"))

    class Broken(Memory):
        def record(self, *a):
            raise RuntimeError("disk full")
    bad = Broken(db)
    r = asyncio.run(Agent(build_registry(db), policy=desk_policy, memory=bad).run(
        [{"role": "user", "content": "What is the nightly lodging cap?"}], partition="user:dana"))
    bad.flush()
    print("8 answer despite failed write:", r["answer"][:50], "...")


if __name__ == "__main__":
    main()
