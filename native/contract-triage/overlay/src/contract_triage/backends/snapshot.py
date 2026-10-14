"""Snapshot backend: DuckDB over the Parquet files in src/contract_triage/data/ (Blueprint 2.1, 1.9).

A judge can clone the repo and call every table tool with no Databricks login and no
API key. The files are exported from the gold views (pipelines/06_export_snapshot.py on
Databricks, or scripts/local_pipeline.py on a laptop).
"""

from __future__ import annotations

import re
import threading
from pathlib import Path
from typing import Any

import duckdb

from contract_triage.backends.base import SqlBackend, rows_to_dicts

TABLES = (
    "gold_offices",
    "gold_contracts_ending",
    "gold_closeout_candidates",
    "gold_vendor_share",
    "silver_awards",
    "meta_freshness",
)
_PARAM = re.compile(r":([a-z_]+)")


class SnapshotBackend(SqlBackend):
    name = "snapshot"

    def __init__(self, folder: Path) -> None:
        missing = [t for t in TABLES if not (folder / f"{t}.parquet").exists()]
        if missing:
            raise FileNotFoundError(
                f"snapshot is missing {', '.join(missing)} in {folder}. "
                "Build it with: uv run python scripts/local_pipeline.py --help"
            )
        self._con = duckdb.connect(":memory:")
        self._lock = threading.Lock()
        for t in TABLES:
            path = str(folder / f"{t}.parquet").replace("'", "''")
            self._con.execute(
                f"CREATE VIEW {t} AS SELECT * FROM read_parquet('{path}')"
            )

    def _run(self, sql: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        # DuckDB names parameters $name; the shared queries use :name.
        with self._lock:
            cur = self._con.execute(_PARAM.sub(r"$\1", sql), params or None)
            cols = [d[0] for d in cur.description]
            return rows_to_dicts(cols, cur.fetchall())
