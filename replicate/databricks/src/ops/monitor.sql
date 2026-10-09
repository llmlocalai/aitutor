-- Step 22. The one-screen status, as SQL. Save these as queries on a dashboard; alert on the last three.
-- Local build (module 15): Check-All-LLM-Status prints every service and model on one screen.

-- 1. Spend by product, last 14 days. system.billing.usage is the account-wide billing system table.
SELECT usage_date, billing_origin_product, sku_name, round(sum(usage_quantity), 2) AS dbus
FROM system.billing.usage
WHERE usage_date >= current_date() - INTERVAL 14 DAYS
  AND billing_origin_product IN ('MODEL_SERVING', 'VECTOR_SEARCH', 'APPS', 'JOBS', 'DATABASE', 'SQL')
GROUP BY ALL
ORDER BY usage_date DESC, dbus DESC;
-- Product names in this column change as products are renamed. Run
--   SELECT DISTINCT billing_origin_product FROM system.billing.usage
-- once and adjust the IN list to what your account reports.

-- 2. Knowledge freshness: how old is the newest accepted document, and how many were rejected this week?
SELECT max(updated_at) AS newest_document,
       count_if(status = 'rejected' AND updated_at >= current_timestamp() - INTERVAL 7 DAYS) AS rejected_7d,
       count_if(status = 'accepted') AS accepted_total
FROM agentlab.kb.ledger;

-- 3. Chunks in service versus retired. A sudden drop in service means an ingest retired too much.
SELECT collection, count_if(NOT retired) AS in_service, count_if(retired) AS retired
FROM agentlab.kb.chunks GROUP BY collection ORDER BY collection;

-- 4. Self-observation findings per night. A rising line is the first sign of a broken tool or prompt.
SELECT day, signal, count(*) AS n FROM agentlab.ops.findings
WHERE day >= date_format(current_date() - INTERVAL 14 DAYS, 'yyyy-MM-dd')
GROUP BY ALL ORDER BY day DESC, n DESC;

-- 5. Did last night's jobs run? Lakeflow job runs live in the system.lakeflow schema (check the table
--    names your account exposes with SHOW TABLES IN system.lakeflow).
SELECT job_id, result_state, period_start_time, period_end_time
FROM system.lakeflow.job_run_timeline
WHERE period_start_time >= current_timestamp() - INTERVAL 2 DAYS
ORDER BY period_start_time DESC;
