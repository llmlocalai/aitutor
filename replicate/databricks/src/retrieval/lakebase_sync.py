"""Step 10 (Lakebase backend). Copy the chunk table into Lakebase Postgres, embedding column as vector(n).

The local build keeps chunks in Postgres with pgvector and runs hybrid SQL there (module 5).
This is the nearest copy of that on Databricks: Delta stays the source of truth, a synced table
puts the rows in Postgres, and Lakebase Search adds the vector (ANN) and BM25 indexes.

Before running: create a Lakebase project (Autoscaling), note its branch path, and run
  CREATE EXTENSION IF NOT EXISTS lakebase_vector CASCADE;   (in the Postgres database)
Run:  python lakebase_sync.py --branch projects/<project>/branches/production --database <db>
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import Config  # noqa: E402


def main(argv: list) -> None:  # pragma: no cover - runs against a workspace
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.service.postgres import (
        SyncedTable,
        SyncedTableSyncedTableSpec,
        SyncedTableSyncedTableSpecSyncedTableSchedulingPolicy,
    )

    ap = argparse.ArgumentParser()
    ap.add_argument("--branch", required=True)
    ap.add_argument("--database", required=True)
    ap.add_argument("--target", default=None, help="UC name for the synced table, default <catalog>.kb.chunks_pg")
    args = ap.parse_args(argv)
    cfg = Config()
    target = args.target or cfg.table(cfg.kb_schema, "chunks_pg")

    spec = SyncedTableSyncedTableSpec(
        source_table_full_name=cfg.chunks,
        branch=args.branch,
        primary_key_columns=["chunk_id"],
        # TRIGGERED: incremental, including deletes; needs change data feed on the source (01_catalog.sql enables it).
        scheduling_policy=SyncedTableSyncedTableSpecSyncedTableSchedulingPolicy.TRIGGERED,
        postgres_database=args.database,
        create_database_objects_if_missing=True,
    )
    # The embedding column must arrive as vector(n), not as a Postgres float array, or no ANN index can use it.
    # The vendor page shows this as "type_overrides" in the JSON spec. If your SDK version does not accept the
    # keyword, create the synced table with the CLI command printed below instead.
    overrides = [{"column_name": "embedding", "pg_type": "PG_SPECIFIC_TYPE_VECTOR", "size": cfg.embedding_dim}]
    try:
        spec.type_overrides = overrides            # type: ignore[attr-defined]
    except Exception:                              # noqa: BLE001
        pass
    w = WorkspaceClient()
    try:
        st = w.postgres.create_synced_table(synced_table=SyncedTable(spec=spec), synced_table_id=target).wait()
        print("synced table created:", st.name)
    except Exception as e:                         # noqa: BLE001
        print("SDK create failed:", type(e).__name__, str(e)[:300])
        print("Equivalent CLI:")
        print(f"""databricks postgres create-synced-table {target} --json '{{
  "spec": {{
    "source_table_full_name": "{cfg.chunks}",
    "branch": "{args.branch}",
    "primary_key_columns": ["chunk_id"],
    "scheduling_policy": "TRIGGERED",
    "postgres_database": "{args.database}",
    "create_database_objects_if_missing": true,
    "type_overrides": [{{"column_name": "embedding", "pg_type": "PG_SPECIFIC_TYPE_VECTOR", "size": {cfg.embedding_dim}}}]
  }}
}}'""")
        raise


if __name__ == "__main__":  # pragma: no cover
    main(sys.argv[1:])
