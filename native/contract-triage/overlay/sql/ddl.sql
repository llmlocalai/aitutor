-- Blueprint 0.8 and 1.x. Objects the pipeline expects. Run after USE CATALOG <catalog>.
-- pipelines/00_setup.py runs this file; it is safe to run again.
CREATE SCHEMA IF NOT EXISTS contract_triage COMMENT 'Contract triage: public USAspending and SAM.gov data';
USE SCHEMA contract_triage;
CREATE VOLUME IF NOT EXISTS raw COMMENT 'Downloaded public files (zips, CSVs, extracts)';

-- Filled by 02_bronze_sam.py. Created empty so silver builds even before SAM.gov loads.
CREATE TABLE IF NOT EXISTS bronze_sam_awards (
  piid STRING, referenced_idv_piid STRING, modification_number STRING,
  contracting_office_code STRING, closed_status STRING, closed_date STRING,
  current_completion_date STRING, ultimate_completion_date STRING, date_signed STRING,
  _source STRING, _loaded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meta_freshness (
  data_date DATE, source STRING, rows BIGINT, loaded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dq_results (
  run_id STRING, check_name STRING, value DOUBLE, threshold DOUBLE,
  comparator STRING, result STRING, detail STRING, checked_at TIMESTAMP
);

-- Stage 5: the weekly triage writes items; people record decisions.
CREATE TABLE IF NOT EXISTS worklist_items (
  run_id STRING, office_code STRING, award_key STRING, kind STRING, reason STRING,
  explanation STRING, evidence STRING, data_date DATE, verified BOOLEAN, created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS worklist_decisions (
  award_key STRING, kind STRING, action STRING, note STRING,
  decided_by STRING, decided_at TIMESTAMP, current_end_at_decision DATE,
  obligations_at_decision DECIMAL(18, 2)
);
