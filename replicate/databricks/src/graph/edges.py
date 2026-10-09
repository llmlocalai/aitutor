"""Graph edges as rows in a Delta table. The edge rules are pure Python; the job writes them.

Three relations, as in the local build (module 5):
  section   "<source>#<n>"  -> the chunk that starts Section n of that source
  cites     chunk           -> "<source>#<n>" it refers to ("see Section 5")
  defines   term            -> the chunk that defines it ("X means ...", "X is defined as ...")

Run as a job:  python edges.py --catalog agentlab
"""
from __future__ import annotations

import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # .../src, so `common` imports

SECTION = re.compile(r"^\s*(?:section|§)\s*(\d+)\b", re.I)
CITES = re.compile(r"\bsee\s+section\s+(\d+)\b", re.I)
DEFINES = re.compile(r"^\s*(?:\"|“)?([A-Za-z][A-Za-z \-]{2,40}?)(?:\"|”)?\s+(?:means|is defined as|refers to)\b", re.I | re.M)


def build_edges(chunks: list) -> list:
    """chunks: dicts with chunk_id, source, context, text. Returns (relation, from_key, to_chunk) dicts."""
    edges = []
    for c in chunks:
        heading = (c.get("context") or "").split(" > ")[-1]
        m = SECTION.match(heading) or SECTION.match(c["text"])
        if m:
            edges.append({"relation": "section", "from_key": f"{c['source']}#{m.group(1)}", "to_chunk": c["chunk_id"]})
        for n in CITES.findall(c["text"]):
            edges.append({"relation": "cites", "from_key": c["chunk_id"], "to_chunk": f"{c['source']}#{n}"})
        for term in DEFINES.findall(c["text"]):
            edges.append({"relation": "defines", "from_key": term.strip().lower(), "to_chunk": c["chunk_id"]})
    seen, out = set(), []
    for e in edges:
        key = (e["relation"], e["from_key"], e["to_chunk"])
        if key not in seen:
            seen.add(key)
            out.append(e)
    return out


def main(argv: list) -> None:  # pragma: no cover - runs on Databricks
    from pyspark.sql import SparkSession

    from common.config import Config

    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", default=None)
    args = ap.parse_args(argv)
    if args.catalog:
        os.environ["AGENT_CATALOG"] = args.catalog
    cfg = Config()
    spark = SparkSession.builder.getOrCreate()
    rows = [r.asDict() for r in spark.table(cfg.chunks).where("NOT retired").select("chunk_id", "source", "context", "text").collect()]
    edges = build_edges(rows)
    df = spark.createDataFrame(edges or [], "relation string, from_key string, to_chunk string")
    df.write.mode("overwrite").saveAsTable(cfg.edges)       # rebuilt from chunks each run: no drift
    counts = {r["relation"]: r["n"] for r in df.groupBy("relation").count().withColumnRenamed("count", "n").collect()}
    print("edges written:", counts)


if __name__ == "__main__":  # pragma: no cover
    main(sys.argv[1:])
