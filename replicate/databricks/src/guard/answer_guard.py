"""Answer guard, ported from the local build (module 10). Pure Python, no platform calls.

A draft may not state a money figure the evidence of this conversation does not contain.
Evidence is tool output and what the user said, never the assistant's own earlier words.
Deterministic, milliseconds, no model call, so it can sit in front of every response.
"""
from __future__ import annotations

import re

MONEY = re.compile(r"(?:\$\s?([\d,]+(?:\.\d+)?))|(?:([\d,]+(?:\.\d+)?)\s*(?:dollars|usd)\b)", re.I)
NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")
CORRECTIVE = ("These figures are not in the evidence of this conversation: {figures}. "
              "Rewrite the answer using only numbers the tools returned. If the tools did not return a number, say so.")
FALLBACK = ("I ran the lookups but could not produce an answer whose figures all match the tool results. "
            "Please ask again or narrow the question.")


def _num(s: str) -> float:
    return float(s.replace(",", ""))


def claims(answer: str) -> list:
    return [_num(a or b) for a, b in MONEY.findall(answer)]


def evidence(messages: list) -> list:
    out = []
    for m in messages:
        if m.get("role") in ("tool", "user"):
            out += [_num(x) for x in NUMBER.findall(str(m.get("content") or ""))]
    return out


def grounded(value: float, ev: list) -> bool:
    """In the evidence as is, or the sum or difference of two evidence numbers."""
    near = lambda a, b: abs(a - b) <= 0.005 * max(1.0, abs(b))  # noqa: E731
    if any(near(value, e) for e in ev):
        return True
    small = sorted(set(ev))[:400]
    return any(near(value, a + b) or near(value, abs(a - b)) for i, a in enumerate(small) for b in small[i:])


def check(answer: str, messages: list, strict: bool = True) -> dict:
    ev = evidence(messages)
    stated = claims(answer)
    bad = [v for v in stated if not grounded(v, ev)]
    ok = not bad if strict else len(bad) * 2 <= len(stated)
    return {"ok": ok, "stated": stated, "unsupported": bad,
            "corrective": CORRECTIVE.format(figures=", ".join(f"{v:,.2f}" for v in bad))}
