"""Does search find the right passage? Scored without the chat model."""
from __future__ import annotations

import json
import os
import sqlite3
import time
from pathlib import Path

from labs.m05_rag.search import search
from labs.m11_eval.seal import assert_sealed

VARIANTS = {                      # name -> environment flags that define it
    "full":         {},
    "dense-only":   {"RAG_HYBRID": "0"},
    "no-authority": {"RAG_AUTHORITY": "0"},
    "no-dedup":     {"RAG_DEDUP": "0"},
    "no-graph":     {"RAG_GRAPH": "0"},
}


# region: gold-filter
def copies_passage(question: str, passage: str, n: int = 6) -> bool:
    """True when the question lifts an n-word run from the passage. Such a question
    tests string matching, so a generated gold set drops it."""
    q = question.lower().split()
    p = " ".join(passage.lower().split())
    return any(" ".join(q[i:i + n]) in p for i in range(len(q) - n + 1))
# endregion


# region: score
def score(gold_id: str, results: list) -> dict:
    """Rank metrics for one question, from the ordered list of returned chunk ids."""
    doc, idx = gold_id.rsplit("::", 1)
    near = {f"{doc}::{int(idx) + d}" for d in (-1, 0, 1)}
    rank = results.index(gold_id) + 1 if gold_id in results else 0
    return {"hit@1": int(rank == 1), "hit@3": int(0 < rank <= 3), "hit@5": int(0 < rank <= 5),
            "near@5": int(any(r in near for r in results[:5])),
            "doc@5": int(any(r.startswith(doc + "::") for r in results[:5])),
            "mrr": 1 / rank if rank else 0.0}
# endregion


# region: run
def run(db: sqlite3.Connection, eval_dir: Path, variant: str = "full", only_type: str = "") -> dict:
    assert_sealed(eval_dir)
    gold = json.loads((eval_dir / "frozen" / "gold_v1.json").read_text())["items"]
    gold = [g for g in gold if not only_type or g["type"] == only_type]
    saved = {k: os.environ.get(k) for k in ("RAG_HYBRID", "RAG_AUTHORITY", "RAG_DEDUP", "RAG_GRAPH")}
    os.environ.update(VARIANTS[variant])
    try:
        t0 = time.time()
        per = [score(g["gold"], [r["chunk_id"] for r in search(db, "POLICY", g["q"], top_k=5)["results"]]) for g in gold]
        seconds = time.time() - t0
    finally:
        for k, v in saved.items():                      # leave the environment as we found it
            os.environ.pop(k, None) if v is None else os.environ.__setitem__(k, v)
    summary = {k: round(sum(p[k] for p in per) / len(per), 3) for k in per[0]}
    record = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "variant": variant, "type": only_type or "all",
              "n": len(per), **summary, "flags": VARIANTS[variant], "ms_per_query": round(1000 * seconds / len(per), 1)}
    with (eval_dir / "retrieval_history.jsonl").open("a") as f:      # one line per run, forever
        f.write(json.dumps(record) + "\n")
    record["misses"] = [g["q"] for g, p in zip(gold, per) if not p["hit@5"]]
    return record
# endregion
