"""Laptop pipeline: bronze -> silver -> gold -> data quality -> snapshot, in DuckDB.

Blueprint 1.2 to 1.9, laptop path. Runs the same sql/*.sql files and the same checks
(pipelines/common.py) as the Databricks job, so a result here predicts the job's result.

  uv run python scripts/local_pipeline.py --csv tests/fixtures/usas_tx.csv \
      --sam-json tests/fixtures/sam_closed.json --data-date 2026-10-06 --out /tmp/snap

  # real files downloaded by scripts/fetch_usaspending.py (zips or CSVs):
  uv run python scripts/local_pipeline.py --csv ~/data/usas --offices 47QFLA,47PB00
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import tempfile
import zipfile
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipelines"))
import common  # noqa: E402

EXPORT = [
    "gold_offices",
    "gold_contracts_ending",
    "gold_closeout_candidates",
    "gold_vendor_share",
    "silver_awards",
    "meta_freshness",
]


def csv_inputs(paths: list[str], tmp: Path) -> tuple[list[str], dt.date | None]:
    """Expand dirs, unzip archives, and read the vintage date from archive names."""
    files, vintages = [], []
    for p in map(Path, paths):
        items = sorted(p.iterdir()) if p.is_dir() else [p]
        for f in items:
            meta = common.parse_archive_name(f.name)
            if meta:
                vintages.append(meta["vintage"])
            if f.suffix == ".zip":
                with zipfile.ZipFile(f) as z:
                    for m in z.namelist():
                        if m.endswith(".csv"):
                            z.extract(m, tmp)
                            files.append(str(tmp / m))
            elif f.suffix == ".csv":
                files.append(str(f))
    return files, (max(vintages) if vintages else None)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--csv", nargs="+", required=True, help="CSV/zip files or folders")
    ap.add_argument("--sam-json", help="SAM.gov records (search page JSON or a list)")
    ap.add_argument(
        "--data-date", help="YYYY-MM-DD; default: archive vintage or last action"
    )
    ap.add_argument("--out", default=str(ROOT / "src" / "contract_triage" / "data"))
    ap.add_argument("--offices", default="", help="comma list to keep in the snapshot")
    ap.add_argument(
        "--db", default=":memory:", help="DuckDB file to keep the full tables"
    )
    a = ap.parse_args()

    con = duckdb.connect(a.db)
    with tempfile.TemporaryDirectory() as td:
        files, vintage = csv_inputs(a.csv, Path(td))
        if not files:
            print("no CSV files found", file=sys.stderr)
            return 2
        cols = ", ".join(common.BRONZE_COLUMNS)
        con.execute(
            f"CREATE OR REPLACE TABLE bronze_usas_contract_tx AS SELECT {cols}, "
            "filename AS _source_file, now() AS _loaded_at FROM read_csv($files, header=true, "
            "all_varchar=true, union_by_name=true, filename=true)",
            {"files": files},
        )
    n_tx = con.execute("SELECT COUNT(*) FROM bronze_usas_contract_tx").fetchone()[0]
    print(f"bronze_usas_contract_tx: {n_tx} rows from {len(files)} file(s)")

    con.execute(
        "CREATE OR REPLACE TABLE bronze_sam_awards (piid VARCHAR, referenced_idv_piid VARCHAR, "
        "modification_number VARCHAR, contracting_office_code VARCHAR, closed_status VARCHAR, "
        "closed_date VARCHAR, current_completion_date VARCHAR, ultimate_completion_date VARCHAR, "
        "date_signed VARCHAR, _source VARCHAR, _loaded_at TIMESTAMP)"
    )
    if a.sam_json:
        recs = common.sam_records(json.loads(Path(a.sam_json).read_text()))
        rows = [common.parse_sam_record(r) for r in recs]
        for r in rows:
            con.execute(
                "INSERT INTO bronze_sam_awards VALUES (?,?,?,?,?,?,?,?,?,?, now())",
                [
                    r["piid"],
                    r["referenced_idv_piid"],
                    r["modification_number"],
                    r["contracting_office_code"],
                    r["closed_status"],
                    r["closed_date"],
                    r["current_completion_date"],
                    r["ultimate_completion_date"],
                    r["date_signed"],
                    Path(a.sam_json).name,
                ],
            )
        print(f"bronze_sam_awards: {len(rows)} rows")

    if a.data_date:
        data_date = dt.date.fromisoformat(a.data_date)
    elif vintage:
        data_date = vintage
    else:
        data_date = con.execute(
            "SELECT MAX(TRY_CAST(SUBSTR(action_date,1,10) AS DATE)) FROM bronze_usas_contract_tx"
        ).fetchone()[0]
    con.execute(
        "CREATE OR REPLACE TABLE meta_freshness (data_date DATE, source VARCHAR, "
        "rows BIGINT, loaded_at TIMESTAMP)"
    )
    con.execute(
        "INSERT INTO meta_freshness VALUES (?, 'usaspending archive', ?, now())",
        [data_date, n_tx],
    )
    print(f"data_date: {data_date}")

    for f in common.SQL_ORDER:
        for stmt in common.sql_file(f):
            con.execute(stmt)
    for t in ["silver_contract_tx", "silver_awards", *common.GOLD]:
        print(f"{t}: {con.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]} rows")

    results = common.run_checks(lambda q: con.execute(q).fetchone()[0])
    for r in results:
        v = "n/a" if r["value"] is None else f"{r['value']:.4f}".rstrip("0").rstrip(".")
        print(
            f"dq {r['check_name']}: {v} {r['comparator']} {r['threshold']:g} -> {r['result']}"
        )

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    offices = [o.strip() for o in a.offices.split(",") if o.strip()]
    for t in EXPORT:
        where = ""
        if offices and t != "meta_freshness":
            where = " WHERE awarding_office_code IN (SELECT UNNEST($o))"
        target = str(out / f"{t}.parquet").replace("'", "''")
        con.execute(
            f"COPY (SELECT * FROM {t}{where}) TO '{target}' (FORMAT parquet)",
            {"o": offices} if where else None,
        )
    (out / "data_date.json").write_text(
        json.dumps({"data_date": str(data_date)}) + "\n"
    )
    size = sum(p.stat().st_size for p in out.glob("*.parquet"))
    print(f"snapshot: {len(EXPORT)} parquet files, {size / 1e6:.2f} MB in {out}")
    failed = [r for r in results if r["result"] == "fail"]
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
