"""Step 11 (AI Search backend). A managed index over the chunk table, embeddings computed by Databricks.

Choose this when you want no database to run. The index offers query_type="hybrid" (it fuses
for you) and query_type="FULL_TEXT". By default the search tool asks for two lists, dense and
full-text, and fuses them itself with ranking.rrf, exactly like the local build, so the replica
ranks the same way and each hit keeps its dense and lexical rank. hybrid_list() is the one-call
alternative; measure both with the gold set before choosing.

  python ai_search_index.py create        # endpoint + Delta Sync index (TRIGGERED)
  python ai_search_index.py sync          # after each ingest run
  python ai_search_index.py query "lodging cap"
"""
from __future__ import annotations

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import Config  # noqa: E402


def client():
    from databricks.ai_search.client import AISearchClient
    return AISearchClient()


def create(cfg: Config) -> None:
    c = client()
    try:
        c.create_endpoint(name=cfg.search_endpoint, endpoint_type="STANDARD")
    except Exception as e:                                      # noqa: BLE001
        print("endpoint:", str(e)[:160])                       # usually "already exists"
    c.create_delta_sync_index(
        endpoint_name=cfg.search_endpoint,
        source_table_name=cfg.chunks,
        index_name=cfg.index,
        pipeline_type="TRIGGERED",
        primary_key="chunk_id",
        embedding_source_column="embed_text",                   # context + text, as in module 5
        embedding_model_endpoint_name=cfg.embedding,
        columns_to_sync=["chunk_id", "source", "collection", "context", "text", "tier", "retired"],
    )
    print("index requested:", cfg.index)


def sync(cfg: Config) -> None:
    client().get_index(index_name=cfg.index).sync()
    print("sync started:", cfg.index)


def _ids(result: dict) -> list:
    """Results come back as a column manifest plus rows. Return chunk ids in rank order."""
    res = result.get("result", {})
    cols = [c["name"] for c in result.get("manifest", {}).get("columns", [])]
    i = cols.index("chunk_id") if "chunk_id" in cols else 0
    return [row[i] for row in res.get("data_array", [])]


COLS = ["chunk_id", "source", "collection", "context", "text", "tier", "retired"]


def two_lists(cfg: Config, query: str, n: int, collection: str | None = None) -> tuple:
    """Dense and full-text lists, filtered in the index (dict filters on a standard endpoint)."""
    index = client().get_index(index_name=cfg.index)
    filters = {"retired": False, **({"collection": collection} if collection else {})}
    dense = index.similarity_search(query_text=query, columns=COLS, num_results=n, filters=filters)
    lexical = index.similarity_search(query_text=query, columns=COLS, num_results=n, filters=filters,
                                      query_type="FULL_TEXT")
    return dense, lexical


def hybrid_list(cfg: Config, query: str, n: int, collection: str | None = None) -> dict:
    """One call; the index fuses dense and keyword itself. Compare it with two_lists in step 13."""
    index = client().get_index(index_name=cfg.index)
    filters = {"retired": False, **({"collection": collection} if collection else {})}
    return index.similarity_search(query_text=query, columns=COLS, num_results=n, filters=filters, query_type="hybrid")


if __name__ == "__main__":
    cfg = Config()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "query"
    if cmd == "create":
        create(cfg)
    elif cmd == "sync":
        sync(cfg)
    else:
        t0 = time.perf_counter()
        d, l = two_lists(cfg, " ".join(sys.argv[2:]) or "lodging cap", cfg.candidates)
        print("dense  :", _ids(d)[:10])
        print("lexical:", _ids(l)[:10])
        print(f"{time.perf_counter() - t0:.2f}s for both lists")
