"""Ranking that runs after either backend returns candidates. Pure Python, no platform calls.

This is the part of the local search tool (module 5) that no managed index does for you:
fusing two ranked lists by position, a small authority nudge, collapsing copies of one
paragraph to its most authoritative source, and a diagnostic instead of a silent empty list.
It is tested in this repository by tests/test_portable.py.
"""
from __future__ import annotations

from typing import Iterable, Optional


def rrf(lists: Iterable[list], k: int = 60) -> dict:
    """Reciprocal rank fusion. Positions only, so a cosine score and a BM25 score never meet."""
    score: dict = {}
    for ranked in lists:
        for rank, chunk_id in enumerate(ranked, start=1):
            score[chunk_id] = score.get(chunk_id, 0.0) + 1.0 / (k + rank)
    return score


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def rank(rows: dict, dense: list, lexical: list, *, k: int = 60, authority_weight: float = 0.0004,
         authority: bool = True, dedup: bool = True, top_k: int = 5) -> list:
    """rows: chunk_id -> {"chunk_id","source","text","tier",...}. dense/lexical: ranked chunk ids.

    Tier 1 is the most authoritative. The bonus is sized to one rank step near the top
    (1/61 - 1/62 = 0.00026), so it decides near ties and never jumps several ranks.
    """
    fused = rrf([dense, lexical], k)
    out = []
    for chunk_id, score in fused.items():
        row = rows.get(chunk_id)
        if not row:
            continue                                    # retired or filtered out after retrieval
        if authority:
            score += authority_weight * (3 - int(row.get("tier", 3)))
        out.append({**row, "score": round(score, 5),
                    "dense_rank": dense.index(chunk_id) + 1 if chunk_id in dense else None,
                    "lexical_rank": lexical.index(chunk_id) + 1 if chunk_id in lexical else None})
    out.sort(key=lambda r: (-r["score"], r.get("tier", 3), r["chunk_id"]))
    if dedup:
        best: dict = {}
        for r in out:
            key = _norm(r["text"])
            if key not in best or r.get("tier", 3) < best[key].get("tier", 3):
                best[key] = r
        seen, unique = set(), []
        for r in out:                                   # keep the best position, show the best source
            key = _norm(r["text"])
            if key not in seen:
                seen.add(key)
                unique.append({**best[key], "score": r["score"]})
        out = unique
    return out[:top_k]


def diagnose(hits: list, collection: Optional[str], known_collections: list) -> Optional[str]:
    """An empty result must say why, or the model fills the gap with a guess."""
    if hits:
        return None
    if collection and known_collections and collection not in known_collections:
        return f"collection '{collection}' has no chunks; known collections: {sorted(known_collections)}"
    return "no chunk shares a word or a vector direction with the query; try different terms"
