-- Step 10 (Lakebase backend). Search table, ANN and BM25 indexes, and the two ranked lists, in Postgres.
-- Run with psql against the Lakebase database (connection details: Lakebase console, Connect).
-- Needs Lakebase Search enabled on the project (project settings). Enabling it restarts the
-- project's computes and cannot be undone, so do it in a dev project first.

CREATE EXTENSION IF NOT EXISTS lakebase_vector CASCADE;   -- also installs pgvector
CREATE EXTENSION IF NOT EXISTS lakebase_text;              -- BM25

-- The synced table belongs to its sync pipeline: do not alter it, and do not build views on it
-- (a full re-sync that recreates the table would be blocked by a dependent view). Search runs over
-- a plain table that the refresh task rebuilds from it, with the tsvector column BM25 needs.
-- The schema the synced table lands in is shown on its Overview tab; "kb" is assumed here.
CREATE TABLE IF NOT EXISTS kb_search (
  chunk_id    text PRIMARY KEY,
  source      text NOT NULL,
  collection  text NOT NULL,
  chunk_index int,
  context     text,
  text        text,
  tier        int,
  embedding   vector(1024),          -- AGENT_EMBEDDING_DIM
  body_tsv    tsvector
);
CREATE INDEX IF NOT EXISTS kb_search_ann  ON kb_search USING lakebase_ann (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS kb_search_bm25 ON kb_search USING lakebase_bm25 (body_tsv);
CREATE INDEX IF NOT EXISTS kb_search_coll ON kb_search (collection);

-- Refresh (refresh.py runs exactly this after each sync). One transaction: TRUNCATE locks the table,
-- so a search during the rebuild waits a moment and then sees the new rows. It never sees an empty table.
BEGIN;
TRUNCATE kb_search;
INSERT INTO kb_search
SELECT chunk_id, source, collection, chunk_index, context, text, tier, embedding,
       to_tsvector('english', coalesce(context, '') || ' ' || coalesce(text, ''))
FROM kb.chunks_pg
WHERE NOT retired;
COMMIT;

-- The app's service principal reads; nobody but the refresh role writes.
-- GRANT SELECT ON kb_search TO "<app service principal client id>";

-- Dense list. The query vector is a bound parameter ($1), never a value computed inside the
-- query. Module 5's lesson: when the planner cannot treat the vector as a constant, it scans.
PREPARE dense_ids(vector, text, int) AS
SELECT chunk_id FROM kb_search
WHERE collection = $2
ORDER BY embedding <=> $1
LIMIT $3;

-- Lexical list. BM25 via the <@> operator: lower score = more relevant, so ORDER BY ascending.
PREPARE lexical_ids(text, text, int) AS
SELECT chunk_id FROM kb_search
WHERE collection = $2
ORDER BY body_tsv <@> to_bm25query(to_tsvector('english', $1), 'kb_search_bm25')
LIMIT $3;

-- Prove the indexes are used (look for kb_search_ann / kb_search_bm25, not "Seq Scan"):
-- EXPLAIN EXECUTE dense_ids('[0.01, ...]'::vector, 'policy', 20);
-- EXPLAIN EXECUTE lexical_ids('lodging cap', 'policy', 20);
