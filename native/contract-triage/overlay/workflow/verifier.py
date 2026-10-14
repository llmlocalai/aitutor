"""Blueprint 5.2. Every number, date and award ID in the model's text must appear in the
tool output for that item, or the item is rejected. Exact comparison, no model involved.
"""

from __future__ import annotations

import json
import re
from decimal import Decimal, InvalidOperation
from typing import Any

DATE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")
AWARD = re.compile(
    r"\bCONT_AWD_[A-Za-z0-9_\-]+|\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{10,17}\b"
)
NUMBER = re.compile(
    r"(?<![\w\-])\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\w\-.])\$?\d+(?:\.\d+)?(?![\w\-])"
)


def _flatten(obj: Any) -> list[str]:
    if isinstance(obj, dict):
        return [s for v in obj.values() for s in _flatten(v)]
    if isinstance(obj, list):
        return [s for v in obj for s in _flatten(v)]
    return [] if obj is None or isinstance(obj, bool) else [str(obj)]


def _num(s: str) -> Decimal | None:
    try:
        return Decimal(s.replace("$", "").replace(",", "")).normalize()
    except InvalidOperation:
        return None


def claims(text: str) -> dict[str, set[str]]:
    dates = set(DATE.findall(text))
    awards = set(AWARD.findall(text))
    scrub = DATE.sub(" ", AWARD.sub(" ", text))
    nums = {m.group(0) for m in NUMBER.finditer(scrub)}
    return {"dates": dates, "awards": awards, "numbers": nums}


def unsupported(text: str, evidence: Any) -> list[str]:
    """Claims in `text` that the tool output `evidence` does not contain."""
    values = _flatten(evidence)
    blob = json.dumps(evidence, default=str)
    known_nums = {n for n in (_num(v) for v in values) if n is not None}
    # Also accept a value written as a whole-dollar figure of a cents amount.
    known_nums |= {n.quantize(Decimal(1)) for n in list(known_nums)}
    c = claims(text)
    bad = [f"date {d}" for d in sorted(c["dates"]) if d not in blob]
    bad += [f"award {a}" for a in sorted(c["awards"]) if a not in blob]
    for n in sorted(c["numbers"]):
        v = _num(n)
        if (
            v is None
            or v in known_nums
            or (v == v.to_integral() and v.quantize(Decimal(1)) in known_nums)
        ):
            continue
        # Small counts (the 3 in "3 awards") must also be supported, except list numbering.
        bad.append(f"number {n}")
    return bad
