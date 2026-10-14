-- Blueprint 1.5. Ended awards that at least one public signal says are not closed.
-- The tool's `basis` argument picks the rule; the default (both) needs no K action
-- in USAspending AND no closed record in SAM.gov.
CREATE OR REPLACE VIEW gold_closeout_candidates AS
WITH d AS (SELECT MAX(data_date) AS data_date FROM meta_freshness)
SELECT
  s.award_key, s.piid, s.parent_piid, s.awarding_office_code, s.awarding_office_name,
  s.recipient_uei, s.recipient_name, s.base_description,
  s.current_end, s.obligations, s.current_value, s.last_funding_date, s.last_action_date,
  s.has_k_closeout, s.sam_closed, s.sam_closed_date, s.has_termination,
  s.last_funding_date > s.current_end AS funded_after_end,
  s.usaspending_permalink,
  d.data_date
FROM silver_awards s CROSS JOIN d
WHERE s.current_end < d.data_date
  AND (NOT s.has_k_closeout OR NOT s.sam_closed);
