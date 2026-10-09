"""Validation, authority tiers and structure-aware chunking. Pure Python, no platform calls.

The same rules as the local knowledge bank (modules 3 and 5), written so a Databricks job
can import them unchanged. Tested here by tests/test_portable.py.
"""
from __future__ import annotations

import fnmatch
import hashlib
import re

MAGIC = {".pdf": b"%PDF", ".docx": b"PK\x03\x04", ".xlsx": b"PK\x03\x04", ".png": b"\x89PNG"}
TEXT = {".md", ".txt", ".csv", ".json", ".html"}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate(name: str, data: bytes) -> tuple:
    """(ok, reason). A renamed file or an empty export is caught here, before it is chunked."""
    ext = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if not data:
        return False, "empty file"
    if ext in MAGIC and not data.startswith(MAGIC[ext]):
        return False, f"not a real {ext} file"
    if ext in TEXT:
        try:
            data.decode("utf-8")
        except UnicodeDecodeError:
            return False, "not valid UTF-8 text"
    if ext not in MAGIC and ext not in TEXT:
        return False, f"unsupported type {ext or '(none)'}"
    return True, "ok"


def tier(path: str, rules: list) -> int:
    """rules: [{"pattern": "policy/*", "tier": 1}, ...], first match wins, default tier 3."""
    for r in rules:
        if fnmatch.fnmatch(path, r["pattern"]):
            return int(r["tier"])
    return 3


HEADING = re.compile(r"^(#{1,6})\s+(.*)$")


def chunk_markdown(source: str, text: str, max_chars: int = 1200) -> list:
    """Split on headings, then on blank lines, never inside a paragraph.

    Each chunk carries `context`: the heading path it sits under. That path is stored
    beside the text and embedded with it, so 'Section 5' still means something after
    the chunk is cut out of its document.
    """
    chunks, path, buf = [], [], []

    def flush():
        body = "\n\n".join(p for p in buf if p.strip()).strip()
        if body:
            chunks.append({"source": source, "chunk_index": len(chunks), "context": " > ".join(path), "text": body})
        buf.clear()

    for para in re.split(r"\n\s*\n", text):
        m = HEADING.match(para.strip())
        if m:
            flush()
            level = len(m.group(1))
            path[:] = path[: level - 1] + [m.group(2).strip()]
            continue
        if sum(len(p) for p in buf) + len(para) > max_chars:
            flush()
        buf.append(para.strip())
    flush()
    for c in chunks:
        c["chunk_id"] = f"{source}::{c['chunk_index']}"
    return chunks
