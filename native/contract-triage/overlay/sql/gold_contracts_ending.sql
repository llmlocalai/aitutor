-- Blueprint 1.5. Open awards whose current end date is after the data date.
-- "Open" means no K closeout, no termination, and not closed in SAM.gov.
-- The window is measured from the data date, not today, so answers and the eval set
-- do not drift from one day to the next. The tool applies the days-ahead window.
CREATE OR REPLACE VIEW gold_contracts_ending AS
WITH d AS (SELECT MAX(data_date) AS data_date FROM meta_freshness)
SELECT
  s.award_key, s.piid, s.parent_piid, s.awarding_office_code, s.awarding_office_name,
  s.recipient_uei, s.recipient_name, s.base_description,
  s.current_end, s.potential_end, s.current_value, s.potential_value,
  s.remaining_option_value, s.option_exercises, s.obligations,
  s.potential_end > s.current_end OR s.remaining_option_value > 0 AS has_options_left,
  s.extent_competed_code, s.number_of_offers_received, s.usaspending_permalink,
  d.data_date
FROM silver_awards s CROSS JOIN d
WHERE s.current_end > d.data_date
  AND NOT s.has_k_closeout
  AND NOT s.has_termination
  AND NOT s.sam_closed;
