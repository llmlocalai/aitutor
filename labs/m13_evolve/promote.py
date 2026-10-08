"""The promotion gate: a finding becomes a rule only with independent support.

Evidence is keyed by (claim, origin, day). The same failure ten times in one day
is one piece of evidence. The same failure on three separate days is three.
"""
from __future__ import annotations

import sqlite3

DAYS_REQUIRED = 3

# What each confirmed lesson turns into: one line the agent will be told.
RULE_TEXT = {
    "query_expenses.relax_month": ("RULE query_expenses.relax_month: when the month filter empties a result, "
                                   "run the query again without month and report what exists."),
    "query_expenses.relax_city": ("RULE query_expenses.relax_city: when the city filter empties a result, "
                                  "run the query again without city and report what exists."),
}


# region: gate
def add_evidence(db: sqlite3.Connection, findings: list) -> None:
    for f in findings:
        if f["signal"] != "recoverable_empty":
            continue
        db.execute("INSERT OR IGNORE INTO brain_claims (kind, text, source_ref, status, formed_at) VALUES (?,?,?,?,?)",
                   ("self_observation", f["key"], "logs/tool_calls.jsonl", "candidate", f["day"]))
        claim_id = db.execute("SELECT claim_id FROM brain_claims WHERE kind='self_observation' AND text=?",
                              (f["key"],)).fetchone()[0]
        db.execute("INSERT OR IGNORE INTO brain_evidence VALUES (?,?,?)", (claim_id, "self", f["day"]))  # one per day
    db.commit()


def ready_for_promotion(db: sqlite3.Connection) -> list:
    """Candidates seen on enough distinct days."""
    rows = db.execute("""SELECT c.claim_id, c.text, count(DISTINCT e.day) FROM brain_claims c
                         JOIN brain_evidence e USING (claim_id)
                         WHERE c.status='candidate' GROUP BY c.claim_id HAVING count(DISTINCT e.day) >= ?""",
                      (DAYS_REQUIRED,)).fetchall()
    return [{"claim_id": r[0], "key": r[1], "days": r[2], "rule": RULE_TEXT.get(r[1])} for r in rows if r[1] in RULE_TEXT]


def standing(db: sqlite3.Connection) -> list:
    return db.execute("""SELECT c.text, c.status, count(DISTINCT e.day) FROM brain_claims c
                         LEFT JOIN brain_evidence e USING (claim_id) GROUP BY c.claim_id ORDER BY c.claim_id""").fetchall()
# endregion
