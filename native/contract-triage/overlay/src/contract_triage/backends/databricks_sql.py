"""Databricks backend: gold views through a SQL warehouse (Blueprint 2.1, 3.1, 3.2).

Inside a Databricks App the platform injects DATABRICKS_HOST, DATABRICKS_CLIENT_ID and
DATABRICKS_CLIENT_SECRET for the app's own service principal. The SDK's Config() reads
them, and the SQL connector asks it for a fresh OAuth header on each connection. The
warehouse id arrives through app.yaml `valueFrom: sql_warehouse`. On a laptop the same
code works with your CLI profile (DATABRICKS_CONFIG_PROFILE).
"""

from __future__ import annotations

from typing import Any

from contract_triage.backends.base import SqlBackend, rows_to_dicts


class DatabricksSqlBackend(SqlBackend):
    name = "databricks"

    def __init__(self, warehouse_id: str, catalog: str, schema: str) -> None:
        if not (warehouse_id and catalog and schema):
            raise ValueError(
                "DATA_BACKEND=databricks needs DATABRICKS_WAREHOUSE_ID, "
                "DATABRICKS_CATALOG and DATABRICKS_SCHEMA"
            )
        from databricks.sdk.core import (
            Config,
        )  # imported here: snapshot mode needs neither

        self._cfg = Config()
        self._http_path = f"/sql/1.0/warehouses/{warehouse_id}"
        # Catalog and schema were checked as plain identifiers in config.py.
        self.prefix = f"`{catalog}`.`{schema}`."

    def _run(self, sql: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        from databricks import sql as dbsql

        host = self._cfg.host.replace("https://", "").rstrip("/")
        with (
            dbsql.connect(
                server_hostname=host,
                http_path=self._http_path,
                credentials_provider=lambda: self._cfg.authenticate,
            ) as conn,
            conn.cursor() as cur,
        ):
            cur.execute(sql, params or None)  # native :name parameters
            cols = [d[0] for d in cur.description]
            return rows_to_dicts(cols, [tuple(r) for r in cur.fetchall()])
