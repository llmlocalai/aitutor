-- Step 7. The semantic layer: one definition of each business number, used by dashboards, Genie and the agent.
-- Without it, "open exposure" is computed three ways in three places and the agent's figure will not
-- match the dashboard the CFO looks at. A metric view makes the definition a governed object.

CREATE OR REPLACE VIEW fin_dev.gold.exception_metrics
WITH METRICS
LANGUAGE YAML
AS $$
version: 1.1
source: fin_dev.gold.open_exceptions
dimensions:
  - name: Business Unit
    expr: business_unit
  - name: Exception Type
    expr: exception_type
  - name: Month
    expr: DATE_TRUNC('MONTH', detected_at)
measures:
  - name: Open Exceptions
    expr: COUNT(1)
    comment: "Invoices currently failing the match or the document check"
  - name: Open Exposure
    expr: SUM(invoice_amount)
    comment: "Invoice value held by open exceptions, in invoice currency"
  - name: Net Variance
    expr: SUM(variance)
    comment: "Invoice minus PO (price) or minus received (quantity); null for other types"
$$;

-- Query a metric view with MEASURE(); the grouping decides the grain, the definition stays fixed.
SELECT `Business Unit`, `Exception Type`, MEASURE(`Open Exceptions`), MEASURE(`Open Exposure`)
FROM fin_dev.gold.exception_metrics
GROUP BY ALL
ORDER BY 4 DESC;

-- Comments are not decoration. Genie and the agent read table and column comments to choose
-- columns; a column called amt2 with no comment is a wrong answer waiting to happen.
-- Tables owned by a pipeline get their comments in the pipeline definition (the COMMENT clauses in
-- pipelines/*.sql), because the pipeline owns their schema. Check what Genie will see:
DESCRIBE TABLE EXTENDED fin_dev.gold.open_exceptions;
-- Tables you own directly take comments here:
COMMENT ON TABLE fin_dev.gold.reviewer_scope IS 'Who reviews which business unit. Used by the row filter policy.';
