"""python3 -m labs.m15_ops.logs

Rotate a log that another job reads with a byte cursor. copytruncate keeps the
writer's file handle valid, and shrinks the file under the reader. A cursor that
does not notice the shrink silently skips every line written after rotation.
"""
from __future__ import annotations

import json
import shutil
import sqlite3
from pathlib import Path

from labs.common.paths import work
from labs.m04_state.store import append_log, ensure_schema, read_new_lines


# region: rotate
def rotate(log: Path, keep: int = 3, max_bytes: int = 2_000) -> bool:
    """Size-based copytruncate. log -> log.1 -> log.2 ... oldest dropped. Returns True if rotated."""
    if not log.exists() or log.stat().st_size < max_bytes:
        return False
    for i in range(keep - 1, 0, -1):
        older = log.with_name(f"{log.name}.{i}")
        if older.exists():
            older.replace(log.with_name(f"{log.name}.{i + 1}"))
    shutil.copy2(log, log.with_name(log.name + ".1"))
    with log.open("r+") as f:
        f.truncate(0)
    return True
# endregion


def naive_read(db: sqlite3.Connection, job: str, log: Path) -> list:
    """The cursor without the shrink check, kept here to show the failure."""
    row = db.execute("SELECT position FROM job_cursors WHERE job=?", (job,)).fetchone()
    pos = row[0] if row else 0
    with log.open("rb") as f:
        f.seek(pos)
        data = f.read()
    end = pos + data.rfind(b"\n") + 1 if b"\n" in data else pos
    db.execute("INSERT INTO job_cursors VALUES (?,?) ON CONFLICT(job) DO UPDATE SET position=excluded.position", (job, end))
    return [json.loads(x) for x in data[: end - pos].decode().splitlines() if x.strip()]


def main():
    w = work("m15l", fresh=True)
    db = sqlite3.connect(":memory:")
    ensure_schema(db)
    tools, server = w / "tool_calls.jsonl", w / "server.log"
    for i in range(40):
        append_log(tools, {"tool": "search_policy", "n": i})
        with server.open("a") as f:                     # probe noise goes to the server log, not the tool log
            f.write("GET /health 200\n" * 20)
    print("1 tool log", sum(1 for _ in tools.open()), "lines, only tool calls | server log",
          sum(1 for _ in server.open()), "lines of probe noise kept apart")
    a, b = naive_read(db, "naive", tools), read_new_lines(db, "fixed", tools)
    print("2 first read: naive cursor", len(a), "lines, fixed cursor", len(b), "lines")
    print("3 rotated:", rotate(tools), "| size now", tools.stat().st_size, "bytes | kept", sorted(p.name for p in w.glob("tool_calls.jsonl.*")))
    for i in range(3):
        append_log(tools, {"tool": "query_expenses", "n": 100 + i})
    print("4 after rotation and 3 new calls: naive cursor read", len(naive_read(db, "naive", tools)),
          "| fixed cursor read", len(read_new_lines(db, "fixed", tools)))
    for _ in range(5):
        for i in range(40):
            append_log(tools, {"tool": "search_policy", "n": i})
        rotate(tools)
    print("5 five more rotations: files", sorted(p.name for p in w.glob("tool_calls.jsonl*")),
          "| largest", max(p.stat().st_size for p in w.glob("tool_calls.jsonl*")), "bytes")


if __name__ == "__main__":
    main()
