"""One place for every name the replication uses.

Every job, notebook and the agent read their names from here, so moving to another
catalog, workspace or model lineup is a change to environment variables, not to code.
The defaults mirror the local build: one catalog for the agent, one schema per concern.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default)


def _f(name: str, default: str, cast=str):
    """Read the variable when Config() is created, not when this module is imported,
    so a job can set AGENT_CATALOG from its arguments and then build the config."""
    return field(default_factory=lambda: cast(_env(name, default)))


@dataclass(frozen=True)
class Config:
    catalog: str = _f("AGENT_CATALOG", "agentlab")
    kb_schema: str = _f("AGENT_KB_SCHEMA", "kb")          # documents, chunks, ledger, edges
    ops_schema: str = _f("AGENT_OPS_SCHEMA", "ops")       # logs, findings, eval history
    eval_schema: str = _f("AGENT_EVAL_SCHEMA", "evals")   # sealed: frozen questions, gold sets
    volume: str = _f("AGENT_VOLUME", "raw")               # landing zone for source files

    # Model lineup. Local build: qwen3.8:27b (default) -> qwen3.6:35b-a3b (fast) -> gemini flash lite (cloud).
    # The names below are pay-per-token endpoints listed on the vendor's supported-models page in
    # October 2026. Run src/models/bench.py first: it prints which of them your workspace actually has.
    chat_default: str = _f("AGENT_CHAT_DEFAULT", "databricks-qwen35-122b-a10b")
    chat_fast: str = _f("AGENT_CHAT_FAST", "databricks-qwen3-next-80b-a3b-instruct")
    chat_fallback: str = _f("AGENT_CHAT_FALLBACK", "databricks-gemini-3-5-flash-lite")
    embedding: str = _f("AGENT_EMBEDDING", "databricks-qwen3-embedding-0-6b")
    embedding_dim: int = _f("AGENT_EMBEDDING_DIM", "1024", int)

    # Retrieval backend: "ai_search" (managed index) or "lakebase" (Postgres hybrid, closest to the local pgvector build).
    retrieval: str = _f("AGENT_RETRIEVAL", "lakebase")
    search_endpoint: str = _f("AGENT_SEARCH_ENDPOINT", "agent_search")

    # Lakebase (memory and, optionally, retrieval).
    pg_endpoint: str = _f("ENDPOINT_NAME", "")             # from the Lakebase console Connect dialog
    pg_host: str = _f("PGHOST", "")
    pg_database: str = _f("PGDATABASE", "databricks_postgres")
    pg_user: str = _f("PGUSER", "")                       # the service principal's client ID

    # Ranking, same constants as the local build (module 5).
    rrf_k: int = 60
    candidates: int = 20
    authority_weight: float = 0.0004

    secret_scope: str = _f("AGENT_SECRET_SCOPE", "agent")
    flags: dict = field(default_factory=lambda: {
        "RAG_HYBRID": _env("RAG_HYBRID", "1") == "1",
        "RAG_AUTHORITY": _env("RAG_AUTHORITY", "1") == "1",
        "RAG_DEDUP": _env("RAG_DEDUP", "1") == "1",
        "RAG_GRAPH": _env("RAG_GRAPH", "1") == "1",
    })

    def table(self, schema: str, name: str) -> str:
        return f"{self.catalog}.{schema}.{name}"

    @property
    def chunks(self) -> str:
        return self.table(self.kb_schema, "chunks")

    @property
    def ledger(self) -> str:
        return self.table(self.kb_schema, "ledger")

    @property
    def edges(self) -> str:
        return self.table(self.kb_schema, "edges")

    @property
    def index(self) -> str:
        return self.table(self.kb_schema, "chunks_index")

    @property
    def raw_path(self) -> str:
        return f"/Volumes/{self.catalog}/{self.kb_schema}/{self.volume}"


