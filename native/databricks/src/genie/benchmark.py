"""Step 11. Benchmark the Genie space before any agent or person relies on it.

Each benchmark is a question plus the SQL a finance analyst agrees is correct. The script asks Genie
the question through the Conversation API, runs Genie's SQL and the reference SQL on the same
warehouse, and compares the result sets. Genie's built-in benchmarks do the same in the UI; this
version runs in CI, so a change to a table comment or an instruction cannot silently break answers.

  python benchmark.py --space-id <id> --warehouse-id <id> --file genie_benchmarks.json
"""
from __future__ import annotations

import argparse
import json
import os
import time
from decimal import Decimal


def _norm_cell(v):
    if v is None:
        return None
    try:
        return round(float(Decimal(str(v))), 2)            # 1250, "1250.00" and 1250.0 are the same answer
    except Exception:                                       # noqa: BLE001
        return str(v).strip().lower()


def same_result(a: list, b: list) -> bool:
    """Row sets equal ignoring row order, column names, and numeric formatting."""
    norm = lambda rows: sorted(tuple(_norm_cell(c) for c in r) for r in rows)  # noqa: E731
    return norm(a) == norm(b)


def score(results: list) -> dict:
    n = len(results)
    ok = sum(1 for r in results if r["match"])
    return {"questions": n, "correct": ok, "accuracy": round(ok / n, 3) if n else 0.0,
            "failed": [r["question"] for r in results if not r["match"]]}


def _run_sql(w, warehouse_id: str, sql: str) -> list:  # pragma: no cover
    res = w.statement_execution.execute_statement(statement=sql, warehouse_id=warehouse_id, wait_timeout="50s")
    return (res.result.data_array or []) if res.result else []


def ask(w, space_id: str, question: str):  # pragma: no cover
    """Genie's SQL for a question, or None if it answered in text only."""
    msg = w.genie.start_conversation_and_wait(space_id, question)
    for att in msg.attachments or []:
        q = getattr(att, "query", None)
        if q is not None and getattr(q, "query", None):
            return q.query
    return None


def main() -> None:  # pragma: no cover
    from databricks.sdk import WorkspaceClient

    ap = argparse.ArgumentParser()
    ap.add_argument("--space-id", required=True)
    ap.add_argument("--warehouse-id", required=True)
    ap.add_argument("--file", required=True)
    ap.add_argument("--min-accuracy", type=float, default=0.9)
    ap.add_argument("--catalog", default="fin_dev", help="reference SQL is written for fin_dev; substituted here")
    a = ap.parse_args()
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from common.apply_sql import for_catalog
    w = WorkspaceClient()
    results = []
    path = a.file if os.path.isabs(a.file) else os.path.join(os.path.dirname(os.path.abspath(__file__)), a.file)
    for b in json.load(open(path)):
        t0 = time.time()
        sql = ask(w, a.space_id, b["question"])
        got = _run_sql(w, a.warehouse_id, sql) if sql else []
        want = _run_sql(w, a.warehouse_id, for_catalog(b["sql"], a.catalog))
        results.append({"question": b["question"], "match": bool(sql) and same_result(got, want),
                        "seconds": round(time.time() - t0, 1), "genie_sql": sql})
        print(f"{'PASS' if results[-1]['match'] else 'FAIL'} {results[-1]['seconds']:5.1f}s  {b['question']}")
    s = score(results)
    print(json.dumps(s, indent=2))
    raise SystemExit(0 if s["accuracy"] >= a.min_accuracy else 1)


if __name__ == "__main__":  # pragma: no cover
    main()
