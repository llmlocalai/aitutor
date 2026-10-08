"""python3 -m labs.m07_harness.triage

Cheap gates in front of the planner. A question about the agent itself needs no
tool. Catching it with a regex costs microseconds; letting the planner decide
costs a model call and, with this fake model, a wasted tool call.
"""
from __future__ import annotations

import asyncio
import re

from labs.common import llm
from labs.common.paths import work
from labs.m04_state.store import append_log
from labs.m05_rag.demo import build
from labs.m06_tools.registry import Registry
from labs.m06_tools.tools import build_registry
from labs.m07_harness.loop import Agent

# region: triage
SELF_REF = re.compile(r"\b(what can you do|who are you|what tools do you have|how do you work)\b", re.I)
CANONICAL_SELF = ["what are you able to help me with", "describe your capabilities", "which tools are available to you"]
SIM_THRESHOLD = 0.60          # chosen on the examples below; re-check it when the embedder changes
_CANON = [llm.embed(x) for x in CANONICAL_SELF]


def needs_tools(user_text: str) -> tuple:
    """Returns (decision, reason). Cheapest gate first."""
    if SELF_REF.search(user_text):
        return False, "regex"
    best = max(llm.cosine(llm.embed(user_text), c) for c in _CANON)
    if best >= SIM_THRESHOLD:
        return False, f"similar to a self question ({best:.2f})"
    return True, f"planner decides (best similarity {best:.2f})"
# endregion


def main():
    db, _ = build()
    reg = build_registry(db)
    no_tools = Registry()
    log = work("m07t", fresh=True) / "triage.jsonl"
    questions = ["What can you do?", "Describe your capabilities, please.",
                 "Which tools are available to you here?", "What is the nightly lodging cap?"]
    for q in questions:
        decision, reason = needs_tools(q)
        append_log(log, {"question": q, "needs_tools": decision, "reason": reason})
        plain = asyncio.run(Agent(reg).run([{"role": "user", "content": q}]))
        gated = asyncio.run(Agent(reg if decision else no_tools).run([{"role": "user", "content": q}]))
        print(f"1 {q:40s} needs_tools={decision!s:5s} [{reason}]")
        print(f"  without triage: {plain['model_calls']} model calls, {len(plain['tools'])} tool calls | "
              f"with triage: {gated['model_calls']} model calls, {len(gated['tools'])} tool calls")
    print("2 decisions logged:", sum(1 for _ in log.open()), "lines in", log.name)


if __name__ == "__main__":
    main()
