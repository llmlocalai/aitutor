"""The nightly loop: observe -> gather evidence -> gate -> test on sealed evals -> apply or reject.

What it may change: one file of learned rules that is appended to the system prompt.
What it may never change: model weights, the sealed evals, or its own gate.
Default mode is 'report'. Nothing is applied until you run it with mode='apply'.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Callable

from labs.m06_tools.registry import Registry
from labs.m11_eval import agent_eval
from labs.m13_evolve.observe import observe
from labs.m13_evolve.promote import add_evidence, ready_for_promotion


def read_rules(path: Path) -> str:
    return path.read_text() if path.exists() else ""


# region: nightly
def nightly(db: sqlite3.Connection, log_dir: Path, registry: Registry, eval_dir: Path, rules_path: Path,
            make_agent: Callable[[str], object], day: str, mode: str = "report") -> dict:
    """make_agent(rules_text) builds an agent whose prompt includes those rules."""
    report = {"day": day, "mode": mode, "applied": [], "rejected": [], "pending": []}

    findings = observe(db, log_dir, registry, day)                       # 1 look at yesterday
    report["findings"] = [f["key"] for f in findings if f["signal"] == "recoverable_empty"]
    add_evidence(db, findings)                                           # 2 one piece of evidence per day

    for cand in ready_for_promotion(db):                                 # 3 the gate
        current = read_rules(rules_path)
        proposed = current + cand["rule"] + "\n"
        before = agent_eval.run(lambda rep: make_agent(current), eval_dir)       # 4 sealed eval, without
        after = agent_eval.run(lambda rep: make_agent(proposed), eval_dir)       #   and with the change
        entry = {"key": cand["key"], "days": cand["days"], "before": before["totals"][0], "after": after["totals"][0]}
        if after["totals"][0] < before["totals"][0]:
            db.execute("UPDATE brain_claims SET status='retired' WHERE claim_id=?", (cand["claim_id"],))
            report["rejected"].append(entry)                             # worse on the sealed set: never applied
        elif mode == "apply":
            rules_path.write_text(proposed)                              # 5 the only file this loop writes
            db.execute("UPDATE brain_claims SET status='trusted' WHERE claim_id=?", (cand["claim_id"],))
            report["applied"].append(entry)
        else:
            report["pending"].append(entry)                              # report mode: a human decides
    db.commit()
    return report
# endregion
