# Databricks notebook source
# MAGIC %md
# MAGIC # 00 Setup: schema, volume, tables, and the egress test
# MAGIC Blueprint 0.8. Run once by hand on serverless compute, then as the first job task.
# MAGIC It answers the two unknowns stage 1 depends on: can you create objects in the
# MAGIC catalog, and can workspace compute reach the public federal sites.

# COMMAND ----------

dbutils.widgets.text("catalog", "", "Unity Catalog catalog")
CATALOG = dbutils.widgets.get("catalog").strip()
assert CATALOG, (
    "Set the catalog widget (the catalog GSA or Databricks told you to use)."
)

import common  # pipelines/common.py, next to this notebook in the Git folder

spark.sql(f"USE CATALOG `{CATALOG}`")
for stmt in common.sql_file("ddl.sql"):
    spark.sql(stmt)
print(
    "objects:",
    [r.tableName for r in spark.sql("SHOW TABLES IN contract_triage").collect()],
)
print("volume:", spark.sql("SHOW VOLUMES IN contract_triage").collect())

# COMMAND ----------

# Egress test. A 200 means jobs can download directly; anything else means use the
# laptop path (scripts/fetch_usaspending.py, then `databricks fs cp` to the volume).
import requests

checks = {
    "api.usaspending.gov": (
        "GET",
        "https://api.usaspending.gov/api/v2/references/toptier_agencies/",
    ),
    "files.usaspending.gov": (
        "HEAD",
        "https://files.usaspending.gov/award_data_archive/",
    ),
    "api.sam.gov": ("GET", "https://api.sam.gov/contract-awards/v1/search?limit=1"),
    "api.gsa.gov (Data.gov v4)": (
        "GET",
        "https://api.gsa.gov/technology/datagov/v4/search?q=usaspending&per_page=1",
    ),
}
for name, (method, url) in checks.items():
    try:
        r = requests.request(method, url, timeout=30, headers={"X-Api-Key": "DEMO_KEY"})
        # SAM.gov without a key answers 401/403: that still proves the network path works.
        print(f"{name:28s} reachable, HTTP {r.status_code}")
    except Exception as e:  # noqa: BLE001
        print(f"{name:28s} NOT reachable: {type(e).__name__}")
