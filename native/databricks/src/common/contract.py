"""Load and validate contract.yml. Pure Python plus PyYAML; runs in CI before anything deploys.

The contract is the single place where scope, autonomy and release thresholds are written down.
Code reads its numbers from here: the eval gate (success_metrics), the agent (actions), the reviewer
app (second_approver_above). The database trigger repeats the threshold, and a test fails if it
differs. A threshold changes in one reviewed line, never in places that drift apart.
"""
from __future__ import annotations

import os
from pathlib import Path

LEVELS = {0: "report", 1: "recommend", 2: "act with approval", 3: "act within limits", 4: "autonomous"}
REQUIRED = ("workflow", "owner", "decision", "actions", "autonomy_level", "writes", "human_in_the_loop",
            "success_metrics", "data")
METRICS = ("action_accuracy_min", "grounded_figures_min", "policy_cited_min", "p95_latency_s_max",
           "cost_per_exception_usd_max")
DEFAULT_PATH = Path(__file__).resolve().parents[2] / "contract.yml"


def load(path: str | os.PathLike | None = None) -> dict:
    import yaml
    with open(path or DEFAULT_PATH) as f:
        return yaml.safe_load(f)


def problems(c: dict) -> list:
    """Every way the contract is incomplete or self-contradictory. Empty list means valid."""
    out = [f"missing key: {k}" for k in REQUIRED if k not in c]
    if out:
        return out
    if not isinstance(c["actions"], list) or len(c["actions"]) < 2:
        out.append("actions: list at least two, one of which must be a safe default such as escalate")
    elif "escalate" not in c["actions"]:
        out.append("actions: 'escalate' must be allowed, so the agent always has a safe answer")
    lvl = c["autonomy_level"]
    if lvl not in LEVELS:
        out.append(f"autonomy_level: {lvl} is not one of {sorted(LEVELS)}")
    hitl = c["human_in_the_loop"]
    if lvl is not None and lvl <= 2 and not hitl.get("every_proposal"):
        out.append("human_in_the_loop.every_proposal must be true at autonomy level 2 or below")
    if lvl == 3 and "act_limit" not in hitl:
        out.append("autonomy_level 3 needs human_in_the_loop.act_limit: the amount below which it may act alone")
    writes = c["writes"]
    overlap = set(writes.get("allowed", [])) & set(writes.get("forbidden", []))
    if overlap:
        out.append(f"writes: {sorted(overlap)} is both allowed and forbidden")
    if lvl is not None and lvl <= 2 and set(writes.get("allowed", [])) - {"review_queue"}:
        out.append("writes.allowed: at level 2 or below the agent may write only to review_queue")
    m = c["success_metrics"]
    for k in METRICS:
        if k not in m:
            out.append(f"success_metrics.{k} missing")
    for k in ("action_accuracy_min", "grounded_figures_min", "policy_cited_min"):
        if k in m and not (0 <= float(m[k]) <= 1):
            out.append(f"success_metrics.{k} must be between 0 and 1")
    if m.get("grounded_figures_min", 1.0) < 1.0:
        out.append("success_metrics.grounded_figures_min below 1.0 means shipping invented numbers on purpose")
    envs = c["data"].get("catalog_per_env", {})
    if set(envs) != {"dev", "stg", "prd"}:
        out.append("data.catalog_per_env needs exactly dev, stg and prd")
    elif len(set(envs.values())) != 3:
        out.append("data.catalog_per_env: each environment needs its own catalog")
    return out


if __name__ == "__main__":
    import sys
    p = problems(load(sys.argv[1] if len(sys.argv) > 1 else None))
    for line in p:
        print("CONTRACT:", line)
    print("contract ok" if not p else f"{len(p)} contract problems")
    sys.exit(1 if p else 0)
