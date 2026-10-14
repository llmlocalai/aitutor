-- Blueprint 1.4. One typed row per contract action, from bronze strings.
-- Runs unchanged on Databricks SQL and DuckDB: TRY_CAST, CASE and window functions only,
-- and no date arithmetic (tools compute day counts in Python).
-- Bronze keeps every value as text, so a bad date in one row cannot fail the load.
CREATE OR REPLACE TABLE silver_contract_tx AS
SELECT
  contract_transaction_unique_key                                AS tx_key,
  contract_award_unique_key                                      AS award_key,
  award_id_piid                                                  AS piid,
  COALESCE(NULLIF(TRIM(parent_award_id_piid), ''), '-NONE-')     AS parent_piid,
  COALESCE(modification_number, '0')                             AS modification_number,
  NULLIF(TRIM(action_type_code), '')                             AS action_type_code,
  TRY_CAST(federal_action_obligation AS DECIMAL(18, 2))          AS obligation,
  TRY_CAST(total_dollars_obligated AS DECIMAL(18, 2))            AS award_total_obligated,
  TRY_CAST(current_total_value_of_award AS DECIMAL(18, 2))       AS current_value,
  TRY_CAST(potential_total_value_of_award AS DECIMAL(18, 2))     AS potential_value,
  TRY_CAST(SUBSTR(action_date, 1, 10) AS DATE)                   AS action_date,
  TRY_CAST(action_date_fiscal_year AS INT)                       AS fiscal_year,
  TRY_CAST(SUBSTR(period_of_performance_start_date, 1, 10) AS DATE)       AS pop_start,
  TRY_CAST(SUBSTR(period_of_performance_current_end_date, 1, 10) AS DATE) AS current_end,
  TRY_CAST(SUBSTR(period_of_performance_potential_end_date, 1, 10) AS DATE) AS potential_end,
  awarding_office_code,
  awarding_office_name,
  NULLIF(TRIM(recipient_uei), '')                                AS recipient_uei,
  recipient_name,
  product_or_service_code,
  naics_code,
  extent_competed_code,
  TRY_CAST(number_of_offers_received AS INT)                     AS number_of_offers_received,
  prime_award_base_transaction_description                       AS base_description,
  usaspending_permalink,
  TRY_CAST(SUBSTR(last_modified_date, 1, 10) AS DATE)            AS last_modified,
  -- Sort key for "earliest" and "latest" action: date first, then modification number.
  CONCAT(COALESCE(SUBSTR(action_date, 1, 10), '0000-00-00'), '|',
         COALESCE(modification_number, '0'))                     AS action_order
FROM bronze_usas_contract_tx
WHERE contract_award_unique_key IS NOT NULL
  AND contract_award_unique_key <> '';
