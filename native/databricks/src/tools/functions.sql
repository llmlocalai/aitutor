-- Step 12. Read tools as Unity Catalog SQL functions. The agent reaches them through the managed MCP
-- endpoint for functions, and every call runs with Unity Catalog permissions. The agent's principal is
-- in fin-agents, so the business-unit row filter from step 4 applies to it exactly as to a reviewer.
-- Written for fin_dev; CI applies it to stg and prd with src/common/apply_sql.py.
-- The COMMENTs are the tool descriptions the model reads. Write them for a model: what it returns,
-- in which units, and what an empty answer means.

CREATE OR REPLACE FUNCTION fin_dev.tools.get_exception(exception_id STRING COMMENT 'The exception_id from gold.open_exceptions')
RETURNS STRING
COMMENT 'All facts for one exception as JSON: type, invoice, PO, receipts, amounts, variance, the document check, the spend category. Returns {"found": false, "diagnostic": ...} if the id is unknown or outside your business units.'
RETURN
  SELECT coalesce(
    (SELECT to_json(named_struct(
        'found', true,
        'exception_id', e.exception_id, 'exception_type', e.exception_type,
        'invoice_id', e.invoice_id, 'twin_invoice_id', e.twin_invoice_id,
        'vendor_id', e.vendor_id, 'po_id', e.po_id, 'business_unit', e.business_unit,
        'invoice_amount', e.invoice_amount, 'po_amount', e.po_amount,
        'received_amount', e.received_amount, 'variance', e.variance,
        'doc_amount', d.doc_amount, 'doc_confidence', d.amount_confidence,
        'spend_category', c.category:response[0].value::STRING))
     FROM fin_dev.gold.open_exceptions e
     LEFT JOIN fin_dev.gold.document_checks d ON d.invoice_id = e.invoice_id
     LEFT JOIN (SELECT invoice_id, max_by(category, _ingested_at) AS category      -- the latest classification
                FROM fin_dev.ai.invoice_category GROUP BY invoice_id) c ON c.invoice_id = e.invoice_id
     WHERE e.exception_id = get_exception.exception_id
     LIMIT 1),
    to_json(named_struct('found', false, 'diagnostic',
      'no open exception with this id that you may see; it may be resolved, mistyped, or in another business unit')));

CREATE OR REPLACE FUNCTION fin_dev.tools.vendor_history(vendor_id STRING COMMENT 'Vendor id from the exception')
RETURNS STRING
COMMENT 'Twelve-month exception history for one vendor as JSON: counts by type and total variance. Use it to judge whether an exception is a pattern.'
RETURN
  SELECT to_json(named_struct(
    'vendor_id', vendor_history.vendor_id,
    'risk_tier', (SELECT max(risk_tier) FROM fin_dev.silver.vendors v WHERE v.vendor_id = vendor_history.vendor_id),
    'by_type', (SELECT map_from_entries(collect_list(struct(exception_type, n)))
                FROM (SELECT exception_type, count(*) AS n FROM fin_dev.gold.open_exceptions e
                      WHERE e.vendor_id = vendor_history.vendor_id
                        AND e.detected_at >= current_timestamp() - INTERVAL 365 DAYS
                      GROUP BY exception_type)),
    'total_variance', (SELECT round(coalesce(sum(variance), 0), 2) FROM fin_dev.gold.open_exceptions e
                       WHERE e.vendor_id = vendor_history.vendor_id)));

GRANT EXECUTE ON FUNCTION fin_dev.tools.get_exception  TO `fin-reviewers`, `fin-agents`;
GRANT EXECUTE ON FUNCTION fin_dev.tools.vendor_history TO `fin-reviewers`, `fin-agents`;

-- Try them. The second call must return found=false with a diagnostic, never an error or an empty string.
SELECT fin_dev.tools.get_exception((SELECT exception_id FROM fin_dev.gold.open_exceptions LIMIT 1));
SELECT fin_dev.tools.get_exception('no-such-id');
