-- Blueprint 4.1. The answer key, computed from BRONZE only, written separately from the
-- silver and gold SQL so a bug in one does not hide in both. Each query is named with
-- "-- name:", takes :office, :start and :end (dates as YYYY-MM-DD text), and returns
-- one row per item; build_golden.py counts and compares in Python, which keeps the SQL
-- free of aggregate functions that DuckDB and Databricks spell differently.
-- eval/build_golden.py runs these on DuckDB (laptop) or a SQL warehouse (Databricks).
-- On Databricks, run them as yourself, not as the app: the app's principal has no grant
-- on the contract_triage_eval schema where the results are stored.

-- name: ending_ids
-- Open awards whose end date, as stated on their most recent action, falls in (start, end].
WITH last_action AS (
  SELECT contract_award_unique_key AS k, MAX(CONCAT(SUBSTR(action_date, 1, 10), '|', modification_number)) AS last_key
  FROM bronze_usas_contract_tx WHERE awarding_office_code = :office GROUP BY 1
),
ends AS (
  SELECT b.contract_award_unique_key AS k, b.award_id_piid AS piid,
         COALESCE(NULLIF(b.parent_award_id_piid, ''), '-NONE-') AS parent,
         TRY_CAST(SUBSTR(b.period_of_performance_current_end_date, 1, 10) AS DATE) AS end_date
  FROM bronze_usas_contract_tx b JOIN last_action l
    ON l.k = b.contract_award_unique_key
   AND l.last_key = CONCAT(SUBSTR(b.action_date, 1, 10), '|', b.modification_number)
),
closed_or_ended AS (
  SELECT DISTINCT contract_award_unique_key AS k FROM bronze_usas_contract_tx
  WHERE action_type_code IN ('K', 'E', 'F', 'X')
),
sam_closed AS (
  SELECT DISTINCT piid, COALESCE(NULLIF(referenced_idv_piid, ''), '-NONE-') AS parent
  FROM bronze_sam_awards WHERE UPPER(closed_status) = 'YES'
)
SELECT e.piid AS id
FROM ends e
LEFT JOIN closed_or_ended c ON c.k = e.k
LEFT JOIN sam_closed s ON s.piid = e.piid AND s.parent = e.parent
WHERE c.k IS NULL AND s.piid IS NULL
  AND e.end_date > CAST(:start AS DATE) AND e.end_date <= CAST(:end AS DATE);

-- name: closeout_ids
-- Ended before :start, no K action, not closed in SAM.gov (terminated awards count).
WITH last_action AS (
  SELECT contract_award_unique_key AS k, MAX(CONCAT(SUBSTR(action_date, 1, 10), '|', modification_number)) AS last_key
  FROM bronze_usas_contract_tx WHERE awarding_office_code = :office GROUP BY 1
),
ends AS (
  SELECT b.contract_award_unique_key AS k, b.award_id_piid AS piid,
         COALESCE(NULLIF(b.parent_award_id_piid, ''), '-NONE-') AS parent,
         TRY_CAST(SUBSTR(b.period_of_performance_current_end_date, 1, 10) AS DATE) AS end_date
  FROM bronze_usas_contract_tx b JOIN last_action l
    ON l.k = b.contract_award_unique_key
   AND l.last_key = CONCAT(SUBSTR(b.action_date, 1, 10), '|', b.modification_number)
),
k AS (SELECT DISTINCT contract_award_unique_key AS k FROM bronze_usas_contract_tx WHERE action_type_code = 'K'),
sam_closed AS (
  SELECT DISTINCT piid, COALESCE(NULLIF(referenced_idv_piid, ''), '-NONE-') AS parent
  FROM bronze_sam_awards WHERE UPPER(closed_status) = 'YES'
)
SELECT e.piid AS id
FROM ends e LEFT JOIN k ON k.k = e.k
LEFT JOIN sam_closed s ON s.piid = e.piid AND s.parent = e.parent
WHERE k.k IS NULL AND s.piid IS NULL AND e.end_date < CAST(:start AS DATE);

-- name: decoy_ids
-- Ended, no K action, but closed in SAM.gov: must NOT appear in a default closeout list.
WITH k AS (SELECT DISTINCT contract_award_unique_key AS k FROM bronze_usas_contract_tx WHERE action_type_code = 'K')
SELECT DISTINCT b.award_id_piid AS id
FROM bronze_usas_contract_tx b
JOIN bronze_sam_awards s ON s.piid = b.award_id_piid
 AND COALESCE(NULLIF(s.referenced_idv_piid, ''), '-NONE-') = COALESCE(NULLIF(b.parent_award_id_piid, ''), '-NONE-')
LEFT JOIN k ON k.k = b.contract_award_unique_key
WHERE b.awarding_office_code = :office AND UPPER(s.closed_status) = 'YES' AND k.k IS NULL;

-- name: top_vendor_share
-- Net obligations per vendor in fiscal year YEAR(:end); Python takes the top share
-- over vendors with positive totals.
WITH v AS (
  SELECT COALESCE(NULLIF(recipient_uei, ''), 'UNKNOWN') AS uei,
         SUM(TRY_CAST(federal_action_obligation AS DOUBLE)) AS obl
  FROM bronze_usas_contract_tx
  WHERE awarding_office_code = :office
    AND TRY_CAST(action_date_fiscal_year AS INT) = YEAR(CAST(:end AS DATE))
  GROUP BY 1
)
SELECT uei AS id, obl AS value FROM v WHERE obl > 0;
