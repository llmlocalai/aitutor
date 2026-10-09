"""Step 10. Policy documents -> parsed elements -> chunks (Delta, change data feed) -> AI Search index.

  python policy_index.py build  --catalog fin_dev      # parse new policy files, rebuild chunks
  python policy_index.py index  --catalog fin_dev      # create the endpoint and Delta Sync index once
  python policy_index.py sync   --catalog fin_dev      # after each build (TRIGGERED pipeline)
  python policy_index.py query  --catalog fin_dev "late fee waiver"

chunk_elements() is pure and tested. It keeps a heading path with every chunk, the lesson from the
local build: "Section 5" means nothing once a paragraph is cut out of its document.
"""
from __future__ import annotations

import argparse
import json
import os

ENDPOINT = os.environ.get("AGENT_SEARCH_ENDPOINT", "spend_policy")
EMBEDDING = os.environ.get("AGENT_EMBEDDING", "databricks-qwen3-embedding-0-6b")
HEADING_TYPES = {"title", "section_header", "page_header"}
SKIP_TYPES = {"page_footer", "page_number"}


def chunk_elements(source: str, elements: list, max_chars: int = 1500) -> list:
    """elements: ai_parse_document document.elements (dicts with type, content). Returns chunk dicts."""
    chunks, path, buf = [], [], []

    def flush():
        text = "\n".join(buf).strip()
        if text:
            n = len(chunks)
            chunks.append({"chunk_id": f"{source}::{n}", "source": source, "chunk_index": n,
                           "context": " > ".join(path), "text": text,
                           "embed_text": (" > ".join(path) + "\n" + text).strip()})
        buf.clear()

    for el in elements:
        kind = (el.get("type") or "").lower()
        content = (el.get("content") or "").strip()
        if not content or kind in SKIP_TYPES:
            continue
        if kind in HEADING_TYPES:
            flush()
            path[:] = [content] if kind == "title" else (path[:1] + [content])
            continue
        if sum(len(b) for b in buf) + len(content) > max_chars:
            flush()
        buf.append(content)
    flush()
    return chunks


def build(catalog: str) -> None:  # pragma: no cover - runs on Databricks
    from pyspark.sql import SparkSession

    spark = SparkSession.builder.getOrCreate()
    parsed = spark.sql(f"""
        SELECT path, to_json(ai_parse_document(content, map('version', '2.0'))) AS doc
        FROM READ_FILES('/Volumes/{catalog}/landing/policy', format => 'binaryFile')""")
    rows = []
    for r in parsed.toLocalIterator():
        doc = json.loads(r["doc"])
        source = r["path"].split("/landing/policy/", 1)[-1]
        rows += chunk_elements(source, doc.get("document", {}).get("elements", []))
    df = spark.createDataFrame(rows, "chunk_id string, source string, chunk_index int, context string, text string, embed_text string")
    table = f"{catalog}.ai.policy_chunks"
    df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
    spark.sql(f"ALTER TABLE {table} SET TBLPROPERTIES (delta.enableChangeDataFeed = true)")
    print(f"policy chunks: {len(rows)} from {df.select('source').distinct().count()} documents")


def index(catalog: str) -> None:  # pragma: no cover
    from databricks.ai_search.client import AISearchClient

    c = AISearchClient()
    try:
        c.create_endpoint(name=ENDPOINT, endpoint_type="STANDARD")
    except Exception as e:                              # noqa: BLE001 - usually "already exists"
        print("endpoint:", str(e)[:120])
    c.create_delta_sync_index(endpoint_name=ENDPOINT, source_table_name=f"{catalog}.ai.policy_chunks",
                              index_name=f"{catalog}.ai.policy_index", pipeline_type="TRIGGERED",
                              primary_key="chunk_id", embedding_source_column="embed_text",
                              embedding_model_endpoint_name=EMBEDDING)
    print("index requested")


def sync(catalog: str) -> None:  # pragma: no cover
    from databricks.ai_search.client import AISearchClient
    AISearchClient().get_index(index_name=f"{catalog}.ai.policy_index").sync()
    print("sync started")


def query(catalog: str, text: str) -> None:  # pragma: no cover
    from databricks.ai_search.client import AISearchClient
    idx = AISearchClient().get_index(index_name=f"{catalog}.ai.policy_index")
    res = idx.similarity_search(query_text=text, columns=["chunk_id", "context", "text"], num_results=5,
                                query_type="hybrid")
    for row in res.get("result", {}).get("data_array", []):
        print(row[0], "|", row[1], "|", str(row[2])[:100])


if __name__ == "__main__":  # pragma: no cover
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["build", "index", "sync", "query"])
    ap.add_argument("text", nargs="*")
    ap.add_argument("--catalog", required=True)
    a = ap.parse_args()
    {"build": build, "index": index, "sync": sync}.get(a.cmd, lambda c: query(c, " ".join(a.text)))(a.catalog)
