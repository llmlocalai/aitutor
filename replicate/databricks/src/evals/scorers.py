"""Step 19. Scorers. The checks are plain functions (tested here); MLflow wraps them at run time.

  must_contain     every required string appears in the answer (the frozen questions, module 11)
  used_tool        the tool the question needs was actually called
  figures_grounded every money figure in the answer is in the evidence (the guard, as a metric)
  seal_digest      a hash of the dataset rows: a changed row means a broken seal, and the run stops
"""
from __future__ import annotations

import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from guard.answer_guard import check  # noqa: E402


def must_contain(answer: str, required: list) -> bool:
    low = (answer or "").lower()
    return all(str(r).lower() in low for r in required or [])


def used_tool(tool_names: list, needed: str | None) -> bool:
    return True if not needed else needed in (tool_names or [])


def figures_grounded(answer: str, evidence_texts: list) -> bool:
    msgs = [{"role": "tool", "content": t} for t in evidence_texts or []]
    return check(answer or "", msgs, True)["ok"]


def seal_digest(records: list) -> str:
    """Order-independent digest of the questions and expectations."""
    rows = sorted(json.dumps({"inputs": r["inputs"], "expectations": r.get("expectations", {})}, sort_keys=True)
                  for r in records)
    return hashlib.sha256("\n".join(rows).encode()).hexdigest()


def to_records(frozen: dict) -> list:
    """Local frozen_questions.json -> MLflow evaluation records (inputs + expectations)."""
    out = []
    for item in frozen["items"]:
        out.append({"inputs": {"messages": [{"role": "user", "content": item["q"]}]},
                    "expectations": {"must_contain": item.get("must_contain", []),
                                     "needs_tool": item.get("needs_tool")}})
    return out


def mlflow_scorers() -> list:  # pragma: no cover - needs mlflow
    """The same checks as MLflow code-based scorers. `outputs` is what predict_fn returned."""
    from mlflow.genai.scorers import scorer

    @scorer
    def contains_required(outputs: dict, expectations: dict) -> bool:
        return must_contain(outputs.get("answer", ""), expectations.get("must_contain", []))

    @scorer
    def called_needed_tool(outputs: dict, expectations: dict) -> bool:
        return used_tool(outputs.get("tools", []), expectations.get("needs_tool"))

    @scorer
    def grounded_figures(outputs: dict) -> bool:
        return figures_grounded(outputs.get("answer", ""), outputs.get("evidence", []))

    return [contains_required, called_needed_tool, grounded_figures]
