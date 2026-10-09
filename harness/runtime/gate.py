"""Step 11. The action gate: every tool call passes through code that knows its tier.

Tiers come from contract.yml `actions:` (allow, ask, deny). The prompt also tells the model the rules,
but the prompt is a second line of defense. A model can be talked out of a rule; this function cannot.

  allow  run it
  ask    run it only if this run holds an approval for this exact action (tool plus arguments),
         and use that approval once; otherwise return needs_confirmation
  deny   never run it; return denied
  (a tool missing from the contract is denied, so a new tool must be classified before it works)

An approval is {"tool": "flag_expense", "args": {"id": "E-1007"}}: the arguments it names must match
the call. The harness records it from the user's own message in this conversation; in evals the case's
`approvals` list stands in for that record. A write that already ran is not run a second time with the
same arguments (a retry or a nudged turn must not create a duplicate).
"""
from __future__ import annotations

import json
from pathlib import Path

CONTRACT = Path(__file__).resolve().parent.parent / "contract.yml"


def load_tiers(path: Path = CONTRACT) -> dict[str, str]:
    """The actions: block of contract.yml, read without PyYAML."""
    tiers, inside = {}, False
    for raw in path.read_text().splitlines():
        line = raw.split("#")[0].rstrip()
        if not line.strip():
            continue
        if not line.startswith(" "):
            inside = line.startswith("actions:")
            continue
        if inside:
            k, _, v = line.strip().partition(":")
            if v.strip() not in ("allow", "ask", "deny"):
                raise ValueError(f"contract.yml actions.{k}: tier must be allow, ask or deny, not {v.strip()!r}")
            tiers[k] = v.strip()
    return tiers


def _matches(approval: dict, tool: str, args: dict) -> bool:
    if approval.get("tool") != tool:
        return False
    want = approval.get("args") or {}
    return all(str(args.get(k, "")).strip().lower() == str(v).strip().lower() for k, v in want.items())


def decide(tool: str, args: dict, tiers: dict[str, str], approvals: list[dict]) -> str:
    """allow | needs_confirmation | denied. Does not consume the approval; guarded() does."""
    tier = tiers.get(tool, "deny")
    if tier == "allow":
        return "allow"
    if tier == "ask":
        return "allow" if any(_matches(a, tool, args) for a in approvals) else "needs_confirmation"
    return "denied"


def guarded(execute, tiers: dict[str, str], approvals: list[dict] | None = None):
    """Wrap a tool executor so that every call is decided first. Returns (result, decision)."""
    pending = [dict(a) for a in (approvals or [])]
    done_writes: set[str] = set()

    def run(name: str, args: dict):
        key = name + json.dumps(args, sort_keys=True)
        if tiers.get(name) == "ask" and key in done_writes:
            return {"status": "already_done", "tool": name, "message": "This exact write already ran in this conversation."}, "duplicate"
        d = decide(name, args, tiers, pending)
        if d == "needs_confirmation":
            return {"status": "needs_confirmation", "tool": name,
                    "message": "Not run. Ask the user to approve this exact action in this conversation."}, d
        if d == "denied":
            return {"status": "denied", "tool": name, "message": "Not run. This agent may not use this tool."}, d
        if tiers.get(name) == "ask":
            pending.remove(next(a for a in pending if _matches(a, name, args)))       # an approval is used once
            done_writes.add(key)
        return execute(name, args), d
    return run
