# Databricks notebook source
# MAGIC %md
# MAGIC # 05 Data quality
# MAGIC Blueprint 1.6. Runs the checks in common.DQ_CHECKS (the same ones the laptop pipeline
# MAGIC prints), plus one check that needs the network: total FY2025 obligations against the
# MAGIC USAspending API. Writes one row per check to dq_results and fails the task if any
# MAGIC check fails, so a bad load stops the job before the app reads it.

# COMMAND ----------

dbutils.widgets.text("catalog", "")
dbutils.widgets.text("agency", "047")
dbutils.widgets.text("api_fiscal_year", "2025")
CATALOG = dbutils.widgets.get("catalog").strip()
assert CATALOG, "Set the catalog widget."

import uuid

import common
import requests

spark.sql(f"USE CATALOG `{CATALOG}`")
spark.sql("USE SCHEMA contract_triage")
run_id = str(uuid.uuid4())[:8]
results = common.run_checks(lambda q: spark.sql(q).first()[0])

# COMMAND ----------

fy = int(dbutils.widgets.get("api_fiscal_year"))
ours = spark.sql(
    f"SELECT SUM(obligation) FROM silver_contract_tx WHERE fiscal_year = {fy}"
).first()[0]
try:
    r = requests.get(
        f"https://api.usaspending.gov/api/v2/agency/{dbutils.widgets.get('agency')}"
        f"/obligations_by_award_category/?fiscal_year={fy}",
        timeout=60,
    )
    cats = {
        c.get("category"): c.get("aggregated_amount")
        for c in r.json().get("results", [])
    }
    api = cats.get("contracts")
    diff = (
        abs(float(ours) - float(api)) / abs(float(api))
        if ours is not None and api
        else None
    )
except Exception as e:  # noqa: BLE001
    api, diff = None, None
    print("API check skipped:", type(e).__name__)
results.append(
    {
        "check_name": f"fy{fy}_obligations_vs_api",
        "value": diff,
        "threshold": 0.01,
        "comparator": "<=",
        "result": common.evaluate(diff, 0.01, "<="),
        "detail": f"ours {ours} vs API contracts {api} (relative difference)",
    }
)

# COMMAND ----------

from pyspark.sql import functions as F

df = spark.createDataFrame(results).select(
    F.lit(run_id).alias("run_id"),
    "check_name",
    F.col("value").cast("double"),
    F.col("threshold").cast("double"),
    "comparator",
    "result",
    "detail",
    F.current_timestamp().alias("checked_at"),
)
df.write.mode("append").saveAsTable("dq_results")
display(df)
failed = [r["check_name"] for r in results if r["result"] == "fail"]
assert not failed, f"data quality failed: {failed}"
