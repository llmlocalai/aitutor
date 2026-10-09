-- Step 15. The review queue in Lakebase Postgres: the only place the agent writes.
-- Why Postgres and not a Delta table: a queue is many small concurrent updates with row locks
-- ("I am reviewing this one"), which is what an OLTP database is for. Decisions are then copied
-- to Delta for audit and analytics (resources/jobs.yml, task export_decisions).
-- Run with psql against the Lakebase database as an admin role, not as the app: the owner of a table
-- can always update it, so the app must not own the decisions table it may only append to.

CREATE TABLE IF NOT EXISTS proposals (
  proposal_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_id    text NOT NULL,
  exception_type  text NOT NULL,
  business_unit   text NOT NULL,
  invoice_amount  numeric(18, 2) NOT NULL,
  action          text NOT NULL CHECK (action IN ('approve_payment', 'hold_payment', 'request_credit_memo', 'escalate')),
  rationale       text NOT NULL,
  citations       jsonb NOT NULL DEFAULT '[]',
  evidence        jsonb NOT NULL DEFAULT '[]',
  confidence      numeric(4, 3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  model           text NOT NULL,
  prompt_version  text NOT NULL,
  trace_id        text,                         -- links the proposal to its MLflow trace
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'needs_second', 'superseded')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
-- One live proposal per exception: a re-run supersedes the old one, it never adds a second.
-- A partial unique index, because many rejected or superseded rows for one exception are fine.
CREATE UNIQUE INDEX IF NOT EXISTS proposals_one_pending ON proposals (exception_id) WHERE status IN ('pending', 'needs_second');
CREATE INDEX IF NOT EXISTS proposals_queue ON proposals (business_unit, status, created_at);

-- Decisions are append-only. Nobody updates or deletes a decision; a correction is a new row.
CREATE TABLE IF NOT EXISTS decisions (
  decision_id   bigserial PRIMARY KEY,
  proposal_id   uuid NOT NULL REFERENCES proposals (proposal_id),
  reviewer      text NOT NULL,
  verdict       text NOT NULL CHECK (verdict IN ('approve', 'reject', 'second_approve')),
  -- A rejection must say what the right action was. Without it, a rejection is not a label, and the
  -- evaluation set (step 16) can only learn from the agent's successes.
  correct_action text CHECK (correct_action IN ('approve_payment', 'hold_payment', 'request_credit_memo', 'escalate')),
  comment       text,
  CONSTRAINT reject_has_answer CHECK (verdict <> 'reject' OR correct_action IS NOT NULL),
  decided_at    timestamptz NOT NULL DEFAULT now()
);
-- The database enforces the payment control, not only the app: whoever holds a connection, no proposal
-- becomes approved without recorded approvals, a large one needs two different approvers, and nothing
-- is inserted already decided. 25000 must equal contract.yml second_approver_above (a test checks it).
-- SECURITY DEFINER: the check reads decisions with the owner's rights, so it works for the agent (which
-- may not read decisions). Every table is schema-qualified and pg_temp is searched last, so a caller cannot
-- shadow public.decisions with a temporary table full of fake approvals (a test tries exactly that).
CREATE OR REPLACE FUNCTION guard_proposal() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE approvers int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' THEN RAISE EXCEPTION 'a proposal is inserted as pending, not %', NEW.status; END IF;
    RETURN NEW;
  END IF;
  IF OLD.status NOT IN ('pending', 'needs_second') THEN
    RAISE EXCEPTION 'proposal is %, it can no longer change', OLD.status;
  END IF;
  IF NEW.invoice_amount <> OLD.invoice_amount OR NEW.action <> OLD.action OR NEW.business_unit <> OLD.business_unit THEN
    RAISE EXCEPTION 'only status may change on a proposal';
  END IF;
  SELECT count(DISTINCT reviewer) INTO approvers FROM public.decisions
   WHERE proposal_id = NEW.proposal_id AND verdict IN ('approve', 'second_approve');
  IF NEW.status = 'needs_second' AND (approvers < 1 OR NEW.invoice_amount <= 25000) THEN
    RAISE EXCEPTION 'needs_second requires one approval on an amount above the threshold';
  ELSIF NEW.status = 'approved' AND (approvers < 1 OR (NEW.invoice_amount > 25000 AND approvers < 2)) THEN
    RAISE EXCEPTION 'approved requires % different approvers', CASE WHEN NEW.invoice_amount > 25000 THEN 2 ELSE 1 END;
  ELSIF NEW.status = 'rejected' AND NOT EXISTS (SELECT 1 FROM public.decisions WHERE proposal_id = NEW.proposal_id AND verdict = 'reject') THEN
    RAISE EXCEPTION 'rejected requires a recorded rejection';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proposals_guard ON proposals;
CREATE TRIGGER proposals_guard BEFORE INSERT OR UPDATE ON proposals FOR EACH ROW EXECUTE FUNCTION guard_proposal();

REVOKE ALL ON proposals, decisions FROM PUBLIC;
DO $$ BEGIN EXECUTE format('REVOKE TEMPORARY ON DATABASE %I FROM PUBLIC', current_database()); END $$;
-- Principals are Postgres roles named by client id. Column-level UPDATE: nobody can rewrite an amount.
--   agent: inserts proposals and supersedes its own pending ones
--   app:   reads, records decisions, moves status (the trigger checks every move)
--   jobs:  reads, for batch selection and the export to Delta
GRANT SELECT, INSERT ON proposals TO "<agent client id>";
GRANT UPDATE (status) ON proposals TO "<agent client id>", "<app client id>";
GRANT SELECT ON proposals TO "<app client id>", "<jobs client id>";
GRANT SELECT, INSERT ON decisions TO "<app client id>";          -- append only: no UPDATE, no DELETE
GRANT SELECT ON decisions TO "<jobs client id>";
GRANT USAGE ON SEQUENCE decisions_decision_id_seq TO "<app client id>";
