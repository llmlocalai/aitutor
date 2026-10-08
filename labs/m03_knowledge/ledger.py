"""Knowledge intake: validate, file, record, tier, retire.

Nothing here touches a model. This is the librarianship that retrieval depends on.
"""
from __future__ import annotations

import fnmatch
import hashlib
import json
import shutil
import sqlite3
from pathlib import Path
from typing import Optional

# region: validate
MAGIC = {".pdf": b"%PDF-", ".zip": b"PK\x03\x04", ".docx": b"PK\x03\x04"}
TEXT_TYPES = {".md", ".txt"}


def validate(path: Path) -> Optional[str]:
    """Return None when the file is what its name claims, else the reason it is not."""
    ext = path.suffix.lower()
    head = path.read_bytes()[:512]
    if not head.strip():
        return "empty file"
    if ext in MAGIC:
        return None if head.startswith(MAGIC[ext]) else f"not a real {ext} file (wrong leading bytes)"
    if ext in TEXT_TYPES:
        low = head.lstrip().lower()
        return "an HTML page saved as text" if low.startswith((b"<!doctype html", b"<html")) else None
    return f"unsupported type {ext}"
# endregion


# region: tiers
DEFAULT_RULES = [            # first match wins; lower tier = more authoritative
    {"pattern": "policy/*", "tier": 1, "kind": "rule"},
    {"pattern": "guides/*", "tier": 2, "kind": "guide"},
    {"pattern": "memos/*",  "tier": 3, "kind": "commentary"},
]


def authority(source: str, rules: Optional[list] = None) -> dict:
    for r in rules or DEFAULT_RULES:
        if fnmatch.fnmatch(source, r["pattern"]):
            return {"tier": r["tier"], "kind": r["kind"]}
    return {"tier": 3, "kind": "unclassified"}
# endregion


# region: ledger
class Ledger:
    """One row per file: what it is, where it is, and what state it is in."""

    def __init__(self, db_path: Path):
        self.db = sqlite3.connect(str(db_path))
        self.db.execute("""CREATE TABLE IF NOT EXISTS files (
            collection TEXT NOT NULL, source TEXT NOT NULL, sha256 TEXT NOT NULL,
            tier INTEGER NOT NULL, kind TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'filed',      -- filed | indexed | retired | rejected
            note TEXT, PRIMARY KEY (collection, source))""")
        self.db.commit()

    def record(self, collection: str, source: str, sha: str, status: str = "filed", note: str = "") -> str:
        old = self.db.execute("SELECT sha256, status FROM files WHERE collection=? AND source=?",
                              (collection, source)).fetchone()
        if old and old[0] == sha and old[1] != "rejected":
            return "unchanged"
        a = authority(source)
        self.db.execute("INSERT OR REPLACE INTO files VALUES (?,?,?,?,?,?,?)",
                        (collection, source, sha, a["tier"], a["kind"], status, note))
        self.db.commit()
        return "updated" if old else "new"

    def retire(self, collection: str, source: str, reason: str) -> None:
        self.db.execute("UPDATE files SET status='retired', note=? WHERE collection=? AND source=?",
                        (reason, collection, source))
        self.db.commit()

    def rows(self, collection: str, status: Optional[str] = None) -> list:
        q = "SELECT source, tier, kind, status, note FROM files WHERE collection=?"
        args = [collection]
        if status:
            q += " AND status=?"
            args.append(status)
        return self.db.execute(q + " ORDER BY tier, source", args).fetchall()
# endregion


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# region: intake
def scan_bank(ledger: Ledger, collection: str, bank: Path) -> dict:
    """Record every file already in the bank. Safe to run again: unchanged files are skipped."""
    counts = {"new": 0, "updated": 0, "unchanged": 0, "rejected": 0}
    for p in sorted(bank.rglob("*")):
        if not p.is_file():
            continue
        source = p.relative_to(bank).as_posix()
        problem = validate(p)
        if problem:
            ledger.record(collection, source, sha256(p), "rejected", problem)
            counts["rejected"] += 1
        else:
            counts[ledger.record(collection, source, sha256(p))] += 1
    return counts


def process_inbox(ledger: Ledger, collection: str, inbox: Path, bank: Path, routing: dict) -> list:
    """Validate each inbox file. Good files move into the bank folder named by `routing`
    (file name -> subfolder). Bad files stay put and are recorded as rejected."""
    report = []
    for p in sorted(inbox.iterdir()):
        problem = validate(p)
        if problem:
            ledger.record(collection, "_inbox/" + p.name, sha256(p), "rejected", problem)
            report.append((p.name, "REJECTED", problem))
            continue
        dest = bank / routing.get(p.name, "memos") / p.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dest)
        state = ledger.record(collection, dest.relative_to(bank).as_posix(), sha256(dest))
        report.append((p.name, "FILED", f"{dest.relative_to(bank).as_posix()} ({state})"))
    return report
# endregion


def dump(ledger: Ledger, collection: str) -> str:
    return json.dumps([dict(zip(("source", "tier", "kind", "status", "note"), r))
                       for r in ledger.rows(collection)], indent=1)
