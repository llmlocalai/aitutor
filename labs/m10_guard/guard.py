"""Answer guard: a draft may not state figures that the evidence does not contain.

Deterministic, a few milliseconds, no model call. It reads the conversation of
ONE request: tool results are evidence, and so is anything the user said.
"""
from __future__ import annotations

import os
import re
from typing import Optional

# A figure is a number with a money marker, or a count of at least 3 digits.
MONEY = re.compile(r"(?:\$\s?([\d,]+(?:\.\d+)?))|(?:([\d,]+(?:\.\d+)?)\s*(?:dollars|usd)\b)", re.I)
NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")
DATA_SKILLS = ("expense",)        # skills whose turns are 'data turns'


def _num(s: str) -> float:
    return float(s.replace(",", ""))


# region: check
def claims(answer: str) -> list:
    """Every money figure the answer states."""
    return [_num(a or b) for a, b in MONEY.findall(answer)]


def evidence_numbers(messages: list) -> list:
    """Every number in tool results and in what the user said. The assistant's own
    earlier words are not evidence."""
    out = []
    for m in messages:
        if m.get("role") in ("tool", "user") and not str(m.get("content") or "").startswith("[harness]"):
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
    ev = evidence_numbers(messages)
    stated = claims(answer)
    bad = [v for v in stated if not grounded(v, ev)]
    ok = not bad if strict else len(bad) * 2 <= len(stated)      # retry: majority rule
    return {"ok": ok, "stated": stated, "unsupported": bad}
# endregion


def asks_for_example(messages: list) -> bool:
    """A user who asks for a made-up example must get one."""
    from labs.common.llm import last_user
    return bool(re.search(r"\b(made[- ]up|hypothetical|invent|for example|example with numbers)\b", last_user(messages), re.I))


# region: review
def review(messages: list, answer: str, skill: Optional[str] = None) -> dict:
    """What the loop calls. Returns ok, plus the corrective message and the fallback text."""
    mode = os.environ.get("GUARD_MODE", "enforce")             # enforce | observe | off
    used_tools = any(m.get("role") == "tool" for m in messages)
    data_turn = bool(skill and skill.startswith(DATA_SKILLS))
    retry = any(str(m.get("content") or "").startswith("[harness] These figures") for m in messages)
    verdict = check(answer, messages, strict=not retry)
    reason = None
    if mode == "off" or asks_for_example(messages):
        verdict["ok"], reason = True, "skipped"
    elif not used_tools and not data_turn:
        verdict["ok"], reason = True, "not a data turn"            # general knowledge may quote thresholds
    elif mode == "observe":
        reason, verdict["would_block"] = "observe", not verdict["ok"]
        verdict["ok"] = True
    figures = ", ".join(f"{v:,.2f}" for v in verdict["unsupported"])
    verdict["reason"] = reason
    verdict["corrective"] = (f"These figures are not in the evidence of this conversation: {figures}. "
                             "Rewrite the answer using only numbers the tools returned. "
                             "If the tools did not return a number, say so.")
    verdict["fallback"] = ("I ran the lookups but could not produce an answer whose figures all match the tool results. "
                           "Please ask again or narrow the question.")
    return verdict
# endregion
