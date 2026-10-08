"""Indexing: chunk with a context line, embed, load, and build graph edges."""
from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path

from labs.common import llm
from labs.m03_knowledge.ledger import Ledger

# region: chunk
def chunk_markdown(text: str, size: int = 500, overlap: int = 80) -> list:
    """Split on headings first, then by size. Returns [(context, text)].

    The context is "<document title> > <section heading>". It is stored beside the
    chunk and indexed for keyword search, so a chunk can match on its section name.
    """
    title = ""
    section = ""
    blocks = []                 # (context, paragraph)
    for para in re.split(r"\n\s*\n", text):
        para = para.strip()
        if not para:
            continue
        if para.startswith("# "):
            title = para[2:].strip()
            continue
        if para.startswith("## "):
            section = para[3:].strip()
            continue
        blocks.append((" > ".join(x for x in (title, section) if x), para))
    chunks = []
    for context, para in blocks:
        step = size - overlap
        for i in range(0, max(len(para) - overlap, 1), step):
            chunks.append((context, para[i:i + size]))
    return chunks
# endregion


# region: load
def index_collection(db: sqlite3.Connection, ledger: Ledger, collection: str, bank: Path) -> dict:
    """Index every 'filed' text file in the ledger. Retired and rejected files are skipped."""
    done = {"files": 0, "chunks": 0}
    for source, tier, kind, status, note in ledger.rows(collection):
        if status != "filed" or not source.endswith((".md", ".txt")):
            continue
        db.execute("DELETE FROM kb_fts WHERE chunk_id IN (SELECT chunk_id FROM kb_chunks WHERE source=?)", (source,))
        db.execute("DELETE FROM kb_chunks WHERE source=?", (source,))
        for n, (context, text) in enumerate(chunk_markdown((bank / source).read_text())):
            chunk_id = f"{source}::{n}"
            vec = llm.embed(context + " " + text)
            db.execute("INSERT INTO kb_chunks (chunk_id, collection, source, chunk_index, text, context, embedding, tier) "
                       "VALUES (?,?,?,?,?,?,?,?)",
                       (chunk_id, collection, source, n, text, context, json.dumps(vec), tier))
            db.execute("INSERT INTO kb_fts (chunk_id, collection, body) VALUES (?,?,?)",
                       (chunk_id, collection, context + " " + text))
            done["chunks"] += 1
        ledger.db.execute("UPDATE files SET status='indexed' WHERE collection=? AND source=?", (collection, source))
        done["files"] += 1
    ledger.db.commit()
    db.commit()
    return done
# endregion


# region: edges
DEFINES = re.compile(r"\b(?:The term|An?|The)\s+([a-z][a-z \-]{2,40}?)\s+means\b", re.I)
CITES = re.compile(r"\bSection\s+(\d+)\b")
POLICY_NO = re.compile(r"\b(NW-[A-Z]+-\d+)\b")


def build_edges(db: sqlite3.Connection, collection: str) -> dict:
    """Two typed edges that similarity search cannot supply.

    defines   term            -> the chunk that defines it   ("X means ...")
    cites     "<doc>#<n>"     -> every chunk in section n of that document
              "<chunk_id>"    -> the "<doc>#<n>" keys it refers to are resolved at query time
    """
    db.execute("DELETE FROM kb_edges")
    rows = db.execute("SELECT chunk_id, source, text, context FROM kb_chunks WHERE collection=? AND NOT retired",
                      (collection,)).fetchall()
    policy_doc = {}                                   # "NW-FIN-012" -> source file
    for chunk_id, source, text, context in rows:
        for no in POLICY_NO.findall(text):
            if text.lstrip().startswith("Policy number"):
                policy_doc[no] = source
    n_def = n_cite = 0
    for chunk_id, source, text, context in rows:
        for term in DEFINES.findall(text):
            db.execute("INSERT OR IGNORE INTO kb_edges VALUES (?,?,?)", (term.strip().lower(), chunk_id, "defines"))
            n_def += 1
        m = re.search(r"Section (\d+)\.", context or "")
        if m:                                         # this chunk belongs to a numbered section
            db.execute("INSERT OR IGNORE INTO kb_edges VALUES (?,?,?)", (f"{source}#{m.group(1)}", chunk_id, "section"))
        nos = POLICY_NO.findall(text)
        target_doc = policy_doc.get(nos[0], source) if nos else source
        for sec in CITES.findall(text):
            if m and sec == m.group(1) and target_doc == source:
                continue                              # a section naming itself is not a citation
            db.execute("INSERT OR IGNORE INTO kb_edges VALUES (?,?,?)", (chunk_id, f"{target_doc}#{sec}", "cites"))
            n_cite += 1
    db.commit()
    return {"defines": n_def, "cites": n_cite}
# endregion
