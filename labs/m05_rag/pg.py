"""python3 -m labs.m05_rag.pg

The production form of the lab store, run for real: a throwaway Postgres cluster
with pgvector, the state-module schema layout, a concurrent-writer test, the lab
corpus loaded into kb.chunks, an HNSW index built after the load, and the hybrid
query from the lesson. It then scores the lab gold set through both engines.

Needs: Postgres server binaries (initdb, pg_ctl) on PATH or in PG_BIN, the pgvector
extension installed for that server, and `pip install "psycopg[binary]"`.
Everything is created under labs/_work/m05pg and removed at the end.
"""
from __future__ import annotations

import glob
import json
import os
import shutil
import subprocess
import sys
import threading
from pathlib import Path

import psycopg  # noqa: F401  (ImportError here marks the lab as optional)

from labs.common import llm
from labs.common.paths import work
from labs.m05_rag.demo import build
from labs.m05_rag.search import search
from labs.m11_eval.retrieval_eval import score

PORT = 54329


def pg_bin() -> Path:
    if os.environ.get("PG_BIN"):
        return Path(os.environ["PG_BIN"])
    found = shutil.which("initdb") or (sorted(glob.glob("/usr/lib/postgresql/*/bin/initdb")) or [None])[-1]
    if not found:
        raise ModuleNotFoundError("initdb not found: install the Postgres server or set PG_BIN")
    return Path(found).parent


# region: cluster
def _as_owner(cmd: list) -> list:
    """Postgres refuses to run as root. In a root-only container, set PG_RUN_AS to an ordinary user."""
    user = os.environ.get("PG_RUN_AS")
    return ["runuser", "-u", user, "--", *map(str, cmd)] if user and os.geteuid() == 0 else cmd


def start_cluster(w: Path) -> str:
    """A private cluster in a scratch folder. Unix socket only, no password, removed afterwards."""
    b = pg_bin()
    data = w / "data"
    if os.environ.get("PG_RUN_AS") and os.geteuid() == 0:
        shutil.chown(w, os.environ["PG_RUN_AS"])
    subprocess.run(_as_owner([b / "initdb", "-D", data, "-U", "lab", "--locale=C", "-E", "UTF8", "-A", "trust"]),
                   check=True, capture_output=True)
    subprocess.run(_as_owner([b / "pg_ctl", "-D", data, "-l", w / "server.log", "-w",
                              "-o", f"-p {PORT} -k {w} -c listen_addresses=''", "start"]),
                   check=True, capture_output=True)
    return f"host={w} port={PORT} user=lab dbname=postgres"


def stop_cluster(w: Path) -> None:
    subprocess.run(_as_owner([pg_bin() / "pg_ctl", "-D", w / "data", "-m", "fast", "stop"]), capture_output=True)
# endregion


# region: schema
SCHEMA = """
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS kb;      -- ingested documents: chunks, edges, file ledger
CREATE SCHEMA IF NOT EXISTS brain;   -- what the agent learned: claims and evidence
CREATE SCHEMA IF NOT EXISTS mem;     -- per-user memory and conversation turns
CREATE TABLE IF NOT EXISTS kb.chunks (
  chunk_id text PRIMARY KEY COLLATE "C", collection text NOT NULL, source text NOT NULL,
  chunk_index int NOT NULL, text text NOT NULL, context text, tier int NOT NULL DEFAULT 3,
  retired boolean NOT NULL DEFAULT false, embedding vector(256));
CREATE TABLE IF NOT EXISTS mem.turns (
  turn_id bigserial PRIMARY KEY, partition text NOT NULL, thread text NOT NULL,
  role text NOT NULL, content text NOT NULL, ts timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS brain.claims (claim_id bigserial PRIMARY KEY, text text NOT NULL);
"""
# endregion


# region: writers
def concurrent_writers(dsn: str, writers=("chat", "nightly-job", "eval-job"), rows: int = 200) -> int:
    """The state-module writer test, against Postgres. Each writer has its own connection."""
    errors = []

    def write(name):
        try:
            with psycopg.connect(dsn) as c:
                for i in range(rows):
                    c.execute("INSERT INTO mem.turns (partition, thread, role, content) VALUES (%s,'t1','user',%s)",
                              (name, f"{name}-{i}"))
                    c.commit()
        except Exception as e:                       # a lock error would land here
            errors.append(f"{name}: {e}")

    ts = [threading.Thread(target=write, args=(n,)) for n in writers]
    [t.start() for t in ts]
    [t.join() for t in ts]
    if errors:
        raise RuntimeError("; ".join(errors))
    with psycopg.connect(dsn) as c:
        return c.execute("SELECT count(*) FROM mem.turns").fetchone()[0]
# endregion


def vec(v: list) -> str:
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"


# region: load
def load(dsn: str, lab_db) -> int:
    """Bulk load first. Build the HNSW index once, after the rows are in."""
    rows = lab_db.execute("SELECT chunk_id, collection, source, chunk_index, text, context, tier, retired, embedding "
                          "FROM kb_chunks").fetchall()
    with psycopg.connect(dsn) as c:
        with c.cursor() as cur:
            cur.executemany(
                "INSERT INTO kb.chunks VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s::vector)",
                [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], bool(r[7]), vec(json.loads(r[8]))) for r in rows])
        c.execute("CREATE INDEX chunks_hnsw ON kb.chunks USING hnsw (embedding vector_cosine_ops)")
        c.execute("CREATE INDEX chunks_fts ON kb.chunks USING gin "
                  "(to_tsvector('english', coalesce(context,'') || ' ' || text))")
        c.commit()
    return len(rows)
# endregion


# region: hybrid
# OR over the question's lexemes, like the lab's keyword search. websearch_to_tsquery would AND them.
TSQ_OR = ("coalesce((SELECT string_agg(quote_literal(l), ' | ') FROM "
          "unnest(tsvector_to_array(to_tsvector('english', %(text)s))) l), '')::tsquery")
HYBRID = f"""
WITH q AS (SELECT {TSQ_OR} AS t),
dense AS (
  SELECT chunk_id, row_number() OVER (ORDER BY d) AS r
  FROM (SELECT chunk_id, embedding <=> %(vec)s::vector AS d FROM kb.chunks
        WHERE NOT retired AND collection = %(coll)s
        ORDER BY embedding <=> %(vec)s::vector LIMIT %(n)s) c),
lexical AS (
  SELECT chunk_id, row_number() OVER (ORDER BY rank DESC) AS r
  FROM (SELECT chunk_id, ts_rank_cd(to_tsvector('english', coalesce(context,'') || ' ' || text), q.t) AS rank
        FROM kb.chunks, q
        WHERE NOT retired AND collection = %(coll)s
          AND to_tsvector('english', coalesce(context,'') || ' ' || text) @@ q.t
        ORDER BY rank DESC LIMIT %(n)s) l),
fused AS (
  SELECT chunk_id, sum(1.0 / (60 + r)) AS rrf
  FROM (SELECT chunk_id, r FROM dense UNION ALL SELECT chunk_id, r FROM lexical) u GROUP BY chunk_id)
SELECT c.chunk_id, f.rrf FROM fused f JOIN kb.chunks c USING (chunk_id)
ORDER BY f.rrf DESC, c.chunk_id LIMIT %(k)s
"""


def pg_search(conn, query: str, k: int = 5, n: int = 20) -> list:
    p = {"text": query, "vec": vec(llm.embed(query)), "coll": "POLICY", "n": n, "k": k}
    return [r[0] for r in conn.execute(HYBRID, p).fetchall()]
# endregion


# region: explain
def plan_uses_index(conn, sql: str, params: dict) -> bool:
    """With a few dozen rows the planner rightly prefers a table scan, so the test
    turns sequential scans off and asks whether an index scan is even possible."""
    conn.execute("SET enable_seqscan = off")
    plan = "\n".join(r[0] for r in conn.execute("EXPLAIN " + sql, params).fetchall())
    conn.execute("RESET enable_seqscan")
    return "chunks_hnsw" in plan


PARAM_FORM = "SELECT chunk_id FROM kb.chunks ORDER BY embedding <=> %(vec)s::vector LIMIT 5"
# Since Postgres 12 a CTE used once is inlined, so its value is still a constant to the planner.
CTE_ONCE = ("WITH q AS (SELECT %(vec)s::vector AS v) "
            "SELECT chunk_id FROM kb.chunks, q ORDER BY embedding <=> q.v LIMIT 5")
# Used twice (dense and lexical both read q, as in the reference build), it is materialized.
# A value read from a materialized CTE is not a constant, so the index cannot serve the ORDER BY.
CTE_TWICE = ("WITH q AS (SELECT %(vec)s::vector AS v) "
             "(SELECT chunk_id FROM kb.chunks, q ORDER BY embedding <=> q.v LIMIT 5) UNION ALL "
             "(SELECT chunk_id FROM kb.chunks, q ORDER BY embedding <=> q.v LIMIT 5)")
# endregion


def main():
    w = work("m05pg", fresh=True)
    dsn = start_cluster(w)
    try:
        with psycopg.connect(dsn, autocommit=True) as c:
            c.execute(SCHEMA)
            c.execute(SCHEMA)                                   # idempotent
            schemas = [r[0] for r in c.execute("SELECT nspname FROM pg_namespace WHERE nspname IN "
                                               "('kb','brain','mem') ORDER BY 1")]
            ext = c.execute("SELECT extversion FROM pg_extension WHERE extname='vector'").fetchone()[0]
        print("1 cluster up, pgvector", ext, "| schemas, applied twice:", ", ".join(schemas))

        print("2 three writers at once :", concurrent_writers(dsn), "rows, no lock errors")

        lab_db, _ = build(fresh=True)
        print("3 loaded", load(dsn, lab_db), "chunks from the lab index, then built the HNSW and GIN indexes")

        with psycopg.connect(dsn) as c:
            v = {"vec": vec(llm.embed("lodging cap"))}
            for label, sql in (("vector as a parameter  ", PARAM_FORM), ("CTE read once          ", CTE_ONCE),
                               ("CTE read twice         ", CTE_TWICE)):
                print("4 EXPLAIN,", label, ":", "index scan" if plan_uses_index(c, sql, v) else "no index (table scan)")

            gold = json.loads((Path(__file__).resolve().parents[1] / "m11_eval" / "gold_v1.json").read_text())["items"]
            os.environ.update({"RAG_AUTHORITY": "0", "RAG_DEDUP": "0", "RAG_GRAPH": "0"})   # fusion only, like the SQL
            lab_hits = pg_hits = same_top1 = 0
            for g in gold:
                lab = [r["chunk_id"] for r in search(lab_db, "POLICY", g["q"], top_k=5)["results"]]
                pg = pg_search(c, g["q"])
                lab_hits += score(g["gold"], lab)["hit@5"]
                pg_hits += score(g["gold"], pg)["hit@5"]
                same_top1 += int(bool(lab and pg and lab[0] == pg[0]))
            n = len(gold)
            print(f"5 gold set, fusion only, n={n}: hit@5 lab engine {lab_hits}/{n}, Postgres {pg_hits}/{n}, "
                  f"same top result {same_top1}/{n}")
    finally:
        stop_cluster(w)
        shutil.rmtree(w, ignore_errors=True)
    print("6 cluster stopped and removed")


if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        raise ModuleNotFoundError(str(e))
