"""Prove the three public APIs answer from this machine (Blueprint 0.5, gate G0 "Keys work").

  set -a; source .env; set +a
  python3 scripts/probe_apis.py

Prints one line per API: HTTP status, the rate-limit headers, and one fact from the body.
Exit code 0 only if all three return 200. Stdlib only, so it runs before `uv sync`.
The keys are sent but never printed.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

PIID = os.environ.get("PROBE_PIID", "47QFLA20C0002")


def get(url: str, headers: dict[str, str] | None = None, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    h = {"User-Agent": "contract-triage-probe", **(headers or {})}
    if data:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, dict(r.headers), json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), {}
    except (urllib.error.URLError, TimeoutError) as e:
        return 0, {}, {"reason": str(getattr(e, "reason", e))}


def limits(h: dict[str, str]) -> str:
    keep = {
        k: v
        for k, v in h.items()
        if "ratelimit" in k.lower() or "x-ratelimit" in k.lower()
    }
    return (
        ", ".join(f"{k}={v}" for k, v in sorted(keep.items()))
        or "no rate-limit headers"
    )


def main() -> int:
    ok = True
    sam_key = os.environ.get("SAM_API_KEY", "")
    dg_key = os.environ.get("DATAGOV_API_KEY", "")

    s, h, b = get("https://api.usaspending.gov/api/v2/references/toptier_agencies/")
    gsa = next((a for a in b.get("results", []) if a.get("toptier_code") == "047"), {})
    print(f"USAspending  {s}  {limits(h)}  GSA agency_id={gsa.get('agency_id')}")
    ok &= s == 200

    if not sam_key:
        print("SAM.gov      SKIP  SAM_API_KEY is not set (.env)")
        ok = False
    else:
        q = urllib.parse.urlencode({"api_key": sam_key, "piid": PIID, "limit": 1})
        s, h, b = get(f"https://api.sam.gov/contract-awards/v1/search?{q}")
        print(
            f"SAM.gov      {s}  {limits(h)}  totalRecords={b.get('totalRecords')} for piid {PIID}"
        )
        ok &= s == 200

    if not dg_key:
        print("Data.gov v4  SKIP  DATAGOV_API_KEY is not set (.env)")
        ok = False
    else:
        s, h, b = get(
            "https://api.gsa.gov/technology/datagov/v4/search?q=USAspending&per_page=1",
            {"X-Api-Key": dg_key},
        )
        first = (b.get("results") or [{}])[0].get("title")
        print(f"Data.gov v4  {s}  {limits(h)}  first result: {first!r}")
        ok &= s == 200

    print("ALL OK" if ok else "NOT OK: fix the lines above before gate G0")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
