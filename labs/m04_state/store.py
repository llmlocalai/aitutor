"""State: the three lifetimes, one database, and rules for concurrent writers.

  run state           one request      a dict, merged by rule (merge_state)
  conversation state  one thread       rows in conv_turns
  durable state       until retired    kb_* (ingested), brain_* (learned), mem_* (per user)

Table prefixes mark ownership. Dropping every brain_* table removes what the
agent taught itself and leaves ingested documents untouched.
"""
from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path

# region: connect
def connect(path: Path) -> sqlite3.Connection:
    """WAL lets readers proceed while one writer writes. busy_timeout makes a second
    writer wait its turn instead of failing with 'database is locked'."""
    db = sqlite3.connect(str(path), timeout=30, check_same_thread=False)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA busy_timeout=30000")
    db.execute("PRAGMA foreign_keys=ON")
    return db
# endregion


# region: schema
SCHEMA = """
CREATE TABLE IF NOT EXISTS kb_chunks (
  chunk_id TEXT PRIMARY KEY,            -- "<source>::<n>"
  collection TEXT NOT NULL, source TEXT NOT NULL, chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL, context TEXT, embedding TEXT,   -- JSON list of floats
  tier INTEGER NOT NULL DEFAULT 3, retired INTEGER NOT NULL DEFAULT 0, heldout INTEGER NOT NULL DEFAULT 0);
CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(chunk_id UNINDEXED, collection UNINDEXED, body);
CREATE TABLE IF NOT EXISTS kb_edges (
  from_key TEXT NOT NULL, to_chunk TEXT NOT NULL, relation TEXT NOT NULL,   -- 'defines' | 'cites'
  PRIMARY KEY (from_key, to_chunk, relation));

CREATE TABLE IF NOT EXISTS brain_claims (
  claim_id INTEGER PRIMARY KEY, kind TEXT NOT NULL, text TEXT NOT NULL, source_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate',   -- candidate | trusted | unsupported | retired
  formed_at TEXT NOT NULL, UNIQUE (kind, text));
CREATE TABLE IF NOT EXISTS brain_evidence (
  claim_id INTEGER NOT NULL REFERENCES brain_claims(claim_id), origin TEXT NOT NULL, day TEXT NOT NULL,
  PRIMARY KEY (claim_id, origin, day));

CREATE TABLE IF NOT EXISTS mem_facts (
  partition TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated_at REAL NOT NULL,
  PRIMARY KEY (partition, key));
CREATE TABLE IF NOT EXISTS conv_turns (
  turn_id INTEGER PRIMARY KEY, partition TEXT NOT NULL, thread TEXT NOT NULL,
  role TEXT NOT NULL, content TEXT NOT NULL, ts REAL NOT NULL);

CREATE TABLE IF NOT EXISTS job_cursors (job TEXT PRIMARY KEY, position INTEGER NOT NULL);
"""


def ensure_schema(db: sqlite3.Connection) -> None:
    db.executescript(SCHEMA)      # idempotent: safe to run on every start
    db.commit()
# endregion


# region: merge
EXTEND_KEYS = {"messages_append", "tools_used_append", "findings_append"}          # concurrent nodes each add items
SUM_KEYS = {"prompt_tokens", "completion_tokens", "model_calls"}   # concurrent nodes each add a number


def merge_state(state: dict, update: dict) -> None:
    """Apply one node's update to shared run state without losing a sibling's update."""
    for key, value in update.items():
        if key in EXTEND_KEYS:
            state.setdefault(key[: -len("_append")], []).extend(value)
        elif key in SUM_KEYS:
            state[key] = state.get(key, 0) + value
        else:
            state[key] = value                               # last writer wins, on purpose
# endregion


# region: cursor
def read_new_lines(db: sqlite3.Connection, job: str, log_path: Path) -> list:
    """Return log lines this job has not seen, then advance its cursor. A job that
    crashes and restarts resumes where it stopped and never handles a line twice."""
    row = db.execute("SELECT position FROM job_cursors WHERE job=?", (job,)).fetchone()
    pos = row[0] if row else 0
    if not log_path.exists():
        return []
    if log_path.stat().st_size < pos:     # the file was rotated (copied, then truncated): start over
        pos = 0
    with log_path.open("rb") as f:
        f.seek(pos)
        data = f.read()
        end = pos + data.rfind(b"\n") + 1 if b"\n" in data else pos     # only whole lines
    lines = [json.loads(x) for x in data[: end - pos].decode().splitlines() if x.strip()]
    db.execute("INSERT INTO job_cursors VALUES (?,?) ON CONFLICT(job) DO UPDATE SET position=excluded.position",
               (job, end))
    db.commit()
    return lines
# endregion


def append_log(log_path: Path, record: dict) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a") as f:
        f.write(json.dumps({"ts": round(time.time(), 3), **record}) + "\n")
