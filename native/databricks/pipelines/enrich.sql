-- Steps 8 and 9. Document AI inside the pipeline: parse every invoice PDF once, extract the fields
-- that matter, compare them with the ERP record, and classify each invoice line's spend category.
--
-- These are STREAMING tables on purpose. A streaming table processes each new row once. A
-- materialized view may recompute from scratch, and an AI Function in a full recompute is billed
-- again for every document it has already read. On a million invoices that is the whole budget.

CREATE OR REFRESH STREAMING TABLE ai.invoice_parsed
COMMENT 'ai_parse_document output for each invoice PDF, once per file.'
AS SELECT path, _ingested_at, ai_parse_document(content, map('version', '2.0')) AS parsed
FROM STREAM(bronze.invoice_docs);

CREATE OR REFRESH STREAMING TABLE ai.invoice_fields (
  CONSTRAINT extracted EXPECT (fields:error_message IS NULL)
)
COMMENT 'Fields extracted from each parsed invoice, with confidence scores and citations.'
AS SELECT path, _ingested_at,
  ai_extract(
    parsed,
    '{
      "invoice_id":   {"type": "string", "description": "The invoice number printed on the document"},
      "vendor_name":  {"type": "string"},
      "po_number":    {"type": "string", "description": "Purchase order number, if printed"},
      "total_amount": {"type": "number", "description": "Invoice total including tax"},
      "currency":     {"type": "enum", "labels": ["USD", "EUR", "GBP", "CAD"]},
      "invoice_date": {"type": "string", "description": "Invoice date as YYYY-MM-DD"}
    }',
    map('version', '2.1', 'enableConfidenceScores', 'true', 'enableCitations', 'true',
        'instructions', 'Accounts payable invoices. Amounts are totals, not line items.')
  ) AS fields
FROM STREAM(ai.invoice_parsed);

-- The document is evidence only if it agrees with the ERP. Disagreement, low extraction confidence,
-- a missing value, or a PDF that matches no ERP invoice at all becomes a doc_mismatch for a person,
-- never a silent correction. NULL is treated as a mismatch: "could not tell" is not "agrees".
-- One row per document key: if a vendor re-sends a PDF, the latest one counts.
CREATE OR REFRESH MATERIALIZED VIEW gold.document_checks
COMMENT 'Invoice document vs. ERP invoice. mismatch = true means a person must look. business_unit UNASSIGNED: the PDF matches no ERP invoice.'
AS
WITH f AS (
  SELECT path, _ingested_at,
         coalesce(fields:response.invoice_id.value::STRING, path)      AS doc_key,
         fields:response.invoice_id.value::STRING                      AS doc_invoice_id,
         fields:response.total_amount.value::DECIMAL(18, 2)            AS doc_amount,
         fields:response.total_amount.confidence_score::DOUBLE         AS amount_confidence,
         fields:response.currency.value::STRING                        AS doc_currency
  FROM ai.invoice_fields
  QUALIFY row_number() OVER (PARTITION BY coalesce(fields:response.invoice_id.value::STRING, path)
                             ORDER BY _ingested_at DESC) = 1
)
SELECT
  coalesce(i.invoice_id, f.doc_key)                 AS invoice_id,
  coalesce(i.business_unit, 'UNASSIGNED')           AS business_unit,
  f.path, f.doc_amount, f.amount_confidence, i.amount AS erp_amount,
  coalesce(i.first_seen_at, f._ingested_at)         AS detected_at,
  coalesce(
    i.invoice_id IS NULL
    OR abs(f.doc_amount - i.amount) > 0.01
    OR f.amount_confidence < 0.8
    OR f.doc_currency <> i.currency,
    true)                                           AS mismatch
FROM f
LEFT JOIN silver.invoices i ON i.invoice_id = f.doc_invoice_id;

-- Spend category per invoice, for policy routing (different policies govern travel, software, services).
CREATE OR REFRESH STREAMING TABLE ai.invoice_category
COMMENT 'ai_classify of the invoice line description into a spend category, with confidence and rationale.'
AS SELECT invoice_id, line_description, _ingested_at,
  ai_classify(
    line_description,
    '{"software": "Licences, subscriptions, cloud services",
      "professional_services": "Consulting, contractors, audit, legal",
      "travel": "Airfare, lodging, per diem, ground transport",
      "facilities": "Rent, utilities, maintenance, cleaning",
      "goods": "Physical goods, equipment, supplies"}',
    map('version', '2.1', 'enableConfidenceScores', 'true', 'enableRationales', 'true')
  ) AS category
FROM STREAM(bronze.invoices)          -- a streaming source must be append-only; silver is a materialized view
WHERE invoice_id IS NOT NULL AND line_description IS NOT NULL;

-- The agent's work list: three-way-match exceptions plus document mismatches, one schema.
CREATE OR REFRESH MATERIALIZED VIEW gold.open_exceptions
COMMENT 'Everything the agent must triage. exception_type is one of the keys in src/agent/policy.py ALLOWED. detected_at is the first arrival of the invoice or document.'
AS
SELECT exception_id, exception_type, invoice_id, twin_invoice_id, vendor_id, po_id, business_unit,
       invoice_amount, po_amount, received_amount, variance, detected_at
FROM gold.match_exceptions
UNION ALL
SELECT sha2(concat_ws('|', d.invoice_id, 'doc_mismatch'), 256), 'doc_mismatch', d.invoice_id, NULL,
       i.vendor_id, i.po_id, d.business_unit, coalesce(d.erp_amount, d.doc_amount, 0), NULL, NULL,   -- proposals.invoice_amount is NOT NULL
       round(d.doc_amount - d.erp_amount, 2), d.detected_at
FROM gold.document_checks d LEFT JOIN silver.invoices i ON i.invoice_id = d.invoice_id
WHERE d.mismatch;
