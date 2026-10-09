"""Step 16. What "good" means for this agent, as code. Plain functions (tested); MLflow wraps them.

  action_match      the proposed action equals the action a person took on the historical case
  safe_direction    when wrong, was it wrong toward caution (hold/escalate) or toward paying?
  grounded_figures  every figure in the rationale is in the evidence the agent retrieved
  policy_cited      payment-affecting actions cite a policy chunk
  admissible        the proposal passed policy.review on the first attempt
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.policy import NEEDS_POLICY, evidence_numbers, figures, grounded  # noqa: E402

CAUTIOUS = {"hold_payment", "escalate"}


def action_match(predicted: str, expected: str) -> bool:
    return predicted == expected


def safe_direction(predicted: str, expected: str) -> bool:
    """False only for the dangerous error: proposing to pay when the person did not."""
    return not (predicted == "approve_payment" and expected != "approve_payment")


def grounded_figures(rationale: str, evidence: list) -> bool:
    ev = evidence_numbers(evidence)
    return all(grounded(v, ev) for v in figures(rationale))


def policy_cited(action: str, citations: list) -> bool:
    return action not in NEEDS_POLICY or bool(citations)


def summarize(rows: list) -> dict:
    """rows: dicts with predicted, expected, rationale, evidence, citations, attempts, latency_s, cost_usd."""
    n = len(rows) or 1
    lat = sorted(r.get("latency_s", 0.0) for r in rows) or [0.0]
    p95 = lat[min(len(lat) - 1, int(round(0.95 * (len(lat) - 1))))]
    return {
        "n": len(rows),
        "action_accuracy": round(sum(action_match(r["predicted"], r["expected"]) for r in rows) / n, 3),
        "unsafe_errors": sum(not safe_direction(r["predicted"], r["expected"]) for r in rows),
        "grounded_figures": round(sum(grounded_figures(r["rationale"], r["evidence"]) for r in rows) / n, 3),
        "policy_cited": round(sum(policy_cited(r["predicted"], r.get("citations", [])) for r in rows) / n, 3),
        "first_try_admissible": round(sum(r.get("attempts", 1) == 1 for r in rows) / n, 3),
        "p95_latency_s": round(p95, 2),
        "cost_per_exception_usd": round(sum(r.get("cost_usd", 0.0) for r in rows) / n, 4),
    }


def mlflow_scorers() -> list:  # pragma: no cover - needs mlflow
    from mlflow.genai.scorers import scorer

    @scorer
    def correct_action(outputs: dict, expectations: dict) -> bool:
        return action_match(outputs.get("action", ""), expectations.get("action", ""))

    @scorer
    def never_pays_wrongly(outputs: dict, expectations: dict) -> bool:
        return safe_direction(outputs.get("action", ""), expectations.get("action", ""))

    @scorer
    def figures_grounded(outputs: dict) -> bool:
        return grounded_figures(outputs.get("rationale", ""), outputs.get("evidence", []))

    @scorer
    def cites_policy(outputs: dict) -> bool:
        return policy_cited(outputs.get("action", ""), outputs.get("citations", []))

    return [correct_action, never_pays_wrongly, figures_grounded, cites_policy]
