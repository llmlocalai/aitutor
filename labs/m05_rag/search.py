"""Retrieval: dense + lexical, fused by rank, then authority, dedup and graph expansion."""
from __future__ import annotations

import json
import os
import re
import sqlite3
from typing import Optional

from labs.common import llm

RRF_K = 60
CANDIDATES = 20
# One step in rank near the top changes an RRF score by 1/61 - 1/62 = 0.00026.
# The tier bonus is sized to that: enough to win a near tie, too small to jump several ranks.
AUTHORITY_WEIGHT = 0.0004


def flag(name: str, default: str = "1") -> bool:
    """Every ranking feature has an environment switch, so an eval can compare on and off."""
    return os.environ.get(name, default) == "1"


# region: dense
def dense(db: sqlite3.Connection, collection: str, query: str, n: int) -> list:
    """Nearest chunks by cosine similarity. Brute force here; an ANN index in production."""
    q = llm.embed(query)
    scored = []
    for chunk_id, emb in db.execute("SELECT chunk_id, embedding FROM kb_chunks WHERE collection=? AND NOT retired",
                                    (collection,)):
        scored.append((llm.cosine(q, json.loads(emb)), chunk_id))
    scored.sort(reverse=True)
    return [c for s, c in scored[:n] if s > 0]
# endregion


# region: lexical
def lexical(db: sqlite3.Connection, collection: str, query: str, n: int) -> list:
    """Keyword match ranked by BM25. Finds exact tokens such as 'NW-FIN-012' or 'Section 5'."""
    terms = [t for t in re.findall(r"[A-Za-z0-9\-]+", query) if len(t) > 1]
    if not terms:
        return []
    match = " OR ".join('"' + t.replace('"', "") + '"' for t in terms)
    rows = db.execute("SELECT chunk_id FROM kb_fts WHERE kb_fts MATCH ? AND collection=? ORDER BY bm25(kb_fts) LIMIT ?",
                      (match, collection, n)).fetchall()
    return [r[0] for r in rows]
# endregion


# region: rrf
def rrf(lists: list, k: int = RRF_K) -> dict:
    """Reciprocal rank fusion. Uses positions only, so the two score scales never meet."""
    score = {}
    for ranked in lists:
        for rank, chunk_id in enumerate(ranked, start=1):
            score[chunk_id] = score.get(chunk_id, 0.0) + 1.0 / (k + rank)
    return score
# endregion


def _row(db: sqlite3.Connection, chunk_id: str) -> Optional[dict]:
    r = db.execute("SELECT chunk_id, source, chunk_index, text, context, tier FROM kb_chunks WHERE chunk_id=? AND NOT retired",
                   (chunk_id,)).fetchone()
    return dict(zip(("chunk_id", "source", "chunk_index", "text", "context", "tier"), r)) if r else None


# region: expand
def expand(db: sqlite3.Connection, query: str, hits: list, limit: int = 3) -> list:
    """Add passages that graph edges point to.

    defines  if the question asks what a term means, fetch the chunk that defines it
    cites    if a top hit says 'see Section N', fetch that section
    """
    added = []
    have = {h["chunk_id"] for h in hits}
    if re.search(r"\b(what is|what does|define|definition|mean)\b", query, re.I):
        for term, chunk_id in db.execute("SELECT from_key, to_chunk FROM kb_edges WHERE relation='defines'"):
            if term in query.lower() and chunk_id not in have:
                row = _row(db, chunk_id)
                if row:
                    added.append({**row, "via": f"defines:{term}"})
                    have.add(chunk_id)
    for h in hits[:3]:
        for (section_key,) in db.execute("SELECT to_chunk FROM kb_edges WHERE relation='cites' AND from_key=?",
                                         (h["chunk_id"],)):
            for (chunk_id,) in db.execute("SELECT to_chunk FROM kb_edges WHERE relation='section' AND from_key=?",
                                          (section_key,)):
                if chunk_id not in have and len(added) < limit:
                    row = _row(db, chunk_id)
                    if row:
                        added.append({**row, "via": f"cited-by:{h['chunk_id']}"})
                        have.add(chunk_id)
    return added[:limit]
# endregion


# region: search
def search(db: sqlite3.Connection, collection: str, query: str, top_k: int = 5) -> dict:
    d = dense(db, collection, query, CANDIDATES)
    l = lexical(db, collection, query, CANDIDATES) if flag("RAG_HYBRID") else []
    fused = rrf([d, l])
    rows = []
    for chunk_id, score in fused.items():
        row = _row(db, chunk_id)
        if not row:
            continue
        if flag("RAG_AUTHORITY"):
            score += AUTHORITY_WEIGHT * (3 - row["tier"])          # tier 1 gets the largest nudge
        rows.append({**row, "score": round(score, 5),
                     "dense_rank": d.index(chunk_id) + 1 if chunk_id in d else None,
                     "lexical_rank": l.index(chunk_id) + 1 if chunk_id in l else None})
    rows.sort(key=lambda r: (-r["score"], r["tier"], r["chunk_id"]))
    if flag("RAG_DEDUP"):
        best = {}                                                    # text -> most authoritative copy
        for r in rows:
            key = " ".join(r["text"].lower().split())
            if key not in best or r["tier"] < best[key]["tier"]:
                best[key] = r
        seen, unique = set(), []
        for r in rows:                                               # keep the best position,
            key = " ".join(r["text"].lower().split())                # show the best source
            if key not in seen:
                seen.add(key)
                unique.append({**best[key], "score": r["score"]})
        rows = unique
    hits = rows[:top_k]
    extra = expand(db, query, hits) if flag("RAG_GRAPH") else []
    out = {"query": query, "collection": collection, "results": hits + extra,
           "trace": {"dense": len(d), "lexical": len(l), "fused": len(fused), "expanded": len(extra)}}
    if not hits:
        known = [r[0] for r in db.execute("SELECT DISTINCT collection FROM kb_chunks")]
        out["diagnostic"] = (f"collection '{collection}' has no chunks; known collections: {known}"
                             if collection not in known else
                             "no chunk shares a word or a vector direction with the query; try different terms")
    return out
# endregion
