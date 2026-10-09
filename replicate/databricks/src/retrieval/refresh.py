"""The last ingest task: make the chosen search backend see the new chunks.

TRIGGERED pipelines never update on their own. After ingest has merged new chunks into Delta:
  ai_search  start the index sync
  lakebase   start the synced table's pipeline update, wait for it, then rebuild kb_search
             (the same TRUNCATE + INSERT as lakebase_search.sql, in one transaction)

  python refresh.py --backend lakebase --synced-table agentlab.kb.chunks_pg
"""
from __future__ import annotations

import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import Config  # noqa: E402

REBUILD = """
TRUNCATE kb_search;
INSERT INTO kb_search
SELECT chunk_id, source, collection, chunk_index, context, text, tier, embedding,
       to_tsvector('english', coalesce(context, '') || ' ' || coalesce(text, ''))
FROM kb.chunks_pg WHERE NOT retired;
"""


def _pipeline_id(st) -> str:
    """The synced table's pipeline id. Read defensively: the attribute path differs between SDK versions."""
    for path in (("data_synchronization_status", "pipeline_id"), ("status", "pipeline_id"), ("pipeline_id",)):
        obj = st
        for attr in path:
            obj = getattr(obj, attr, None)
        if obj:
            return str(obj)
    raise RuntimeError("no pipeline id on the synced table; trigger the sync from its Overview tab")


def lakebase(cfg: Config, synced_table: str, timeout_s: int = 1800) -> None:  # pragma: no cover
    from databricks.sdk import WorkspaceClient

    from common.pg import pool

    w = WorkspaceClient()
    pid = _pipeline_id(w.postgres.get_synced_table(name=synced_table))
    update = w.pipelines.start_update(pipeline_id=pid).update_id
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        state = str(w.pipelines.get_update(pipeline_id=pid, update_id=update).update.state)
        if state.endswith(("COMPLETED", "FAILED", "CANCELED")):
            break
        time.sleep(15)
    print("synced table update:", state)
    if not state.endswith("COMPLETED"):
        raise SystemExit("sync did not complete; kb_search left unchanged")
    with pool().connection() as conn:          # psycopg runs this in one transaction, committed on exit
        conn.execute(REBUILD)
        n = conn.execute("SELECT count(*) FROM kb_search").fetchone()[0]
    print("kb_search rows:", n)


def main(argv: list) -> None:  # pragma: no cover
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend", default=None)
    ap.add_argument("--synced-table", default=None)
    a = ap.parse_args(argv)
    if a.backend:
        os.environ["AGENT_RETRIEVAL"] = a.backend
    cfg = Config()
    if cfg.retrieval == "ai_search":
        from retrieval.ai_search_index import sync
        sync(cfg)
    else:
        lakebase(cfg, a.synced_table or cfg.table(cfg.kb_schema, "chunks_pg"))


if __name__ == "__main__":  # pragma: no cover
    main(sys.argv[1:])
