"""python3 -m labs.m07_harness.demo"""
from __future__ import annotations

import asyncio

from labs.common.paths import work
from labs.common.scripts import desk_policy, looping_policy
from labs.m05_rag.demo import build
from labs.m06_tools.tools import build_registry
from labs.m07_harness.loop import Agent, flat_loop


def main():
    db, _ = build()
    reg = build_registry(db)
    q = [{"role": "user", "content": "Did B. Chen's Boston lodging exceed the lodging cap?"}]

    print("1 flat loop  :", flat_loop(q, reg, policy=desk_policy))

    agent = Agent(reg, policy=desk_policy, log_dir=work("m07", fresh=True))
    r = asyncio.run(agent.run(q))
    print("2 wave agent :", r["answer"])
    print("  waves      :", [w["nodes"] if len(w["nodes"]) == 1 else [n.split(":")[0] for n in w["nodes"]] for w in r["waves"]])
    print("  model calls:", r["model_calls"], "| tool messages:", sum(1 for m in r["messages"] if m["role"] == "tool"))

    r = asyncio.run(Agent(reg, policy=looping_policy, max_rounds=2).run(q))
    print("3 budget of 2:", "exhausted" if r["budget_exhausted"] else "ok", "after", len(r["waves"]), "waves ->", r["answer"][:70], "...")

    blocked = Agent(reg, policy=desk_policy,
                    pre_tool_hooks=[lambda name, args: "expense data is off limits for this caller"
                                    if name == "query_expenses" else None])
    r = asyncio.run(blocked.run(q))
    print("4 hook blocks one tool:", r["answer"][:90], "...")

    r = asyncio.run(agent.run([{"role": "user", "content": "How much was spent on meals in 2026-07?"}]))
    print("5 empty result:", r["answer"][:110], "...")
    print("6 logs written:", sorted(p.name for p in work("m07").iterdir()))


if __name__ == "__main__":
    main()
