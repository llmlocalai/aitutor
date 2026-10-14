# Databricks notebook source
# MAGIC %md
# MAGIC # 02 Bronze: SAM.gov closed contract records -> bronze_sam_awards
# MAGIC Blueprint 1.3. Pulls only records with closedStatus = Yes for one contracting
# MAGIC department (4700 = GSA) and a signed-date range. Closed records are all the closeout
# MAGIC logic needs, and asking for them alone keeps the pull small enough for a
# MAGIC 1,000-calls-a-day key. `mode=extract` asks for one asynchronous file;
# MAGIC `mode=page` pages the search 100 records at a time and stops at `max_calls`.

# COMMAND ----------

dbutils.widgets.text("catalog", "")
dbutils.widgets.text("department_code", "4700")
dbutils.widgets.text("signed_from", "10/01/2021")
dbutils.widgets.text("signed_to", "09/30/2026")
dbutils.widgets.dropdown("mode", "page", ["page", "extract"])
dbutils.widgets.text("max_calls", "300")
dbutils.widgets.text("secret_scope", "contract-triage")
CATALOG = dbutils.widgets.get("catalog").strip()
assert CATALOG, "Set the catalog widget."

import io
import json
import os
import re
import time
import zipfile

import common
import requests

KEY = dbutils.secrets.get(dbutils.widgets.get("secret_scope"), "sam_api_key")
URL = "https://api.sam.gov/contract-awards/v1/search"
BASE = {
    "contractingDepartmentCode": dbutils.widgets.get("department_code"),
    "closedStatus": "Yes",
    "dateSigned": f"[{dbutils.widgets.get('signed_from')},{dbutils.widgets.get('signed_to')}]",
    "includeSections": "contractId,coreData,awardDetails",
}
RAW = f"/Volumes/{CATALOG}/contract_triage/raw/sam"
os.makedirs(RAW, exist_ok=True)
spark.sql(f"USE CATALOG `{CATALOG}`")
spark.sql("USE SCHEMA contract_triage")
calls = 0


def get(params: dict) -> requests.Response:
    global calls
    calls += 1
    r = requests.get(URL, params={**params, "api_key": KEY}, timeout=120)
    # Never print the URL: it carries the key.
    print(f"call {calls}: HTTP {r.status_code}")
    return r


# COMMAND ----------

records: list[dict] = []
if dbutils.widgets.get("mode") == "page":
    max_calls = int(dbutils.widgets.get("max_calls"))
    page = 0
    while calls < max_calls:
        r = get({**BASE, "limit": 100, "offset": page})  # offset is a page index
        r.raise_for_status()
        body = r.json()
        batch = common.sam_records(body)
        records += batch
        total = int(body.get("totalRecords") or 0)
        if not batch or len(records) >= total:
            break
        page += 1
        time.sleep(0.5)
    print(f"{len(records):,} of {total:,} closed records in {calls} calls")
else:
    r = get({**BASE, "format": "json"})
    r.raise_for_status()
    # The response carries a download link with REPLACE_WITH_API_KEY in it.
    link = re.search(r"https://[^\s\"']+", r.text)
    assert link, f"no download link in the extract response: {r.text[:300]}"
    url = link.group(0).replace("REPLACE_WITH_API_KEY", KEY)
    for attempt in range(40):  # up to about 20 minutes
        d = requests.get(url, timeout=300)
        if d.status_code == 200 and d.content[:1] in (b"{", b"[", b"P"):
            break
        time.sleep(30)
    path = f"{RAW}/extract_{time.strftime('%Y%m%d')}"
    if d.content[:2] == b"PK":  # zipped
        with zipfile.ZipFile(io.BytesIO(d.content)) as z:
            payload = json.loads(z.read(z.namelist()[0]))
    else:
        payload = json.loads(d.content)
    with open(path + ".json", "w") as f:
        json.dump(payload, f)
    records = common.sam_records(payload)
    print(f"{len(records):,} records from the extract, saved to {path}.json")

# COMMAND ----------

rows = [
    {**common.parse_sam_record(r), "_source": dbutils.widgets.get("mode")}
    for r in records
]
if rows:
    (
        spark.createDataFrame(rows)
        .selectExpr(
            "piid",
            "referenced_idv_piid",
            "modification_number",
            "contracting_office_code",
            "closed_status",
            "closed_date",
            "current_completion_date",
            "ultimate_completion_date",
            "date_signed",
            "_source",
            "current_timestamp() AS _loaded_at",
        )
        .write.mode("overwrite")
        .saveAsTable("bronze_sam_awards")
    )
n = spark.table("bronze_sam_awards").count()
print(
    f"bronze_sam_awards: {n:,} rows; distinct PIIDs:",
    spark.sql("SELECT COUNT(DISTINCT piid) FROM bronze_sam_awards").first()[0],
)
