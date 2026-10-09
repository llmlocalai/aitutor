-- Step 6. Silver: typed, deduplicated, quality-checked. Gold: the three-way match exceptions.
-- A Lakeflow pipeline source file (SQL). ${tolerance_pct} and ${tolerance_abs} come from the
-- pipeline configuration in resources/pipeline.yml, so finance can change a tolerance in review.
--
-- Expectations decide what happens to a bad row: warn and keep (EXPECT), drop it (DROP ROW), or
-- stop the update (FAIL UPDATE). The choice is a business decision, written next to the rule:
-- a payment pipeline that silently drops an invoice is worse than one that stops.

CREATE OR REFRESH MATERIALIZED VIEW silver.invoices (
  CONSTRAINT has_id        EXPECT (invoice_id IS NOT NULL)              ON VIOLATION DROP ROW,
  CONSTRAINT has_vendor    EXPECT (vendor_id IS NOT NULL)               ON VIOLATION FAIL UPDATE,
  CONSTRAINT positive      EXPECT (amount > 0),
  CONSTRAINT known_ccy     EXPECT (currency IN ('USD', 'EUR', 'GBP', 'CAD')),
  CONSTRAINT has_unit      EXPECT (business_unit IS NOT NULL)           ON VIOLATION FAIL UPDATE
) COMMENT 'One row per invoice, latest version from the ERP. amount is the invoice total in currency.'
AS SELECT
  CAST(invoice_id AS STRING)            AS invoice_id,
  CAST(vendor_id AS STRING)             AS vendor_id,
  CAST(po_id AS STRING)                 AS po_id,
  CAST(business_unit AS STRING)         AS business_unit,
  CAST(invoice_date AS DATE)            AS invoice_date,
  CAST(amount AS DECIMAL(18, 2))        AS amount,
  upper(CAST(currency AS STRING))       AS currency,
  CAST(line_description AS STRING)      AS line_description,
  _source_file,
  _ingested_at,
  -- first arrival, kept across later versions: the age of an exception is measured from here
  min(_ingested_at) OVER (PARTITION BY invoice_id) AS first_seen_at
FROM bronze.invoices
QUALIFY row_number() OVER (PARTITION BY invoice_id ORDER BY _ingested_at DESC) = 1;

CREATE OR REFRESH MATERIALIZED VIEW silver.purchase_orders (
  CONSTRAINT has_id   EXPECT (po_id IS NOT NULL) ON VIOLATION DROP ROW,
  CONSTRAINT positive EXPECT (amount > 0)
) COMMENT 'One row per purchase order, latest version. amount is the approved order total.'
AS SELECT CAST(po_id AS STRING) AS po_id, CAST(vendor_id AS STRING) AS vendor_id,
          CAST(business_unit AS STRING) AS business_unit, CAST(amount AS DECIMAL(18, 2)) AS amount,
          CAST(approved_by AS STRING) AS approved_by, _ingested_at
FROM bronze.purchase_orders
QUALIFY row_number() OVER (PARTITION BY po_id ORDER BY _ingested_at DESC) = 1;

CREATE OR REFRESH MATERIALIZED VIEW silver.receipts (
  CONSTRAINT has_po EXPECT (po_id IS NOT NULL) ON VIOLATION DROP ROW
) COMMENT 'Receipts against purchase orders. received_amount is the value received.'
AS SELECT CAST(receipt_id AS STRING) AS receipt_id, CAST(po_id AS STRING) AS po_id,
          CAST(received_amount AS DECIMAL(18, 2)) AS received_amount, CAST(received_date AS DATE) AS received_date
FROM bronze.receipts
QUALIFY row_number() OVER (PARTITION BY receipt_id ORDER BY _ingested_at DESC) = 1;

CREATE OR REFRESH MATERIALIZED VIEW silver.vendors (
  CONSTRAINT has_id EXPECT (vendor_id IS NOT NULL) ON VIOLATION DROP ROW
) COMMENT 'Vendor master. bank_account is masked by policy for everyone except auditors.'
AS SELECT CAST(vendor_id AS STRING) AS vendor_id, CAST(name AS STRING) AS name,
          CAST(bank_account AS STRING) AS bank_account, CAST(risk_tier AS STRING) AS risk_tier
FROM bronze.vendors
QUALIFY row_number() OVER (PARTITION BY vendor_id ORDER BY _ingested_at DESC) = 1;

-- Gold: one row per invoice and exception type. The exception id is a hash of invoice and type, so
-- a re-run never creates a second exception for the same problem. detected_at is the invoice's first
-- arrival, not the refresh time, so backlog age and monthly trends mean something.
--
-- Matching is cumulative per purchase order: a PO billed in three partial invoices is fine until the
-- invoices together exceed the PO (price) or what was received (quantity). Comparing each invoice to
-- the whole PO would flag every partial invoice as a variance.
CREATE OR REFRESH MATERIALIZED VIEW gold.match_exceptions
COMMENT 'Invoices that fail the three-way match. One row per invoice and exception type. Amounts in invoice currency.'
AS
WITH rec AS (
  SELECT po_id, sum(received_amount) AS received_amount, count(*) AS receipts
  FROM silver.receipts GROUP BY po_id
),
m AS (
  SELECT i.invoice_id, i.vendor_id, i.po_id, i.business_unit, i.invoice_date, i.currency, i.first_seen_at,
         i.amount AS invoice_amount, p.amount AS po_amount, p.po_id AS matched_po,
         coalesce(r.received_amount, 0) AS received_amount, r.receipts,
         sum(i.amount) OVER (PARTITION BY i.po_id ORDER BY i.invoice_date, i.invoice_id
                             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS invoiced_to_date
  FROM silver.invoices i
  LEFT JOIN silver.purchase_orders p ON p.po_id = i.po_id
  LEFT JOIN rec r ON r.po_id = i.po_id
),
dups AS (
  -- One row per suspect: the later invoice (by date, then id) of a vendor/amount pair within 7 days.
  -- min_by picks a single twin, so three identical invoices still give one exception each, never two.
  SELECT b.invoice_id, min_by(a.invoice_id, a.invoice_date) AS twin_invoice_id
  FROM silver.invoices a JOIN silver.invoices b
    ON a.vendor_id = b.vendor_id AND a.amount = b.amount AND a.invoice_id <> b.invoice_id
   AND (a.invoice_date < b.invoice_date OR (a.invoice_date = b.invoice_date AND a.invoice_id < b.invoice_id))
   AND datediff(b.invoice_date, a.invoice_date) <= 7
  GROUP BY b.invoice_id
),
typed AS (
  SELECT m.*, 'no_po' AS exception_type, CAST(NULL AS STRING) AS twin_invoice_id
  FROM m WHERE m.matched_po IS NULL                    -- no PO number, or a PO the ERP does not know
  UNION ALL
  SELECT m.*, 'no_receipt', NULL FROM m WHERE m.matched_po IS NOT NULL AND m.receipts IS NULL
  UNION ALL
  SELECT m.*, 'price_variance', NULL FROM m
  WHERE m.matched_po IS NOT NULL
    AND m.invoiced_to_date - m.po_amount > greatest(${tolerance_abs}, m.po_amount * ${tolerance_pct} / 100)
  UNION ALL
  SELECT m.*, 'quantity_variance', NULL FROM m
  WHERE m.receipts IS NOT NULL
    AND m.invoiced_to_date - m.received_amount > greatest(${tolerance_abs}, m.received_amount * ${tolerance_pct} / 100)
  UNION ALL
  SELECT m.*, 'duplicate_suspect', d.twin_invoice_id FROM m JOIN dups d ON d.invoice_id = m.invoice_id
)
SELECT sha2(concat_ws('|', invoice_id, exception_type), 256) AS exception_id,
       exception_type, invoice_id, twin_invoice_id, vendor_id, po_id, business_unit, invoice_date, currency,
       invoice_amount, po_amount, received_amount, invoiced_to_date,
       round(CASE exception_type
               WHEN 'price_variance'    THEN invoiced_to_date - po_amount
               WHEN 'quantity_variance' THEN invoiced_to_date - received_amount
               ELSE NULL END, 2) AS variance,
       first_seen_at AS detected_at
FROM typed;
