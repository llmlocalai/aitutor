"""Step 16 and 18. The release gate: compare an evaluation against the contract and the last release.

Used by CI (.gitlab-ci.yml, job eval_gate) and by the nightly job. Pure decision logic, tested here.
A release passes only if every contract threshold holds, there are zero unsafe errors, and no metric
is worse than the baseline by more than the run-to-run spread measured for that metric.

  python gate.py --current current.json --baseline baseline.json [--contract ../../contract.yml]
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

HIGHER_IS_BETTER = {"action_accuracy", "grounded_figures", "policy_cited", "first_try_admissible"}
LOWER_IS_BETTER = {"p95_latency_s", "cost_per_exception_usd"}


def check(current: dict, baseline: dict | None, metrics: dict, spread: dict | None = None,
          min_n: int = 200) -> list:
    """Reasons to block the release. Empty list means ship."""
    out = []
    if current.get("n", 0) < min_n:
        out.append(f"only {current.get('n', 0)} evaluated cases; the gate needs {min_n} to mean anything")
    if current.get("unsafe_errors", 0) > 0:
        out.append(f"{current['unsafe_errors']} unsafe errors (proposed payment where a person did not)")
    floors = {"action_accuracy": metrics["action_accuracy_min"], "grounded_figures": metrics["grounded_figures_min"],
              "policy_cited": metrics["policy_cited_min"]}
    ceilings = {"p95_latency_s": metrics["p95_latency_s_max"], "cost_per_exception_usd": metrics["cost_per_exception_usd_max"]}
    for k, v in floors.items():
        if current.get(k, 0) < v:
            out.append(f"{k} {current.get(k, 0)} below contract minimum {v}")
    for k, v in ceilings.items():
        if current.get(k, float("inf")) > v:
            out.append(f"{k} {current.get(k)} above contract maximum {v}")
    if baseline:
        spread = spread or {}
        for k in HIGHER_IS_BETTER:
            if k in baseline and k in current and current[k] < baseline[k] - spread.get(k, 0.0):
                out.append(f"{k} regressed {baseline[k]} -> {current[k]} (allowed spread {spread.get(k, 0.0)})")
        for k in LOWER_IS_BETTER:
            if k in baseline and k in current and current[k] > baseline[k] * 1.2 + spread.get(k, 0.0):
                out.append(f"{k} grew more than 20%: {baseline[k]} -> {current[k]}")
    return out


def worst_of(runs: list) -> dict:
    """One summary from repeated runs: the worst value of each metric (min for higher-is-better, max otherwise)."""
    runs = runs if isinstance(runs, list) else [runs]
    keys = [k for k in runs[0] if all(isinstance(r.get(k), (int, float)) for r in runs)]
    out = {k: (min if k in HIGHER_IS_BETTER or k == "n" else max)(r[k] for r in runs) for k in keys}
    return out


def spread_of(runs: list) -> dict:
    """Max minus min per metric across repeated runs of the same build: the noise floor."""
    keys = set().union(*[r.keys() for r in runs]) if runs else set()
    return {k: round(max(r[k] for r in runs) - min(r[k] for r in runs), 4)
            for k in keys if all(isinstance(r.get(k), (int, float)) for r in runs)}


if __name__ == "__main__":  # pragma: no cover
    from common.contract import load

    ap = argparse.ArgumentParser()
    ap.add_argument("--current", required=True, help="JSON: one summary, or a list of repeated-run summaries")
    ap.add_argument("--baseline")
    ap.add_argument("--contract")
    ap.add_argument("--result", help="write {sha, passed, reasons, summary} here for the release pipeline")
    a = ap.parse_args()
    cur = json.load(open(a.current))
    runs = cur if isinstance(cur, list) else [cur]
    base = worst_of(json.load(open(a.baseline))) if a.baseline and os.path.exists(a.baseline) else None
    reasons = check(worst_of(runs), base, load(a.contract)["success_metrics"], spread_of(runs))
    for r in reasons:
        print("GATE:", r)
    print("gate passed" if not reasons else f"gate FAILED ({len(reasons)} reasons)")
    if a.result:
        json.dump({"sha": os.environ.get("CI_COMMIT_SHA", ""), "passed": not reasons, "reasons": reasons,
                   "summary": worst_of(runs)}, open(a.result, "w"), indent=1)
    sys.exit(1 if reasons else 0)
