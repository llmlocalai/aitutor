-- Step 2. The storage layout. Run in a SQL editor attached to a warehouse, as a user who can create catalogs.
-- One catalog for the agent. One schema per concern, so permissions follow the concern:
--   kb     documents, chunks, ledger, edges     (the agent reads; ingestion jobs write)
--   ops    logs, findings, reports              (jobs write; people read)
--   evals  frozen questions, gold sets          (sealed: almost nobody writes)

CREATE CATALOG IF NOT EXISTS agentlab COMMENT 'Replica of the local agent build';
CREATE SCHEMA  IF NOT EXISTS agentlab.kb    COMMENT 'Knowledge bank: raw files, chunks, ledger, graph edges';
CREATE SCHEMA  IF NOT EXISTS agentlab.ops   COMMENT 'Run logs, self-observation findings, reports';
CREATE SCHEMA  IF NOT EXISTS agentlab.evals COMMENT 'Sealed evaluation material';

-- The landing zone for source files. Same folder taxonomy as knowledge-bank/ on the local machine.
CREATE VOLUME IF NOT EXISTS agentlab.kb.raw COMMENT 'Source documents, uploaded as-is';

-- The ledger: one row per source file version. Intake is a MERGE on (path), so a re-run changes nothing.
CREATE TABLE IF NOT EXISTS agentlab.kb.ledger (
  path        STRING NOT NULL,
  sha256      STRING NOT NULL,
  bytes       BIGINT,
  status      STRING,           -- accepted | rejected | retired
  reason      STRING,
  tier        INT,
  updated_at  TIMESTAMP
) TBLPROPERTIES (delta.enableChangeDataFeed = true);

-- The chunk table. Change data feed is required for a Delta Sync index on a standard endpoint
-- and for Triggered/Continuous synced tables into Lakebase.
CREATE TABLE IF NOT EXISTS agentlab.kb.chunks (
  chunk_id    STRING NOT NULL,
  source      STRING NOT NULL,
  collection  STRING NOT NULL,
  chunk_index INT,
  context     STRING,           -- heading path, embedded together with the text
  text        STRING,
  embed_text  STRING,           -- context + text: what the embedding model sees
  embedding   ARRAY<FLOAT>,     -- filled by ingest.py when you use the Lakebase backend
  tier        INT,
  retired     BOOLEAN,
  sha256      STRING,
  CONSTRAINT chunks_pk PRIMARY KEY (chunk_id)
) TBLPROPERTIES (delta.enableChangeDataFeed = true);

CREATE TABLE IF NOT EXISTS agentlab.ops.findings (
  day STRING, signal STRING, key STRING, proof STRING, created_at TIMESTAMP
);

-- Who may do what. Replace the principal names with your groups and the jobs' service principal.
GRANT USE CATALOG ON CATALOG agentlab TO `agent-builders`;
GRANT USE SCHEMA, SELECT ON SCHEMA agentlab.kb TO `agent-builders`;
GRANT USE SCHEMA, SELECT, MODIFY, CREATE TABLE ON SCHEMA agentlab.kb TO `agent-jobs-sp`;   -- edges.py overwrites its table
GRANT READ VOLUME, WRITE VOLUME ON VOLUME agentlab.kb.raw TO `agent-jobs-sp`;
GRANT USE SCHEMA, SELECT, MODIFY, CREATE TABLE ON SCHEMA agentlab.ops TO `agent-jobs-sp`;  -- the learner creates its cursor table
-- The seal: builders may read the eval schema, only the eval owner may write it.
GRANT USE SCHEMA, SELECT ON SCHEMA agentlab.evals TO `agent-builders`;
GRANT USE SCHEMA, SELECT ON SCHEMA agentlab.evals TO `agent-jobs-sp`;      -- the nightly eval reads, never writes
-- The app's own service principal (created in step 18) needs: USE SCHEMA + SELECT on kb, EXECUTE on the tools.

SHOW GRANTS ON SCHEMA agentlab.evals;
