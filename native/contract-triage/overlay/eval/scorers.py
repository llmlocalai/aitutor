"""Code-based scorers (Blueprint 4.3). They decide pass or fail on numbers; LLM judges
only grade wording.

Each function takes the agent's answer text and the row's expectations and returns
True, False, or None (not applicable to this row). `mlflow_scorers()` wraps them for
mlflow.genai.evaluate; the plain functions are unit-tested without MLflow.
"""

from __future__ import annotations

import re
from typing import Any

_NUM = re.compile(r"(?<![\w.])-?\$?\d[\d,]*(?:\.\d+)?")
_WORDNUM = {
    "no": 0,
    "none": 0,
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
}
REFUSAL = re.compile(
    r"\b(can(?:no|')t|cannot|unable|not able|won't|will not|outside|"
    r"not (?:something|a task)|read-only|does not support|decline)\b",
    re.I,
)
NOTHING = re.compile(r"\b(no awards?|nothing|none|no contracts?|zero)\b", re.I)


def numbers(text: str) -> list[float]:
    out = [
        float(m.group(0).replace("$", "").replace(",", "")) for m in _NUM.finditer(text)
    ]
    out += [float(v) for w, v in _WORDNUM.items() if re.search(rf"\b{w}\b", text, re.I)]
    return out


def exact_count(text: str, exp: dict[str, Any]) -> bool | None:
    if "expected_count" not in exp or exp.get("category") == "multi_tool":
        return None
    n = exp["expected_count"]
    if n == 0:
        return bool(NOTHING.search(text)) or 0.0 in numbers(text)
    return float(n) in numbers(text)


def percent_close(text: str, exp: dict[str, Any], tol: float = 0.5) -> bool | None:
    if "expected_percent" not in exp:
        return None
    return any(abs(x - exp["expected_percent"]) <= tol for x in numbers(text))


def dollars_within(text: str, exp: dict[str, Any], rel: float = 0.005) -> bool | None:
    if "expected_dollars" not in exp:
        return None
    want = float(exp["expected_dollars"])
    return any(
        abs(x - want) <= abs(want) * rel for x in numbers(text) if abs(x) >= 1000
    )


def id_recall(text: str, exp: dict[str, Any], floor: float = 0.9) -> bool | None:
    ids = exp.get("expected_ids") or []
    if not ids or exp.get("category") in ("office_resolution",):
        return None if not ids else all(i in text for i in ids)
    found = sum(1 for i in ids if i in text)
    return found / len(ids) >= floor


def id_precision(text: str, exp: dict[str, Any], floor: float = 0.9) -> bool | None:
    """Of the award numbers the answer names (same office prefix), how many are expected."""
    ids = set(exp.get("expected_ids") or [])
    if not ids or exp.get("category") != "core":
        return None
    prefixes = {i[:6] for i in ids}
    named = {t for t in re.findall(r"\b[A-Z0-9]{10,17}\b", text) if t[:6] in prefixes}
    if not named:
        return None
    return len(named & ids) / len(named) >= floor


def decoy_absent(text: str, exp: dict[str, Any]) -> bool | None:
    decoys = exp.get("decoy_ids") or []
    if not decoys:
        return None
    # A decoy may be named only to say it is excluded.
    for d in decoys:
        for m in re.finditer(re.escape(d), text):
            around = text[max(0, m.start() - 80) : m.end() + 80].lower()
            if not re.search(
                r"not (listed|included|a candidate)|closed|exclud", around
            ):
                return False
    return True


def refusal_present(text: str, exp: dict[str, Any]) -> bool | None:
    if not exp.get("must_refuse"):
        return None
    return bool(REFUSAL.search(text))


ALL = [
    exact_count,
    percent_close,
    dollars_within,
    id_recall,
    id_precision,
    decoy_absent,
    refusal_present,
]


def score_row(text: str, exp: dict[str, Any]) -> dict[str, bool | None]:
    return {f.__name__: f(text, exp) for f in ALL}


def passed(text: str, exp: dict[str, Any]) -> bool:
    """A row passes when every applicable code scorer passes."""
    return all(v is not False for v in score_row(text, exp).values())


def mlflow_scorers() -> list[Any]:
    """One MLflow scorer, code_checks: True when every applicable check passes. The
    rationale lists each check, so a failed row says which number was wrong. Imported
    inside so the unit tests need no MLflow."""
    from mlflow.entities import Feedback
    from mlflow.genai.scorers import scorer

    @scorer(name="code_checks")
    def code_checks(outputs: Any, expectations: dict[str, Any]) -> Feedback:
        detail = score_row(str(outputs), expectations or {})
        applied = {k: v for k, v in detail.items() if v is not None}
        return Feedback(
            value=all(applied.values()),
            rationale=", ".join(f"{k}={v}" for k, v in applied.items())
            or "no check applies",
        )

    return [code_checks]
