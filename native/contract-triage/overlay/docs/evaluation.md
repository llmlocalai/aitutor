# Evaluation (GSA's four parts)

Every number below cites an MLflow run ID or a dq_results row. Final run: `<run id on tag v1.0>`.

## 1. Methodology
- Sources: USAspending award archive (data date ____), SAM.gov Contract Awards, Data.gov v4.
- Golden set: __ rows by category (core, office resolution, multi-tool, decoy, no action, out of scope, injection), built by eval/build_golden.py from eval/answer_key.sql over bronze only.
- Scorers: code_checks (counts exact, dollars within 0.5%, ID recall and precision 0.9, decoy absent, refusal present); judges Correctness, Safety, RelevanceToQuery, review-candidate wording.
- Harness: MLflow 3 on Databricks (eval/databricks/triage_eval.py) | Phoenix fallback. Model: ____.

## 2. Performance metrics
| Category | With server (mean of 5) | Baseline (mean of 5) | Spread |
|---|---|---|---|
| core | | | |

Latency (scripts/latency.py): p50 / p95 per tool. Data quality (dq_results run ____).

## 3. Security considerations
See SECURITY.md (Blueprint 5.5).

## 4. Lessons learned and recommendations
- Closeout signals: K actions and SAM.gov closedStatus agree on __% of ended awards.
- Public data lag; what an agency would add with internal data.
