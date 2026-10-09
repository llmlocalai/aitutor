"""Run a SQL file against one environment: substitute the catalog, split into statements, execute each.

The SQL files are written for fin_dev so they run as they are in the SQL editor. CI and the per-environment
setup run them through this script, which replaces the catalog name, so stg and prd never read dev tables
by accident.

  python apply_sql.py --file src/tools/functions.sql --catalog fin_stg --warehouse-id <id>

split_statements() and for_catalog() are pure and tested.
"""
from __future__ import annotations

import argparse
import re

DEV_CATALOG = "fin_dev"


def for_catalog(sql: str, catalog: str) -> str:
    if not re.fullmatch(r"[a-z][a-z0-9_]*", catalog):
        raise ValueError(f"not a catalog name: {catalog!r}")
    return re.sub(rf"\b{DEV_CATALOG}\b", catalog, sql)


def split_statements(sql: str) -> list:
    """Split on semicolons outside quotes, backticks, $$ blocks and -- comments. Drops comment-only pieces."""
    out, buf, i, n = [], [], 0, len(sql)
    quote = None                      # "'", '"', '`' or '$$'
    while i < n:
        c = sql[i]
        if quote:
            if quote == "$$" and sql.startswith("$$", i):
                buf.append("$$"); i += 2; quote = None; continue
            buf.append(c)
            if quote != "$$" and c == quote:
                quote = None
            i += 1
            continue
        if sql.startswith("--", i):
            j = sql.find("\n", i)
            j = n if j < 0 else j
            buf.append(sql[i:j]); i = j; continue
        if sql.startswith("$$", i):
            quote = "$$"; buf.append("$$"); i += 2; continue
        if c in ("'", '"', "`"):
            quote = c
        if c == ";":
            out.append("".join(buf)); buf = []; i += 1; continue
        buf.append(c); i += 1
    out.append("".join(buf))
    keep = []
    for s in out:
        body = "\n".join(l for l in s.splitlines() if not l.strip().startswith("--")).strip()
        if body:
            keep.append(s.strip())
    return keep


def main() -> None:  # pragma: no cover
    from databricks.sdk import WorkspaceClient

    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--warehouse-id", required=True)
    a = ap.parse_args()
    w = WorkspaceClient()
    stmts = split_statements(for_catalog(open(a.file).read(), a.catalog))
    for k, st in enumerate(stmts, 1):
        r = w.statement_execution.execute_statement(statement=st, warehouse_id=a.warehouse_id, wait_timeout="50s")
        state = r.status.state.value if r.status and r.status.state else "?"
        print(f"{k:3}/{len(stmts)} {state:10} {st.splitlines()[0][:90]}")
        if state not in ("SUCCEEDED",):
            msg = r.status.error.message if r.status and r.status.error else ""
            raise SystemExit(f"statement {k} failed: {msg}")


if __name__ == "__main__":  # pragma: no cover
    main()
