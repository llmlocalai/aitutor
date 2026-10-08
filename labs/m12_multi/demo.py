"""python3 -m labs.m12_multi.demo"""
from __future__ import annotations

import asyncio

from labs.common.scripts import desk_policy
from labs.m05_rag.demo import build
from labs.m06_tools.tools import build_registry
from labs.m07_harness.loop import Agent
from labs.m12_multi.judges import verify
from labs.m12_multi.orchestrator import orchestrate, split


def main():
    db, _ = build()
    reg = build_registry(db)
    q = "What is the deadline for filing an expense report? and also how much was spent on air travel in total?"
    print("1 split:", split(q))
    r = asyncio.run(orchestrate(q, reg, policy=desk_policy))
    print("2 waves:", [[n.split(":")[0] + (":" + n.split(":")[2] if n.count(":") == 2 else "") for n in w["nodes"]] for w in r["waves"]])
    for f in r["findings"]:
        print(f"3 worker {f['worker']:6s} context {f['context_chars']:5d} chars -> {f['answer'][:74]}")
    print("4 merged:", r["answer"][:150], "...")
    single = asyncio.run(Agent(reg, policy=desk_policy).run([{"role": "user", "content": q}]))
    one_ctx = sum(len(str(m.get("content") or "")) for m in single["messages"])
    print(f"5 cost: orchestrated {r['model_calls']} model calls, largest context {max(f['context_chars'] for f in r['findings'])} chars"
          f" | single agent {single['model_calls']} model calls, context {one_ctx} chars")

    passage = ("Lodging is reimbursed at actual cost up to 220 dollars per night. A stay above the cap needs "
               "written approval from the approving official before the trip.")
    for claim in ("Lodging is reimbursed up to 220 dollars per night.",
                  "Lodging cost above 220 dollars per night requires written approval from a manager ahead of time.",
                  "Lodging is reimbursed up to 250 dollars per night.",
                  "Meals are limited to 75 dollars per day."):
        v = verify(claim, passage)
        print(f"6 {claim[:58]:58s} -> {v['verdict']:36s} " + " / ".join(f"{x['judge']}:{'yes' if x['supported'] else 'no'}" for x in v["votes"]))


if __name__ == "__main__":
    main()
