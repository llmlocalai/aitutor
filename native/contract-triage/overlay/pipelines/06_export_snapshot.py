# Databricks notebook source
# MAGIC %md
# MAGIC # 06 Export the keyless snapshot
# MAGIC Blueprint 1.9. Writes Parquet copies of the gold views (and silver_awards, for the
# MAGIC award brief) for the pilot offices to the volume. Copy them to your laptop with
# MAGIC `databricks fs cp -r` and commit them under src/contract_triage/data/.

# COMMAND ----------

dbutils.widgets.text("catalog", "")
dbutils.widgets.text("offices", "", "Pilot office codes, comma separated")
CATALOG = dbutils.widgets.get("catalog").strip()
OFFICES = [o.strip() for o in dbutils.widgets.get("offices").split(",") if o.strip()]
assert CATALOG and OFFICES, "Set catalog and offices (docs/scope.md)."

import json
import os

spark.sql(f"USE CATALOG `{CATALOG}`")
spark.sql("USE SCHEMA contract_triage")
OUT = f"/Volumes/{CATALOG}/contract_triage/raw/snapshot"
os.makedirs(OUT, exist_ok=True)

total = 0
for t in [
    "gold_offices",
    "gold_contracts_ending",
    "gold_closeout_candidates",
    "gold_vendor_share",
    "silver_awards",
    "meta_freshness",
]:
    df = spark.table(t)
    if "awarding_office_code" in df.columns:
        df = df.where(df.awarding_office_code.isin(OFFICES))
    pdf = df.toPandas()
    pdf.to_parquet(f"{OUT}/{t}.parquet", index=False)
    total += os.path.getsize(f"{OUT}/{t}.parquet")
    print(f"{t:28s} {len(pdf):>8,} rows")
data_date = str(spark.sql("SELECT MAX(data_date) FROM meta_freshness").first()[0])
with open(f"{OUT}/data_date.json", "w") as f:
    json.dump({"data_date": data_date}, f)
print(f"{total / 1e6:.1f} MB in {OUT}; data_date {data_date}")
assert total < 50e6, "Snapshot over 50 MB: narrow the offices."
