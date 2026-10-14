-- Blueprint 1.5. One row per awarding office: what contracts_find_office searches.
CREATE OR REPLACE VIEW gold_offices AS
WITH d AS (SELECT MAX(data_date) AS data_date FROM meta_freshness)
SELECT
  s.awarding_office_code,
  MAX(s.awarding_office_name)                                            AS awarding_office_name,
  COUNT(*)                                                               AS award_count,
  SUM(CASE WHEN s.current_end > d.data_date AND NOT s.has_k_closeout
            AND NOT s.has_termination AND NOT s.sam_closed THEN 1 ELSE 0 END) AS open_count,
  SUM(CASE WHEN s.current_end <= d.data_date THEN 1 ELSE 0 END)          AS ended_count,
  SUM(CASE WHEN s.has_k_closeout OR s.sam_closed THEN 1 ELSE 0 END)      AS closed_count,
  SUM(s.obligations)                                                     AS obligations
FROM silver_awards s CROSS JOIN d
WHERE s.awarding_office_code IS NOT NULL AND s.awarding_office_code <> ''
GROUP BY s.awarding_office_code;
