"""Lakebase connection pool with OAuth credentials (pattern from the vendor's "connect an external app" page).

Database credentials expire after 60 minutes, so the pool mints one per new connection and recycles
connections at 45 minutes. Inside a Databricks App with a Lakebase resource the platform sets the PG*
variables; ENDPOINT_NAME comes from the Lakebase console Connect dialog.
"""
from __future__ import annotations

import os
from functools import lru_cache


@lru_cache(maxsize=1)
def pool():  # pragma: no cover - needs a workspace
    import psycopg
    from databricks.sdk import WorkspaceClient
    from psycopg_pool import ConnectionPool

    endpoint = os.environ["ENDPOINT_NAME"]
    w = WorkspaceClient()

    class OAuthConnection(psycopg.Connection):
        @classmethod
        def connect(cls, conninfo="", **kwargs):
            kwargs["password"] = w.postgres.generate_database_credential(endpoint=endpoint).token
            return super().connect(conninfo, **kwargs)

    user = os.environ.get("PGUSER") or os.environ["DATABRICKS_CLIENT_ID"]   # the principal's own Postgres role
    conninfo = (f"dbname={os.environ.get('PGDATABASE', 'databricks_postgres')} user={user} "
                f"host={os.environ['PGHOST']} port={os.environ.get('PGPORT', '5432')} "
                f"sslmode={os.environ.get('PGSSLMODE', 'require')}")
    return ConnectionPool(conninfo, connection_class=OAuthConnection, min_size=1, max_size=10,
                          max_lifetime=45 * 60, open=True)


def add_args(ap) -> None:
    """Job tasks get connection settings as parameters (serverless job tasks have no app resources)."""
    ap.add_argument("--warehouse-id", default=os.environ.get("DATABRICKS_WAREHOUSE_ID", ""))
    ap.add_argument("--pg-endpoint", default=os.environ.get("ENDPOINT_NAME", ""))
    ap.add_argument("--pg-host", default=os.environ.get("PGHOST", ""))
    ap.add_argument("--pg-user", default=os.environ.get("PGUSER", ""), help="the job service principal's client id")


def apply_args(a) -> None:
    for env, val in (("DATABRICKS_WAREHOUSE_ID", a.warehouse_id), ("ENDPOINT_NAME", a.pg_endpoint),
                     ("PGHOST", a.pg_host), ("PGUSER", a.pg_user)):
        if val:
            os.environ[env] = val
