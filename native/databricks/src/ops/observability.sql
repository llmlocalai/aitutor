-- Step 20. Observability: the five numbers the owner of this workflow reads every morning.
-- Every resource in the bundle carries the tag workload = spend-exceptions (databricks.yml presets),
-- so cost is attributable to this workflow and not lost in a shared workspace bill.

-- 1. Cost per day by product, for this workload only.
SELECT usage_date, billing_origin_product, round(sum(usage_quantity), 2) AS dbus
FROM system.billing.usage
WHERE custom_tags['workload'] = 'spend-exceptions'
  AND usage_date >= current_date() - INTERVAL 30 DAYS
GROUP BY ALL ORDER BY usage_date DESC, dbus DESC;

-- 2. Unit economics: DBUs per exception triaged. A rising line with flat volume is a prompt, a model
--    or a loop problem; read the traces before raising the budget. (Convert DBUs to currency with
--    system.billing.list_prices for your SKU.)
WITH spend AS (
  SELECT usage_date AS d, sum(usage_quantity) AS dbus FROM system.billing.usage
  WHERE custom_tags['workload'] = 'spend-exceptions' GROUP BY 1),
work AS (
  SELECT date(decided_at) AS d, count(DISTINCT exception_id) AS triaged FROM fin_prd.ops.decisions_history GROUP BY 1)
SELECT w.d, w.triaged, round(s.dbus, 2) AS dbus, round(s.dbus / nullif(w.triaged, 0), 4) AS dbus_per_exception
FROM work w LEFT JOIN spend s USING (d) ORDER BY w.d DESC LIMIT 30;

-- 3. Quality as people see it: approval rate and the actions reviewers corrected, by week.
SELECT date_trunc('WEEK', decided_at) AS week,
       round(avg(CASE WHEN verdict IN ('approve', 'second_approve') THEN 1 ELSE 0 END), 3) AS approval_rate,
       count_if(verdict = 'reject') AS rejected,
       count_if(verdict = 'reject' AND proposed_action = 'approve_payment') AS rejected_payments
FROM fin_prd.ops.decisions_history GROUP BY 1 ORDER BY 1 DESC;

-- 4. Backlog: how old is the oldest exception with no decision? The SLO is contract.yml service_levels.backlog_max_days.
SELECT business_unit, count(*) AS open, max(datediff(current_date(), detected_at)) AS oldest_days
FROM fin_prd.gold.open_exceptions e
WHERE NOT EXISTS (SELECT 1 FROM fin_prd.ops.decisions_history d WHERE d.exception_id = e.exception_id)
GROUP BY business_unit ORDER BY oldest_days DESC;

-- 5. Data quality: rows the pipeline expectations dropped or flagged in the last day, from the event log.
--    event_log() takes the pipeline's table; any of its tables works.
SELECT timestamp, details:flow_progress.data_quality.expectations AS expectations
FROM event_log(TABLE(fin_prd.silver.invoices))
WHERE event_type = 'flow_progress' AND details:flow_progress.data_quality IS NOT NULL
  AND timestamp >= current_timestamp() - INTERVAL 1 DAY
ORDER BY timestamp DESC;

-- 6. Routing: business units with open exceptions but no human reviewer, or not in the agent's scope.
--    Run as an auditor (the row filter shows auditors every unit). Any row here is work that reaches nobody;
--    alert on count > 0. Replace <agent-app-client-id>.
SELECT e.business_unit, count(*) AS open,
       NOT EXISTS (SELECT 1 FROM fin_prd.gold.reviewer_scope s
                   WHERE s.business_unit = e.business_unit AND s.reviewer <> '<agent-app-client-id>') AS no_reviewer,
       NOT EXISTS (SELECT 1 FROM fin_prd.gold.reviewer_scope s
                   WHERE s.business_unit = e.business_unit AND s.reviewer = '<agent-app-client-id>')  AS agent_cannot_see
FROM fin_prd.gold.open_exceptions e
GROUP BY e.business_unit
HAVING no_reviewer OR agent_cannot_see;
