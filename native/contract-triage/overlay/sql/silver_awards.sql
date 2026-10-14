-- Blueprint 1.4. One row per contract_award_unique_key, joined to the SAM.gov closeout record.
-- Tools ask about awards, not actions, so this is the grain every gold view starts from.
CREATE OR REPLACE TABLE silver_awards AS
WITH ranked AS (
  SELECT tx.*,
         ROW_NUMBER() OVER (PARTITION BY award_key ORDER BY action_order ASC)  AS first_rn,
         ROW_NUMBER() OVER (PARTITION BY award_key ORDER BY action_order DESC) AS last_rn
  FROM silver_contract_tx tx
),
first_tx AS (SELECT * FROM ranked WHERE first_rn = 1),
last_tx  AS (SELECT * FROM ranked WHERE last_rn = 1),
agg AS (
  SELECT
    award_key,
    COUNT(*)                                                         AS action_count,
    SUM(COALESCE(obligation, 0))                                     AS obligations,
    MAX(current_end)                                                 AS max_current_end,
    MAX(potential_end)                                               AS max_potential_end,
    SUM(CASE WHEN action_type_code = 'G' THEN 1 ELSE 0 END)          AS option_exercises,
    SUM(CASE WHEN action_type_code = 'C' THEN 1 ELSE 0 END)          AS funding_actions,
    SUM(CASE WHEN action_type_code = 'K' THEN 1 ELSE 0 END)          AS k_closeouts,
    SUM(CASE WHEN action_type_code IN ('E', 'F', 'X') THEN 1 ELSE 0 END) AS terminations,
    MAX(CASE WHEN action_type_code = 'C' THEN action_date END)       AS last_funding_date,
    MAX(action_date)                                                 AS last_action_date
  FROM silver_contract_tx
  GROUP BY award_key
),
sam AS (
  -- bronze_sam_awards holds SAM.gov records with closedStatus = Yes (see 02_bronze_sam.py).
  SELECT piid,
         COALESCE(NULLIF(TRIM(referenced_idv_piid), ''), '-NONE-') AS parent_piid,
         MAX(CASE WHEN UPPER(closed_status) IN ('YES', 'Y', 'TRUE') THEN 1 ELSE 0 END) AS sam_closed,
         MAX(TRY_CAST(closed_date AS DATE))                       AS sam_closed_date
  FROM bronze_sam_awards
  GROUP BY 1, 2
)
SELECT
  a.award_key,
  f.piid,
  f.parent_piid,
  f.awarding_office_code,
  l.awarding_office_name,
  f.recipient_uei,
  l.recipient_name,
  f.product_or_service_code,
  f.naics_code,
  f.extent_competed_code,
  f.number_of_offers_received,
  f.base_description,
  f.fiscal_year                                    AS first_fiscal_year,
  f.action_date                                    AS award_date,
  f.pop_start,
  COALESCE(l.current_end, a.max_current_end)       AS current_end,
  COALESCE(l.potential_end, a.max_potential_end)   AS potential_end,
  a.obligations,
  l.award_total_obligated,
  l.current_value,
  l.potential_value,
  COALESCE(l.potential_value, 0) - COALESCE(l.current_value, 0) AS remaining_option_value,
  a.action_count,
  a.option_exercises,
  a.funding_actions,
  a.k_closeouts,
  a.terminations,
  a.k_closeouts > 0                                AS has_k_closeout,
  a.terminations > 0                               AS has_termination,
  a.last_funding_date,
  a.last_action_date,
  COALESCE(s.sam_closed, 0) = 1                    AS sam_closed,
  s.sam_closed_date,
  l.usaspending_permalink
FROM agg a
JOIN first_tx f ON f.award_key = a.award_key
JOIN last_tx  l ON l.award_key = a.award_key
LEFT JOIN sam s ON s.piid = f.piid AND s.parent_piid = f.parent_piid;
