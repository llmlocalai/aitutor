"""Step 13. Check the answer's claims against what the tools returned, before the user sees it.

The verification rule in every mature corpus harness is the same: a claim needs tool output behind it.
For this agent the checkable claims are amounts and expense ids. An amount that appears in no tool result
(and is not a sum the case allows), or an id the tools never returned, is an unverified claim. The loop
can send the list back once for correction (loop.run(..., verify=True)); the evals grade the same thing
offline (graders.py, check "grounded"). For high-stakes work, add the verifier subagent
(template/agents/verifier.md), which has not seen how the answer was produced.
"""
from __future__ import annotations

import json
import re

ID = re.compile(r"\bE-\d{4}\b")
DATE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")
AMOUNT = re.compile(r"(?<![\w.-])\$?(\d{1,3}(?:,\d{3})+|\d+)(\.\d{2})(?![\d-])|\$(\d{1,3}(?:,\d{3})+|\d+)(?![\d.,-])")


def _amounts(text: str) -> list[float]:
    out = []
    for m in AMOUNT.finditer(text or ""):
        whole = m.group(1) or m.group(3)
        out.append(float((whole + (m.group(2) or "")).replace(",", "")))
    return out


def _numbers_in(v, out_all: list[float], out_amounts: list[float], amounts_from_text: bool = False) -> None:
    if isinstance(v, bool):
        return
    if isinstance(v, (int, float)):
        out_all.append(float(v))
        out_amounts.append(float(v))
    elif isinstance(v, str):
        found = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", DATE.sub(" ", ID.sub(" ", v)).replace(",", ""))]
        out_all += found                          # ids and dates are not figures, so they never ground an amount
        if amounts_from_text:
            out_amounts += found
    elif isinstance(v, dict):
        for x in v.values():
            _numbers_in(x, out_all, out_amounts, amounts_from_text)
    elif isinstance(v, list):
        for x in v:
            _numbers_in(x, out_all, out_amounts, amounts_from_text)


def evidence(messages: list[dict]) -> tuple[set[str], list[float], list[float], list[float]]:
    """(ids seen, every number seen, tool amounts, stated figures). Tool amounts are the numbers in tool
    results (ids and dates removed); stated figures are the numbers in the user's message and the system prompt (inline skills
    put the policy limits there). Only tool amounts form totals; both form differences."""
    ids, nums, amounts, stated = set(), [], [], []
    for m in messages:
        c = m.get("content") or ""
        if m.get("role") == "tool":
            ids |= set(ID.findall(c))
            try:
                _numbers_in(json.loads(c), nums, amounts, amounts_from_text=True)
            except ValueError:
                _numbers_in(c, nums, amounts, amounts_from_text=True)
        elif m.get("role") in ("user", "system") and isinstance(c, str):
            ids |= set(ID.findall(c))
            _numbers_in(c, nums, stated, amounts_from_text=True)
    return ids, nums, amounts, stated


def unverified(final: str, messages: list[dict]) -> list[str]:
    """Claims in `final` that nothing supports. Allowed: a number seen in a tool result or the user's
    message, a total of tool amounts, or the difference of two amounts (an amount over a limit). Ids and
    dates are never used in a difference, so "E-1010 minus 2026" cannot ground a figure."""
    ids, nums, amounts, stated = evidence(messages)
    seen = sorted(set(round(n, 2) for n in nums))
    out = [f"id {i}" for i in sorted(set(ID.findall(final or ""))) if i not in ids]
    for a in _amounts(final):
        if any(abs(a - n) < 0.005 for n in seen):
            continue
        if _is_sum(a, sorted(round(x, 2) for x in amounts if 0 < x < a + 0.005)):
            continue
        pool = sorted(set(round(x, 2) for x in amounts + stated))
        if any(abs((x - y) - a) < 0.005 for x in pool for y in pool if x > y):
            continue
        out.append(f"amount {a:.2f}")
    return out


def _is_sum(target: float, parts: list[float]) -> bool:
    """True if some subset of the tool amounts adds up to target (a total the user asked for)."""
    cents = int(round(target * 100))
    reach = {0}
    for p in [int(round(x * 100)) for x in parts[:60]]:
        reach |= {r + p for r in reach if r + p <= cents}
        if cents in reach:
            return True
    return cents in reach


def correction(claims: list[str]) -> str:
    return ("Some claims in your answer do not match any tool result: " + ", ".join(claims) +
            ". Check them with the tools and correct the answer. Do not mention this check.")
