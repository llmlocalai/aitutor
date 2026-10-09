"""Step 7. Volume -> validated files -> ledger (MERGE) -> chunks (MERGE) -> optional embeddings.

Runs as a Lakeflow job task:  python ingest.py --catalog agentlab [--embed]
Idempotent: a second run over unchanged files prints  changed 0, unchanged N  and writes nothing.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import Config  # noqa: E402
from knowledge.chunking import chunk_markdown, sha256, tier, validate  # noqa: E402

TEXTUAL = (".md", ".txt")


def main(argv: list) -> None:  # pragma: no cover - runs on Databricks
    from pyspark.sql import SparkSession, functions as F

    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", default=None)
    ap.add_argument("--embed", action="store_true", help="compute embeddings (needed by the Lakebase backend)")
    ap.add_argument("--backend", default=None, help="lakebase or ai_search; lakebase implies --embed")
    args = ap.parse_args(argv)
    if args.catalog:
        os.environ["AGENT_CATALOG"] = args.catalog
    if args.backend:
        os.environ["AGENT_RETRIEVAL"] = args.backend
    cfg = Config()
    embed = args.embed or cfg.retrieval == "lakebase"
    spark = SparkSession.builder.getOrCreate()
    root = cfg.raw_path

    rules_path = f"{root}/source_authority.json"
    rules = json.load(open(rules_path)) if os.path.exists(rules_path) else []   # volumes are mounted as files

    files = (spark.read.format("binaryFile").option("recursiveFileLookup", "true").load(root)
             .select("path", "content", "length"))
    known = {r["path"]: r["sha256"] for r in spark.table(cfg.ledger).select("path", "sha256").collect()}

    ledger_rows, chunk_rows, changed, unchanged = [], [], 0, 0
    for r in files.toLocalIterator():
        rel = r["path"].split(root, 1)[-1].lstrip("/")
        if rel == "source_authority.json":
            continue
        data = bytes(r["content"])
        digest = sha256(data)
        if known.get(rel) == digest:
            unchanged += 1
            continue
        changed += 1
        ok, reason = validate(rel, data)
        t = tier(rel, rules)
        ledger_rows.append((rel, digest, len(data), "accepted" if ok else "rejected", reason, t))
        if ok and rel.endswith(TEXTUAL):
            collection = rel.split("/", 1)[0]
            for c in chunk_markdown(rel, data.decode("utf-8")):
                chunk_rows.append((c["chunk_id"], rel, collection, c["chunk_index"], c["context"], c["text"],
                                   (c["context"] + "\n" + c["text"]).strip(), t, digest))
        # PDF, DOCX and other binary types: run your extractor here (the local kb_extract.py, installed
        # as a job dependency) and emit the same chunk tuple. Nothing below changes.

    print(f"changed {changed}, unchanged {unchanged}")
    if not ledger_rows:
        return

    led = spark.createDataFrame(ledger_rows, "path string, sha256 string, bytes bigint, status string, reason string, tier int") \
        .withColumn("updated_at", F.current_timestamp())
    led.createOrReplaceTempView("incoming_ledger")
    spark.sql(f"""MERGE INTO {cfg.ledger} t USING incoming_ledger s ON t.path = s.path
                  WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT *""")

    if chunk_rows:
        ch = spark.createDataFrame(chunk_rows, "chunk_id string, source string, collection string, chunk_index int, "
                                               "context string, text string, embed_text string, tier int, sha256 string")
        ch = ch.withColumn("retired", F.lit(False))
        if embed:
            ch = add_embeddings(spark, ch, cfg)
        else:
            ch = ch.withColumn("embedding", F.lit(None).cast("array<float>"))
        ch.createOrReplaceTempView("incoming_chunks")
        # A changed file retires its old chunks first, so a shortened document leaves no ghosts.
        spark.sql(f"""UPDATE {cfg.chunks} SET retired = true
                      WHERE source IN (SELECT DISTINCT source FROM incoming_chunks)
                        AND chunk_id NOT IN (SELECT chunk_id FROM incoming_chunks)""")
        spark.sql(f"""MERGE INTO {cfg.chunks} t USING incoming_chunks s ON t.chunk_id = s.chunk_id
                      WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT *""")
    rejected = [r for r in ledger_rows if r[3] == "rejected"]
    if rejected:                              # a file that turned bad takes its old chunks out of service
        spark.createDataFrame([(r[0],) for r in rejected], "path string").createOrReplaceTempView("rejected_paths")
        spark.sql(f"UPDATE {cfg.chunks} SET retired = true WHERE source IN (SELECT path FROM rejected_paths)")
    print(f"ledger rows {len(ledger_rows)}, chunks {len(chunk_rows)}, rejected {len(rejected)}")
    for r in rejected[:20]:
        print("  rejected", r[0], "->", r[4])


def add_embeddings(spark, df, cfg: Config, batch: int = 64):  # pragma: no cover
    """Embed context + text with the same endpoint the query side uses. One model for both sides, always."""
    from databricks_openai import DatabricksOpenAI

    client = DatabricksOpenAI()
    rows = df.collect()
    out = []
    for i in range(0, len(rows), batch):
        part = rows[i:i + batch]
        vecs = client.embeddings.create(model=cfg.embedding, input=[r["embed_text"] for r in part]).data
        out += [(*r, [float(x) for x in v.embedding]) for r, v in zip(part, vecs)]
    return spark.createDataFrame(out, df.schema.add("embedding", "array<float>"))


if __name__ == "__main__":  # pragma: no cover
    main(sys.argv[1:])
