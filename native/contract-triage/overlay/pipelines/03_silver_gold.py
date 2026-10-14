# Databricks notebook source
# MAGIC %md
# MAGIC # 03 Silver and gold
# MAGIC Blueprint 1.4 and 1.5. Runs the same sql/*.sql files the laptop pipeline runs in
# MAGIC DuckDB, in the same order. Every statement is CREATE OR REPLACE, so a rerun gives
# MAGIC the same tables (the idempotence check in 1.7).

# COMMAND ----------

dbutils.widgets.text("catalog", "")
CATALOG = dbutils.widgets.get("catalog").strip()
assert CATALOG, "Set the catalog widget."

import common

spark.sql(f"USE CATALOG `{CATALOG}`")
spark.sql("USE SCHEMA contract_triage")
for name in common.SQL_ORDER:
    for stmt in common.sql_file(name):
        spark.sql(stmt)
    print("ran", name)

for t in ["silver_contract_tx", "silver_awards", *common.GOLD]:
    print(f"{t:28s} {spark.table(t).count():>10,} rows")

# COMMAND ----------

# Check (Blueprint 1.4): the award the API showed on Oct. 11, 2026.
display(
    spark.sql("""
  SELECT piid, current_end, obligations, option_exercises, k_closeouts, sam_closed
  FROM silver_awards WHERE piid = '47QFLA20C0002'""")
)
