"""python3 -m labs.m05_rag.demo"""
from __future__ import annotations

import os

from labs.common.paths import work
from labs.m03_knowledge import demo as km
from labs.m03_knowledge.ledger import process_inbox, scan_bank
from labs.m04_state.store import connect, ensure_schema
from labs.m05_rag.index import build_edges, index_collection
from labs.m05_rag.search import search


def build(fresh: bool = True):
    """Used by later labs: bank + ledger + indexed database, ready to search."""
    w3, bank, inbox, ledger = km.build(fresh=fresh)
    scan_bank(ledger, "POLICY", bank)
    process_inbox(ledger, "POLICY", inbox, bank, {"remote-work-policy.md": "policy", "vendor-rates.pdf": "guides"})
    ledger.retire("POLICY", "guides/vendor-rates.pdf", "placeholder file, superseded")
    w = work("m05", fresh=fresh)
    db = connect(w / "agent.db")
    ensure_schema(db)
    stats = index_collection(db, ledger, "POLICY", bank)
    edges = build_edges(db, "POLICY")
    return db, {"index": stats, "edges": edges}


def show(title: str, res: dict, n: int = 4):
    print(title)
    for r in res["results"][:n]:
        via = f"  [{r['via']}]" if r.get("via") else f"  d={r['dense_rank']} l={r['lexical_rank']}"
        print(f"   {r['chunk_id']:36s} tier {r['tier']}{via}")
    if "diagnostic" in res:
        print("   diagnostic:", res["diagnostic"])


def main():
    db, stats = build()
    print("indexed:", stats)
    show("1 paraphrase: 'how much can I spend on food each day'", search(db, "POLICY", "how much can I spend on food each day"))
    show("2 exact token: 'NW-HR-031' (lexical finds one document, l=1; the other has l=None)",
         search(db, "POLICY", "NW-HR-031"), 2)
    q = "receipts required for a single meal and alcohol"
    os.environ["RAG_DEDUP"] = "0"
    show("3 the same paragraph is in two files. dedup off:", search(db, "POLICY", q), 2)
    os.environ["RAG_DEDUP"] = "1"
    show("  dedup on: one copy, and the tier 1 file is the one kept", search(db, "POLICY", q), 2)
    show("4 definition edge: 'what does approving official mean when a hotel costs more than the cap'",
         search(db, "POLICY", "what does approving official mean when a hotel costs more than the cap", top_k=2))
    show("5 citation edge: 'can I stay in a hotel above the lodging cap' (Section 3 says: see Section 5)",
         search(db, "POLICY", "can I stay in a hotel above the lodging cap", top_k=1))
    show("6 empty: wrong collection", search(db, "HR", "stipend"))


if __name__ == "__main__":
    main()
