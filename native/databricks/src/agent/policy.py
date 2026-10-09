"""What the agent may propose, and the checks every proposal passes before it reaches the queue.

Pure Python. The model proposes; this module decides whether the proposal is admissible.
A proposal that fails is never written: the agent gets the reasons and one retry, then the
exception is escalated with the reasons attached (the same pattern as the local answer guard).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

MONEY = re.compile(r"(?:\$\s?([\d,]+(?:\.\d+)?))|(?:([\d,]+(?:\.\d+)?)\s*(?:dollars|usd)\b)", re.I)
NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")

# Which actions make sense for which exception type. A model that proposes approve_payment for a
# suspected duplicate is wrong whatever its rationale says.
ALLOWED = {
    "price_variance": {"approve_payment", "hold_payment", "request_credit_memo", "escalate"},
    "quantity_variance": {"hold_payment", "request_credit_memo", "escalate"},
    "no_receipt": {"hold_payment", "escalate"},
    "duplicate_suspect": {"hold_payment", "escalate"},
    "doc_mismatch": {"hold_payment", "escalate"},
    "no_po": {"hold_payment", "escalate"},
}
NEEDS_POLICY = {"approve_payment", "request_credit_memo"}   # must cite the policy that permits it
CONFIDENCE_FLOOR = 0.6


@dataclass
class Proposal:
    exception_id: str
    exception_type: str
    action: str
    rationale: str
    citations: list = field(default_factory=list)      # policy chunk ids or document references
    confidence: float = 0.0


def _num(s: str) -> float:
    return float(s.replace(",", ""))


def figures(text: str) -> list:
    return [_num(a or b) for a, b in MONEY.findall(text or "")]


def evidence_numbers(evidence: list) -> list:
    out = []
    for e in evidence:
        out += [_num(x) for x in NUMBER.findall(str(e))]
    return out


def grounded(value: float, ev: list) -> bool:
    """In the evidence, or the difference or sum of two evidence numbers (a variance is a difference)."""
    near = lambda a, b: abs(a - b) <= 0.005 * max(1.0, abs(b))  # noqa: E731
    if any(near(value, e) for e in ev):
        return True
    small = sorted(set(ev))[:400]
    return any(near(value, a + b) or near(value, abs(a - b)) for i, a in enumerate(small) for b in small[i:])


def review(p: Proposal, evidence: list, contract_actions: list) -> list:
    """Reasons the proposal is inadmissible. Empty list means it may be queued for a human."""
    reasons = []
    if p.action not in contract_actions:
        reasons.append(f"action '{p.action}' is not in the contract")
    allowed = ALLOWED.get(p.exception_type)
    if allowed is None:
        reasons.append(f"unknown exception type '{p.exception_type}'")
    elif p.action not in allowed:
        reasons.append(f"'{p.action}' is not allowed for {p.exception_type}; allowed: {sorted(allowed)}")
    if p.action in NEEDS_POLICY and not p.citations:
        reasons.append(f"'{p.action}' needs a policy citation")
    ev = evidence_numbers(evidence)
    bad = [v for v in figures(p.rationale) if not grounded(v, ev)]
    if bad:
        reasons.append("figures not in the evidence: " + ", ".join(f"{v:,.2f}" for v in bad))
    if not (0.0 <= p.confidence <= 1.0):
        reasons.append("confidence must be between 0 and 1")
    elif p.confidence < CONFIDENCE_FLOOR and p.action != "escalate":
        reasons.append(f"confidence {p.confidence:.2f} is below {CONFIDENCE_FLOOR}; escalate instead")
    if len((p.rationale or "").strip()) < 20:
        reasons.append("rationale too short to review")
    return reasons


def needs_second_approver(amount: float, threshold: float) -> bool:
    """contract.yml: second_approver_above. Strictly above: an invoice of exactly the threshold needs one approver."""
    return amount > threshold
