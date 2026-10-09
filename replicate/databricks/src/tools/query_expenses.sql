-- Step 14. A data tool as a Unity Catalog SQL function.
-- Local build (module 6): query_expenses with a typed schema, a row limit, and a diagnostic
-- when a filter matches nothing. A SQL function keeps the query inside the governed engine:
-- the caller needs EXECUTE on the function, and the function reads the table with UC permissions.
-- The COMMENT on the function and on each parameter is what the model sees as the tool description.
-- claim_month has a DEFAULT, so the learner (step 21) can re-run a call without it to prove that the
-- month filter, not the employee, emptied a result. employee_id has none: it is never relaxed.

CREATE SCHEMA IF NOT EXISTS agentlab.tools COMMENT 'Functions agents may call';

CREATE OR REPLACE FUNCTION agentlab.tools.query_expenses(
  employee_id STRING COMMENT 'Employee id, for example E-1042',
  claim_month STRING DEFAULT NULL COMMENT 'Month as YYYY-MM, for example 2026-03. Leave out for all months.'
)
RETURNS STRING
COMMENT 'Approved expenses for one employee in one month. Returns JSON with rows, count, total. When nothing matches, the diagnostic field says which filter emptied the result.'
RETURN
  SELECT to_json(named_struct(
    'count', m.n,
    'total', m.total,
    'rows',  m.rows,
    'diagnostic', CASE
      WHEN m.n > 0 THEN NULL
      WHEN a.n > 0 THEN concat('employee ', employee_id, ' has ', a.n, ' claims in other months; the month filter emptied this result')
      ELSE concat('no claims at all for employee ', employee_id, '; check the id')
    END))
  FROM (
    SELECT count(*) AS n,
           round(coalesce(sum(amount), 0), 2) AS total,
           slice(collect_list(named_struct('claim_id', claim_id, 'amount', amount)), 1, 200) AS rows
    FROM agentlab.finance.expenses
    WHERE employee = employee_id
      AND (claim_month IS NULL OR date_format(claim_date, 'yyyy-MM') = claim_month)
      AND status = 'approved'
  ) m,
  (SELECT count(*) AS n FROM agentlab.finance.expenses WHERE employee = employee_id) a;

GRANT EXECUTE ON FUNCTION agentlab.tools.query_expenses TO `agent-builders`;

-- Try it. The second call must return a diagnostic, not a bare zero.
SELECT agentlab.tools.query_expenses('E-1042', '2026-03');
SELECT agentlab.tools.query_expenses('E-1042', '1999-01');
