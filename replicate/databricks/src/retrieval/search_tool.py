"""Step 12. The knowledge-base search tool the agent calls. Same contract as the local tool (module 5/6).

  search_kb(query, collection, top_k) -> {"results": [...], "trace": {...}, "diagnostic"?: str}

Two candidate lists from whichever backend you chose (Lakebase or AI Search), then the
portable ranking (ranking.py), then graph expansion from the edges table. Every answer
carries a trace, so a wrong answer can be traced to the retrieval that fed it.
"""
from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import Config  # noqa: E402
from retrieval.ranking import diagnose, rank  # noqa: E402

COLS = ("chunk_id", "source", "collection", "context", "text", "tier")
DEFINE_Q = re.compile(r"\b(what is|what does|define|definition|mean)\b", re.I)


def _embed(cfg: Config, text: str) -> list:
    from databricks_openai import DatabricksOpenAI
    return DatabricksOpenAI().embeddings.create(model=cfg.embedding, input=[text]).data[0].embedding


def _lakebase(cfg: Config, query: str, collection: str) -> tuple:
    from common.pg import pool

    vec = "[" + ",".join(f"{x:.6f}" for x in _embed(cfg, query)) + "]"
    with pool().connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT chunk_id FROM kb_search WHERE collection = %s ORDER BY embedding <=> %s::vector LIMIT %s",
                    (collection, vec, cfg.candidates))
        dense = [r[0] for r in cur.fetchall()]
        lexical = []
        if cfg.flags["RAG_HYBRID"]:
            cur.execute("SELECT chunk_id FROM kb_search WHERE collection = %s "
                        "ORDER BY body_tsv <@> to_bm25query(to_tsvector('english', %s), 'kb_search_bm25') LIMIT %s",
                        (collection, query, cfg.candidates))
            lexical = [r[0] for r in cur.fetchall()]
        ids = list(dict.fromkeys(dense + lexical))
        rows = {}
        if ids:
            cur.execute(f"SELECT {', '.join(COLS)} FROM kb_search WHERE chunk_id = ANY(%s)", (ids,))
            rows = {r[0]: dict(zip(COLS, r)) for r in cur.fetchall()}
        cur.execute("SELECT DISTINCT collection FROM kb_search")
        known = [r[0] for r in cur.fetchall()]
    return dense, lexical, rows, known


def _ai_search(cfg: Config, query: str, collection: str) -> tuple:
    from retrieval.ai_search_index import two_lists

    d, l = two_lists(cfg, query, cfg.candidates, collection)  # filtered in the index, not after
    rows, lists = {}, []
    for res in (d, l):
        cols = [c["name"] for c in res.get("manifest", {}).get("columns", [])]
        ranked = []
        for row in res.get("result", {}).get("data_array", []):
            r = dict(zip(cols, row))
            rows[r["chunk_id"]] = {k: r.get(k) for k in COLS}
            ranked.append(r["chunk_id"])
        lists.append(ranked)
    return lists[0], (lists[1] if cfg.flags["RAG_HYBRID"] else []), rows, _known_collections(cfg)


def _sql_conn():
    """A SQL warehouse connection, or None when no warehouse is configured (the app gets the id from
    its sql_warehouse resource as DATABRICKS_WAREHOUSE_ID)."""
    wh = os.environ.get("DATABRICKS_WAREHOUSE_ID")
    if not wh:
        return None
    from databricks import sql
    from databricks.sdk.core import Config as SdkConfig

    sdk = SdkConfig()
    return sql.connect(server_hostname=sdk.host.replace("https://", ""), http_path=f"/sql/1.0/warehouses/{wh}",
                       credentials_provider=lambda: sdk.authenticate)


def _known_collections(cfg: Config) -> list:
    """For the diagnostic only. An empty list makes the diagnostic generic instead of wrong."""
    conn = _sql_conn()
    if conn is None:
        return []
    with conn, conn.cursor() as cur:
        cur.execute(f"SELECT DISTINCT collection FROM {cfg.chunks} WHERE NOT retired")
        return [r[0] for r in cur.fetchall()]


def _expand(cfg: Config, query: str, hits: list, limit: int = 3):
    """Graph expansion from the Delta edges table, through a SQL warehouse (databricks-sql-connector).
    Returns None when no warehouse is configured, so the trace can say expansion was skipped."""
    conn = _sql_conn()
    if conn is None:
        return None
    added, have = [], {h["chunk_id"] for h in hits}
    with conn, conn.cursor() as cur:
        targets = []
        if DEFINE_Q.search(query):
            cur.execute(f"SELECT from_key, to_chunk FROM {cfg.edges} WHERE relation = 'defines'")
            targets += [(c, f"defines:{t}") for t, c in cur.fetchall() if t in query.lower()]
        top = [h["chunk_id"] for h in hits[:3]]
        if top:
            cur.execute(f"""SELECT c.from_key, s.to_chunk FROM {cfg.edges} c
                            JOIN {cfg.edges} s ON s.relation = 'section' AND s.from_key = c.to_chunk
                            WHERE c.relation = 'cites' AND c.from_key IN ({', '.join(['?'] * len(top))})""", top)
            targets += [(c, f"cited-by:{f}") for f, c in cur.fetchall()]
        for chunk_id, via in targets:
            if chunk_id in have or len(added) >= limit:
                continue
            cur.execute(f"SELECT {', '.join(COLS)} FROM {cfg.chunks} WHERE chunk_id = ? AND NOT retired", [chunk_id])
            r = cur.fetchone()
            if r:
                added.append({**dict(zip(COLS, r)), "via": via})
                have.add(chunk_id)
    return added


def search_kb(query: str, collection: str = "policy", top_k: int = 5) -> dict:
    cfg = Config()
    backend = _lakebase if cfg.retrieval == "lakebase" else _ai_search
    dense, lexical, rows, known = backend(cfg, query, collection)
    hits = rank(rows, dense, lexical, k=cfg.rrf_k, authority_weight=cfg.authority_weight,
                authority=cfg.flags["RAG_AUTHORITY"], dedup=cfg.flags["RAG_DEDUP"], top_k=top_k)
    extra = _expand(cfg, query, hits) if cfg.flags["RAG_GRAPH"] and hits else []
    graph = "skipped: no DATABRICKS_WAREHOUSE_ID" if extra is None else len(extra)
    extra = extra or []
    out = {"query": query, "collection": collection, "results": hits + extra,
           "trace": {"backend": cfg.retrieval, "dense": len(dense), "lexical": len(lexical), "expanded": graph}}
    why = diagnose(hits, collection, known)
    if why:
        out["diagnostic"] = why
    return out


if __name__ == "__main__":
    import json
    print(json.dumps(search_kb(" ".join(sys.argv[1:]) or "lodging cap"), indent=2)[:4000])
