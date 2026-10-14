-- Blueprint 3.2. Read-only access for the app's service principal. Render with
-- scripts/render.py, then run in the SQL editor as the catalog or schema owner.
GRANT USE CATALOG ON CATALOG `${CATALOG}` TO `${APP_SP}`;
GRANT USE SCHEMA ON SCHEMA `${CATALOG}`.contract_triage TO `${APP_SP}`;
GRANT SELECT ON SCHEMA `${CATALOG}`.contract_triage TO `${APP_SP}`;
-- The proof the principal cannot write: run as the app (see step 3.2), expect PERMISSION_DENIED.
-- INSERT INTO `${CATALOG}`.contract_triage.meta_freshness VALUES (current_date(), 'x', 0, current_timestamp());
