"""Self-observation: find the agent's own failures in its logs, with no human labeling.

The dangerous failures return success codes. This job looks for shapes that can be
checked mechanically:

  recoverable_empty   a tool returned nothing, and the same call with one filter
                      removed returns rows. That is a parameter problem, and it is
                      provable by re-running the query.
  budget_exhaustion   the round budget ran out before an answer.
  blocked_call        a hook refused a tool call.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

from labs.m04_state.store import read_new_lines
from labs.m06_tools.registry import Registry


# region: observe
def observe(db: sqlite3.Connection, log_dir: Path, registry: Registry, day: str) -> list:
    """Read only the log lines not seen before (cursor), return findings tagged with the day."""
    findings = []
    for rec in read_new_lines(db, "observe:tool_calls", log_dir / "tool_calls.jsonl"):
        if rec.get("blocked"):
            findings.append({"signal": "blocked_call", "key": rec["tool"], "day": day})
        elif rec.get("empty") and rec.get("arguments"):
            for drop in rec["arguments"]:                       # confirm by re-running, minus one filter
                relaxed = {k: v for k, v in rec["arguments"].items() if k != drop}
                again = registry.call(rec["tool"], relaxed)
                if again.get("rows") or again.get("results"):
                    findings.append({"signal": "recoverable_empty", "key": f"{rec['tool']}.relax_{drop}", "day": day,
                                     "proof": f"{rec['arguments']} -> 0 rows; without {drop} -> {again.get('count', len(again.get('results', [])))} rows"})
                    break
    for rec in read_new_lines(db, "observe:requests", log_dir / "requests.jsonl"):
        if rec.get("budget_exhausted"):
            findings.append({"signal": "budget_exhaustion", "key": "rounds", "day": day})
    return findings
# endregion
