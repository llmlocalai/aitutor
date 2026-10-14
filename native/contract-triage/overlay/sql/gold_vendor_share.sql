-- Blueprint 1.5. Obligations by office, fiscal year and vendor, with each vendor's share
-- and the office-year Herfindahl-Hirschman Index: the sum of squared percentage shares,
-- 0 to 10,000. Shares use vendors with positive net obligations in the year, so a
-- deobligation cannot produce a negative share.
CREATE OR REPLACE VIEW gold_vendor_share AS
WITH v AS (
  SELECT awarding_office_code, fiscal_year,
         COALESCE(recipient_uei, 'UNKNOWN') AS recipient_uei,
         MAX(recipient_name)                AS recipient_name,
         SUM(COALESCE(obligation, 0))       AS obligations,
         COUNT(DISTINCT award_key)          AS awards
  FROM silver_contract_tx
  WHERE awarding_office_code IS NOT NULL AND fiscal_year IS NOT NULL
  GROUP BY awarding_office_code, fiscal_year, COALESCE(recipient_uei, 'UNKNOWN')
),
pos AS (SELECT * FROM v WHERE obligations > 0),
s AS (
  SELECT pos.*,
         SUM(obligations) OVER (PARTITION BY awarding_office_code, fiscal_year) AS office_year_total
  FROM pos
)
SELECT
  awarding_office_code, fiscal_year, recipient_uei, recipient_name, obligations, awards,
  office_year_total,
  CAST(obligations AS DOUBLE) / CAST(office_year_total AS DOUBLE) AS share,
  SUM(POWER(100.0 * CAST(obligations AS DOUBLE) / CAST(office_year_total AS DOUBLE), 2))
    OVER (PARTITION BY awarding_office_code, fiscal_year)         AS hhi,
  COUNT(*) OVER (PARTITION BY awarding_office_code, fiscal_year)  AS vendor_count
FROM s;
