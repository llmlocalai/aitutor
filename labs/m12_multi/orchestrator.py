"""Orchestrator and workers: split a compound question, run narrow agents in parallel, merge.

Each worker is the same Agent class with a smaller tool set and its own message
list. Nothing a worker reads enters another worker's context.
"""
from __future__ import annotations

import re

from labs.m06_tools.registry import Registry
from labs.m07_harness.graph import run_graph
from labs.m07_harness.loop import Agent


def subset(registry: Registry, names: list) -> Registry:
    """A registry that exposes only some tools. This is how a worker is kept narrow."""
    r = Registry()
    r.tools = {n: registry.tools[n] for n in names}
    return r


# region: split
def split(question: str) -> list:
    """Break a compound question into (worker, sub-question). Rules here; a planner model in production."""
    parts = [p.strip(" ?.") for p in re.split(r"\?\s+|\band also\b|;\s*", question) if p.strip(" ?.")]
    out = []
    for p in parts:
        worker = "data" if re.search(r"spen[dt]|paid|total|how much was", p, re.I) else "policy"
        out.append((worker, p + "?"))
    return out
# endregion


# region: orchestrate
async def orchestrate(question: str, registry: Registry, policy=None) -> dict:
    workers = {"policy": Agent(subset(registry, ["search_policy"]), policy=policy,
                               base_prompt="You answer only from policy documents. Cite the section."),
               "data": Agent(subset(registry, ["query_expenses"]), policy=policy,
                             base_prompt="You answer only from expense records. Name the filters you used.")}
    tasks = split(question)

    def worker_node(i: int, kind: str, sub: str):
        async def node(state: dict) -> tuple:
            r = await workers[kind].run([{"role": "user", "content": sub}])
            return ({"findings_append": [{"i": i, "worker": kind, "question": sub, "answer": r["answer"],
                                          "context_chars": sum(len(str(m.get("content") or "")) for m in r["messages"])}],
                     "model_calls": r["model_calls"]},
                    {"synthesize": synthesize})                 # all workers converge on one node
        return node

    async def dispatch(state: dict) -> tuple:
        return {}, {f"worker:{i}:{k}": worker_node(i, k, s) for i, (k, s) in enumerate(tasks)}

    async def synthesize(state: dict) -> tuple:
        ordered = sorted(state["findings"], key=lambda f: f["i"])
        return {"answer": " ".join(f["answer"] for f in ordered)}, {}

    state = await run_graph("dispatch", dispatch, {"question": question})
    return {"answer": state["answer"], "waves": state["trace"], "findings": sorted(state["findings"], key=lambda f: f["i"]),
            "model_calls": state["model_calls"]}
# endregion
