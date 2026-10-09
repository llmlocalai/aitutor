-- Step 4. Unity Catalog layout, grants, tags and attribute-based policies for one environment.
-- Written for fin_dev. For another environment run it through src/common/apply_sql.py --catalog fin_stg,
-- which substitutes the catalog name, so the file stays runnable as is in the SQL editor for dev.
-- Medallion schemas map to who may write: pipelines write bronze/silver/gold, the AI job writes ai,
-- the agent reads gold and ai and writes nothing here (its writes go to the Lakebase review queue).

CREATE CATALOG IF NOT EXISTS fin_dev COMMENT 'Spend exceptions: development';
USE CATALOG fin_dev;

CREATE SCHEMA IF NOT EXISTS landing COMMENT 'Volumes where ERP extracts and invoice PDFs arrive';
CREATE SCHEMA IF NOT EXISTS bronze  COMMENT 'As landed, append-only';
CREATE SCHEMA IF NOT EXISTS silver  COMMENT 'Typed, deduplicated, quality-checked';
CREATE SCHEMA IF NOT EXISTS gold    COMMENT 'Business entities and match exceptions';
CREATE SCHEMA IF NOT EXISTS ai      COMMENT 'AI Function outputs: parsed documents, extracted fields, classifications';
CREATE SCHEMA IF NOT EXISTS tools   COMMENT 'Functions agents may call. Everything here is listed as an agent tool.';
CREATE SCHEMA IF NOT EXISTS governance COMMENT 'Mask and row-filter functions used by policies. Never exposed as tools.';
CREATE SCHEMA IF NOT EXISTS evals   COMMENT 'Sealed evaluation sets and results';
CREATE SCHEMA IF NOT EXISTS ops     COMMENT 'Run metrics, audit exports';

CREATE VOLUME IF NOT EXISTS landing.erp      COMMENT 'ERP extracts: invoices, purchase_orders, receipts, vendors (JSON)';
CREATE VOLUME IF NOT EXISTS landing.invoices COMMENT 'Invoice documents (PDF) as received';
CREATE VOLUME IF NOT EXISTS landing.policy   COMMENT 'Payment and procurement policy documents';
CREATE VOLUME IF NOT EXISTS ops.artifacts    COMMENT 'Eval summaries and other run outputs read by CI and people';

-- Groups (create them in the account console): fin-engineers, fin-reviewers, fin-auditors, and fin-agents
-- (put the agent app's service principal in it, so the business-unit filter applies to the agent too).
-- Service principals: the CI principals from step 3, and each app's own principal (created with the app).
GRANT USE CATALOG ON CATALOG fin_dev TO `fin-engineers`, `fin-reviewers`, `fin-auditors`;
GRANT USE SCHEMA, SELECT ON SCHEMA gold TO `fin-reviewers`, `fin-auditors`;
GRANT USE SCHEMA, SELECT ON SCHEMA ai   TO `fin-reviewers`, `fin-auditors`;
GRANT USE SCHEMA, EXECUTE ON SCHEMA tools TO `fin-reviewers`;
GRANT USE SCHEMA, SELECT ON SCHEMA evals TO `fin-engineers`;            -- read the exam, never write it
-- Service principals are named by application (client) id in grants, not by display name.
-- The deploying principal owns what it deploys; in dev an engineer's own login deploys instead.
-- Grant the CI principal per SCHEMA, never on the catalog: privileges in Unity Catalog only add up, there is
-- no deny, so CREATE FUNCTION on the catalog would reach governance whatever a later REVOKE on it says.
-- Run these in stg and prd (apply_sql.py substitutes the catalog); replace the id with your CI principal's.
-- GRANT USE CATALOG ON CATALOG fin_dev TO `<ci-application-id>`;
-- GRANT USE SCHEMA, CREATE TABLE, CREATE MATERIALIZED VIEW, MODIFY, SELECT ON SCHEMA bronze TO `<ci-application-id>`;
-- GRANT USE SCHEMA, CREATE TABLE, CREATE MATERIALIZED VIEW, MODIFY, SELECT ON SCHEMA silver TO `<ci-application-id>`;
-- GRANT USE SCHEMA, CREATE TABLE, CREATE MATERIALIZED VIEW, MODIFY, SELECT ON SCHEMA gold   TO `<ci-application-id>`;
-- GRANT USE SCHEMA, CREATE TABLE, CREATE MATERIALIZED VIEW, MODIFY, SELECT ON SCHEMA ai     TO `<ci-application-id>`;
-- GRANT USE SCHEMA, CREATE FUNCTION ON SCHEMA tools TO `<ci-application-id>`;
-- GRANT USE SCHEMA, READ VOLUME ON SCHEMA landing TO `<ci-application-id>`;
-- No grant at all on governance: its owner is the catalog-admins group, and only that group changes it.
-- The pipeline runs as the bundle's run_as principal (the jobs runtime principal in stg and prd), so that
-- principal needs the same bronze, silver, gold and ai lines; the CI principal needs them for the first
-- deploy and for apply_sql.py.

-- The agent app's principal reads gold and ai, calls tools, and nothing else.
GRANT USE CATALOG ON CATALOG fin_dev TO `fin-agents`;
GRANT USE SCHEMA, SELECT ON SCHEMA gold TO `fin-agents`;
GRANT USE SCHEMA, SELECT ON SCHEMA ai   TO `fin-agents`;
GRANT USE SCHEMA, EXECUTE ON SCHEMA tools TO `fin-agents`;
-- The jobs principal (batch triage, export, eval) reads gold and evals, writes ops.
GRANT USE CATALOG ON CATALOG fin_dev TO `<jobs-application-id>`;
GRANT USE SCHEMA, SELECT ON SCHEMA gold TO `<jobs-application-id>`;
GRANT USE SCHEMA, SELECT ON SCHEMA evals TO `<jobs-application-id>`;
GRANT USE SCHEMA, SELECT, MODIFY, CREATE TABLE ON SCHEMA ops TO `<jobs-application-id>`;
GRANT READ VOLUME, WRITE VOLUME ON VOLUME ops.artifacts TO `<jobs-application-id>`;
-- Nobody but catalog admins may create or replace functions in governance: a replaced mask function
-- would switch a policy off for every table at once. A REVOKE cannot protect it (privileges only add up),
-- so ownership does: the schema belongs to catalog-admins, and nobody else holds any privilege on it,
-- directly or through the catalog. Check with SHOW GRANTS below; any row besides the owner is a finding.
ALTER SCHEMA governance OWNER TO `catalog-admins`;
SHOW GRANTS ON SCHEMA governance;

-- Governed tags mark what is sensitive; policies then apply to every table that carries the tag,
-- including tables that do not exist yet. Create the governed tag keys 'pii' and 'scope' in
-- Catalog Explorer > Govern > Governed Tags first.
CREATE OR REPLACE FUNCTION governance.mask_account(v STRING) RETURNS STRING
  RETURN CASE WHEN is_account_group_member('fin-auditors') THEN v ELSE concat('****', right(v, 4)) END;

-- Row scope: a reviewer (or the agent) sees rows of their business units only. reviewer_scope maps
-- principals to units; the agent's principal gets one row per unit it triages, like any reviewer.
CREATE TABLE IF NOT EXISTS gold.reviewer_scope (reviewer STRING NOT NULL, business_unit STRING NOT NULL)
  COMMENT 'Who reviews which business unit. Maintained by finance operations.';

-- Every unit that can appear in gold.open_exceptions needs at least one reviewer AND the agent's principal,
-- or its exceptions reach nobody. That includes UNASSIGNED: invoice PDFs that match no ERP invoice
-- (step 8). Route them to the accounts-payable intake team, who find or reject the invoice.
-- Step 20 alerts on any open unit with no reviewer row. Replace the principals with yours.
-- INSERT INTO gold.reviewer_scope VALUES
--   ('ap-intake-lead@example.com', 'UNASSIGNED'),
--   ('<agent-app-client-id>',      'UNASSIGNED'),
--   ('<agent-app-client-id>',      'EMEA'), ('<agent-app-client-id>', 'NA');

CREATE OR REPLACE FUNCTION governance.in_my_units(bu STRING) RETURNS BOOLEAN
  RETURN is_account_group_member('fin-auditors')
      OR EXISTS (SELECT 1 FROM gold.reviewer_scope s WHERE s.reviewer = current_user() AND s.business_unit = bu);

CREATE POLICY mask_bank_accounts
  ON SCHEMA silver
  COLUMN MASK governance.mask_account
  TO `account users`
  FOR TABLES
  MATCH COLUMNS has_tag_value('pii', 'bank_account') AS acct
  ON COLUMN acct;

CREATE POLICY business_unit_scope
  ON SCHEMA gold
  ROW FILTER governance.in_my_units
  TO `fin-reviewers`, `fin-agents`
  FOR TABLES
  MATCH COLUMNS has_tag_value('scope', 'business_unit') AS bu_col
  USING COLUMNS (bu_col);

-- Tag the columns once the pipeline has created the tables (step 6). Policies take effect immediately.
-- ALTER TABLE silver.vendors       ALTER COLUMN bank_account  SET TAGS ('pii' = 'bank_account');
-- ALTER TABLE gold.match_exceptions ALTER COLUMN business_unit SET TAGS ('scope' = 'business_unit');

SHOW GRANTS ON SCHEMA evals;
