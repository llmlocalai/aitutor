"""Lakebase connection pool with OAuth credentials (pattern from the vendor's "connect an external app" page).

Both the workspace OAuth token and the database credential expire after 60 minutes. The pool
asks for a fresh credential each time it opens a connection and recycles connections at
45 minutes, so no connection outlives its password.

  pip install "psycopg[binary,pool]" databricks-sdk
Environment: DATABRICKS_HOST, DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET (a service principal),
             ENDPOINT_NAME, PGHOST, PGDATABASE, PGUSER (= the service principal's client ID).
Inside a Databricks App with a Lakebase resource attached, the platform sets the PG* variables.
"""
from __future__ import annotations

import os
import sys
from functools import lru_cache

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import Config  # noqa: E402


@lru_cache(maxsize=1)
def _workspace():
    from databricks.sdk import WorkspaceClient
    return WorkspaceClient()        # reads DATABRICKS_HOST / CLIENT_ID / CLIENT_SECRET, or the CLI profile


@lru_cache(maxsize=1)
def pool():
    import psycopg
    from psycopg_pool import ConnectionPool

    cfg = Config()
    if not (cfg.pg_endpoint and cfg.pg_host and cfg.pg_user):
        raise RuntimeError("Lakebase is not configured: set ENDPOINT_NAME, PGHOST and PGUSER")

    class OAuthConnection(psycopg.Connection):
        @classmethod
        def connect(cls, conninfo="", **kwargs):
            cred = _workspace().postgres.generate_database_credential(endpoint=cfg.pg_endpoint)
            kwargs["password"] = cred.token
            return super().connect(conninfo, **kwargs)

    conninfo = (f"dbname={cfg.pg_database} user={cfg.pg_user} host={cfg.pg_host} "
                f"port={os.environ.get('PGPORT', '5432')} sslmode={os.environ.get('PGSSLMODE', 'require')}")
    return ConnectionPool(conninfo, connection_class=OAuthConnection, min_size=1, max_size=10,
                          max_lifetime=45 * 60, open=True)
