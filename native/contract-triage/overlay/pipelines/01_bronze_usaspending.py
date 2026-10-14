# Databricks notebook source
# MAGIC %md
# MAGIC # 01 Bronze: USAspending contract archive -> bronze_usas_contract_tx
# MAGIC Blueprint 1.2. Downloads the newest *Full* contract archive per fiscal year for one
# MAGIC agency into the volume, unzips it, and loads every row (all values as text).
# MAGIC `mode=volume` skips the download and loads files you copied up from a laptop.

# COMMAND ----------

dbutils.widgets.text("catalog", "")
dbutils.widgets.text("agency", "047")
dbutils.widgets.text("fy_from", "2022")
dbutils.widgets.text("fy_to", "2026")
dbutils.widgets.dropdown("mode", "download", ["download", "volume"])
dbutils.widgets.dropdown("verify_counts", "no", ["no", "yes"])
CATALOG = dbutils.widgets.get("catalog").strip()
AGENCY = dbutils.widgets.get("agency").strip()
FY_FROM, FY_TO = int(dbutils.widgets.get("fy_from")), int(dbutils.widgets.get("fy_to"))
MODE = dbutils.widgets.get("mode")
assert CATALOG, "Set the catalog widget."

import csv
import os
import zipfile

import common
import requests
from pyspark.sql import functions as F

RAW = f"/Volumes/{CATALOG}/contract_triage/raw/usas"
os.makedirs(f"{RAW}/csv", exist_ok=True)
spark.sql(f"USE CATALOG `{CATALOG}`")
spark.sql("USE SCHEMA contract_triage")
API = "https://api.usaspending.gov/api/v2"

# COMMAND ----------


def download_archives() -> list[str]:
    """Same two calls as scripts/fetch_usaspending.py."""
    body = requests.post(
        f"{API}/bulk_download/list_agencies/",
        json={"type": "award_agencies", "agency": 0},
        timeout=120,
    ).json()
    aid = next(
        int(r["toptier_agency_id"])
        for g in ("cfo_agencies", "other_agencies")
        for r in (body.get("agencies") or {}).get(g) or []
        if str(r.get("toptier_code")) == AGENCY
    )
    files = {}
    for fy in range(FY_FROM, FY_TO + 1):
        r = requests.post(
            f"{API}/bulk_download/list_monthly_files/",
            json={"agency": aid, "fiscal_year": fy, "type": "contracts"},
            timeout=120,
        )
        r.raise_for_status()
        files.update(
            {m["file_name"]: m["url"] for m in r.json().get("monthly_files") or []}
        )
    keep = common.latest_full_per_fy(list(files), AGENCY, FY_FROM, FY_TO)
    for name in keep:
        dest = f"{RAW}/{name}"
        size = int(
            requests.head(files[name], timeout=60).headers.get("Content-Length") or 0
        )
        if os.path.exists(dest) and os.path.getsize(dest) == size:
            print(f"have {name}")
            continue
        with (
            requests.get(files[name], stream=True, timeout=600) as r,
            open(dest + ".part", "wb") as f,
        ):
            r.raise_for_status()
            for chunk in r.iter_content(1 << 22):
                f.write(chunk)
        os.replace(dest + ".part", dest)
        print(f"saved {name} ({os.path.getsize(dest) / 1e6:.0f} MB)")
    return keep


zips = (
    download_archives()
    if MODE == "download"
    else common.latest_full_per_fy(
        [n for n in os.listdir(RAW) if n.endswith(".zip")], AGENCY, FY_FROM, FY_TO
    )
)
print("archives:", zips)

# COMMAND ----------

# Unzip each archive into its own folder. A year can be split into _1.csv, _2.csv, ...
csv_paths = []
for name in zips:
    folder = f"{RAW}/csv/{name[:-4]}"
    os.makedirs(folder, exist_ok=True)
    with zipfile.ZipFile(f"{RAW}/{name}") as z:
        for m in z.namelist():
            target = f"{folder}/{os.path.basename(m)}"
            if not os.path.exists(target):
                with z.open(m) as src, open(target, "wb") as dst:
                    while chunk := src.read(1 << 22):
                        dst.write(chunk)
            csv_paths.append(target)
if MODE == "volume":  # loose CSVs copied up from a laptop
    csv_paths += [f"{RAW}/{n}" for n in os.listdir(RAW) if n.endswith(".csv")]
assert csv_paths, f"No CSV files found under {RAW}"
print(len(csv_paths), "CSV files")

# COMMAND ----------

# multiLine: descriptions can contain line breaks inside quotes. All columns stay text.
df = (
    spark.read.option("header", True)
    .option("multiLine", True)
    .option("quote", '"')
    .option("escape", '"')
    .csv(csv_paths)
)
missing = [c for c in common.BRONZE_COLUMNS if c not in df.columns]
assert not missing, f"columns missing from the archive: {missing}"
bronze = df.select(
    *common.BRONZE_COLUMNS,
    F.col("_metadata.file_path").alias("_source_file"),
    F.current_timestamp().alias("_loaded_at"),
)
bronze.write.mode("overwrite").option("overwriteSchema", True).saveAsTable(
    "bronze_usas_contract_tx"
)

counts = {
    r["_source_file"]: r["count"]
    for r in spark.table("bronze_usas_contract_tx")
    .groupBy("_source_file")
    .count()
    .collect()
}
for k, v in sorted(counts.items()):
    print(f"{v:>10,}  {k.split('/')[-1]}")

# COMMAND ----------

# Data date = newest archive vintage. Recorded so every tool can say how fresh it is.
vintage = max(common.parse_archive_name(n)["vintage"] for n in zips)
spark.sql("DELETE FROM meta_freshness WHERE source = 'usaspending archive'")
spark.sql(
    f"INSERT INTO meta_freshness VALUES (DATE'{vintage}', 'usaspending archive', "
    f"{sum(counts.values())}, current_timestamp())"
)
print("data_date", vintage, "rows", sum(counts.values()))

# COMMAND ----------

# Check (Blueprint 1.2): rows per file equal the CSV record count. Counted with Python's
# csv module, not `wc -l`, because quoted descriptions can hold line breaks.
if dbutils.widgets.get("verify_counts") == "yes":
    bad = 0
    for p in csv_paths:
        with open(p, newline="", encoding="utf-8") as f:
            n = sum(1 for _ in csv.reader(f)) - 1
        got = next((v for k, v in counts.items() if k.endswith(os.path.basename(p))), 0)
        bad += n != got
        print(
            f"{'OK ' if n == got else 'BAD'} {os.path.basename(p)} csv={n:,} table={got:,}"
        )
    assert bad == 0, f"{bad} file(s) did not load completely"
