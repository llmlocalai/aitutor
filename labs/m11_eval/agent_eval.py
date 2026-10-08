"""End-to-end eval: real questions through the whole agent, repeated, checked by code."""
from __future__ import annotations

import asyncio
import json
import statistics
from pathlib import Path

from labs.m10_guard.guard import check
from labs.m11_eval.seal import assert_sealed


# region: grade
def grade(item: dict, result: dict) -> dict:
    """Mechanical checks first. A model judge is for what code cannot decide."""
    answer = result["answer"]
    checks = {
        "used_right_tool": item["needs_tool"] in result["tools"],
        "has_expected": all(s.lower() in answer.lower() for s in item["must_contain"]),
        "figures_grounded": check(answer, result["messages"])["ok"],
    }
    return {"pass": all(checks.values()), **checks}
# endregion


# region: run
def run(make_agent, eval_dir: Path, repeats: int = 1) -> dict:
    """make_agent(repeat_index) -> Agent. Returns per-question pass rates and the spread across repeats."""
    assert_sealed(eval_dir)
    items = json.loads((eval_dir / "frozen" / "frozen_questions.json").read_text())["items"]
    per_question = {i["q"]: [] for i in items}
    totals = []
    for rep in range(repeats):
        agent = make_agent(rep)
        passed = 0
        for item in items:
            result = asyncio.run(agent.run([{"role": "user", "content": item["q"]}]))
            g = grade(item, result)
            per_question[item["q"]].append(g)
            passed += g["pass"]
        totals.append(passed)
    return {"n": len(items), "repeats": repeats, "totals": totals,
            "mean": round(statistics.mean(totals), 2),
            "spread": (min(totals), max(totals)),
            "stdev": round(statistics.stdev(totals), 2) if repeats > 1 else None,
            "pass_rate": {q: round(sum(g["pass"] for g in gs) / len(gs), 2) for q, gs in per_question.items()},
            "detail": per_question}
# endregion
