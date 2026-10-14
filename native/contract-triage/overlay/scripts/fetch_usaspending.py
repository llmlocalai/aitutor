"""Download the newest USAspending Full contract archive per fiscal year (Blueprint 1.2, laptop path).

  python3 scripts/fetch_usaspending.py --agency 047 --fy 2022-2026 --out ~/data/usas
  python3 scripts/fetch_usaspending.py --agency 047 --fy 2026 --list     # list only

Uses the same two API calls as the Databricks notebook: bulk_download/list_agencies to
turn the agency code (047 = GSA) into its toptier_agency_id, then
bulk_download/list_monthly_files per fiscal year. Keeps only *_Contracts_Full_* files,
the newest vintage for each year. Skips a file already on disk with the same size.
Stdlib only.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipelines"))
import common  # noqa: E402

API = "https://api.usaspending.gov/api/v2"


def post(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{API}/{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "contract-triage"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def toptier_id(agency: str) -> int:
    body = post("bulk_download/list_agencies/", {"type": "award_agencies", "agency": 0})
    for group in ("cfo_agencies", "other_agencies"):
        for row in (body.get("agencies") or {}).get(group) or []:
            if str(row.get("toptier_code")) == agency:
                return int(row["toptier_agency_id"])
    raise SystemExit(f"agency {agency} not found in list_agencies")


def monthly_files(agency_id: int, fy: int) -> list[dict]:
    body = post(
        "bulk_download/list_monthly_files/",
        {"agency": agency_id, "fiscal_year": fy, "type": "contracts"},
    )
    return body.get("monthly_files") or []


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--agency", default="047")
    ap.add_argument("--fy", default="2022-2026", help="2026 or 2022-2026")
    ap.add_argument("--out", default=str(Path.home() / "data" / "usas"))
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    lo, _, hi = a.fy.partition("-")
    fy_from, fy_to = int(lo), int(hi or lo)

    aid = toptier_id(a.agency)
    print(f"agency {a.agency} -> toptier_agency_id {aid}")
    rows = []
    for fy in range(fy_from, fy_to + 1):
        rows += monthly_files(aid, fy)
    by_name = {r["file_name"]: r for r in rows if r.get("file_name")}
    keep = common.latest_full_per_fy(list(by_name), a.agency, fy_from, fy_to)
    out = Path(a.out).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    for name in keep:
        url = by_name[name]["url"]
        dest = out / name
        print(f"{name}  {url}")
        if a.list:
            continue
        with urllib.request.urlopen(
            urllib.request.Request(url, method="HEAD"), timeout=60
        ) as r:
            size = int(r.headers.get("Content-Length") or 0)
        if dest.exists() and dest.stat().st_size == size:
            print(f"  already here ({size / 1e6:.1f} MB)")
            continue
        tmp = dest.with_suffix(".part")
        with urllib.request.urlopen(url, timeout=600) as r, open(tmp, "wb") as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
        tmp.rename(dest)
        print(f"  saved {dest.stat().st_size / 1e6:.1f} MB")
    print(f"{len(keep)} file(s) for FY{fy_from}-FY{fy_to} in {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
