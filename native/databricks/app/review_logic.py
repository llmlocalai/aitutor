"""Decision rules for the reviewer app. Pure Python, tested by tests/test_native.py.

The rules a payment control needs, enforced in code the reviewer cannot bypass from the browser:
  - a reviewer decides only proposals in their business units
  - above the two-person threshold, approval needs a second, different approver
  - nobody approves a proposal twice, and nobody decides a proposal that is not live
"""
from __future__ import annotations

import html
from urllib.parse import urlparse

LIVE = {"pending", "needs_second"}


ACTIONS = ("approve_payment", "hold_payment", "request_credit_memo", "escalate")


def decide(proposal: dict, reviewer: str, verdict: str, my_units: set, prior_approvers: list,
           two_person_threshold: float, correct_action: str | None = None) -> tuple:
    """Returns (new_status, decision_verdict) or raises PermissionError / ValueError with the reason.
    A rejection must name the action that should have been proposed: that is the label the eval set needs."""
    if verdict not in ("approve", "reject"):
        raise ValueError(f"unknown verdict {verdict!r}")
    if proposal["business_unit"] not in my_units:
        raise PermissionError("this proposal belongs to a business unit you do not review")
    if proposal["status"] not in LIVE:
        raise ValueError(f"proposal is {proposal['status']}, not open for decision")
    if verdict == "reject":
        if correct_action not in ACTIONS:
            raise ValueError("a rejection must say which action is correct")
        if correct_action == proposal.get("action"):
            raise ValueError("the correct action equals the proposed one; approve it instead")
        return "rejected", "reject"
    if reviewer in prior_approvers:
        raise PermissionError("you already approved this proposal; a second approver must be someone else")
    big = float(proposal["invoice_amount"]) > two_person_threshold      # contract: second_approver_above
    if big and proposal["status"] == "pending":
        return "needs_second", "approve"
    if proposal["status"] == "needs_second":
        return "approved", "second_approve"
    return "approved", "approve"


def row_html(p: dict) -> str:
    """One queue row. Everything model-written is escaped: a rationale is untrusted text."""
    e = lambda v: html.escape(str(v if v is not None else ""))  # noqa: E731
    cites = ", ".join(e(c) for c in (p.get("citations") or []))
    return (f"<tr><td>{e(p['exception_type'])}</td><td>{e(p['business_unit'])}</td>"
            f"<td class=num>{float(p['invoice_amount']):,.2f}</td><td><b>{e(p['action'])}</b>"
            f"<div class=why>{e(p['rationale'])}</div><div class=cite>{cites}</div></td>"
            f"<td>{float(p['confidence']):.2f}</td><td>{e(p['status'])}</td>"
            f"<td><form method=post action='/decide/{e(p['proposal_id'])}'>"
            f"<button name=verdict value=approve>Approve</button>"
            f"<select name=correct_action><option value=''>if rejecting, correct action</option>"
            + "".join(f"<option>{a}</option>" for a in ACTIONS) +
            f"</select><button name=verdict value=reject>Reject</button></form></td></tr>")


def same_origin(origin: str | None, referer: str | None, host: str | None, forwarded_host: str | None,
                extra_hosts: str = "") -> bool:
    """A decision must come from this app's own page (CSRF). Browsers send Origin on form posts.
    Behind the Apps proxy the Host header may be the internal address, so the public name can arrive
    in X-Forwarded-Host instead; accept either, plus APP_HOSTS (comma-separated) if set. No Origin and
    no Referer is refused: a form post from a real browser carries one of them."""
    source = origin or referer or ""
    netloc = urlparse(source).netloc.lower()
    if not netloc:
        return False
    allowed = {h.strip().lower() for h in [host or "", *(forwarded_host or "").split(","), *extra_hosts.split(",")]
               if h.strip()}
    return netloc in allowed
