"""python3 -m labs.m10_guard.demo"""
from __future__ import annotations

import asyncio
import os

from labs.common.paths import work
from labs.common.scripts import desk_policy, fabricating_policy, stubborn_policy
from labs.m05_rag.demo import build
from labs.m06_tools.tools import build_registry
from labs.m07_harness.loop import Agent
from labs.m08_skills.loader import Router
from labs.m10_guard.guard import check, review
from labs.m10_guard.hooks import write_path_guard


def main():
    evidence = [{"role": "user", "content": "Did Chen exceed the cap?"},
                {"role": "tool", "content": '{"rows": [{"amount_usd": 219.0}, {"amount_usd": 236.0}], "total_usd": 455.0, "cap": 220}'}]
    for text in ("Chen paid 219.00 dollars, under the 220 dollar cap.",
                 "The two stays total $455.00 and differ by $17.00.",
                 "Chen paid 312.40 dollars for lodging."):
        v = check(text, evidence)
        print("1 check:", "PASS" if v["ok"] else "FAIL", "| stated", v["stated"], "| unsupported", v["unsupported"])

    db, _ = build()
    reg, router = build_registry(db), Router()
    q = [{"role": "user", "content": "Did B. Chen's Boston lodging exceed the lodging cap?"}]
    for label, policy in (("honest model   ", desk_policy), ("fabricates once", fabricating_policy), ("keeps inventing", stubborn_policy)):
        r = asyncio.run(Agent(reg, policy=policy, skills=router.match, guard=review).run(q))
        g = r["guard"]
        print(f"2 {label}: retried={g.get('retried', False)} fallback={g.get('used_fallback', False)} -> {r['answer'][:88]}")

    os.environ["GUARD_MODE"] = "observe"
    r = asyncio.run(Agent(reg, policy=fabricating_policy, skills=router.match, guard=review).run(q))
    print("3 observe mode :", "would_block =", r["guard"].get("would_block"), "-> answer left alone:", r["answer"][:40], "...")
    os.environ["GUARD_MODE"] = "enforce"

    ex = [{"role": "user", "content": "Give me a made-up example with numbers of a trip that needs approval."},
          {"role": "tool", "content": '{"results": [{"text": "more than 2,500 dollars"}]}'}]
    print("4 requested example passes:", review(ex, "Say a trip costs 3,100 dollars: it needs approval.", "policy-citation")["ok"])
    print("5 no tools, general talk  :", review([{"role": "user", "content": "hi"}], "A typical cap might be $200.", None)["reason"])

    hook = write_path_guard(work("m10", fresh=True))
    for path in ("notes/summary.md", "../../etc/passwd", "/tmp/elsewhere.txt"):
        print(f"6 write {path:22s} ->", hook("write_file", {"path": path}) or "allowed")
    print("7 other tools untouched   ->", hook("search_policy", {"query": "x"}) or "allowed")


if __name__ == "__main__":
    main()
