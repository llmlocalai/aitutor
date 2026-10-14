"""Fill src/contract_triage/data/sources.json from the Data.gov Catalog API v4 (Blueprint 1.10).

  set -a; source .env; set +a
  uv run python scripts/datagov_sources.py            # print what it would write
  uv run python scripts/datagov_sources.py --write    # update the file

For each source with a datagov_query, runs GET /search?q=<query>&per_page=5 with your
api.data.gov key in the X-Api-Key header and keeps the best title match. Stdlib only.
"""

from __future__ import annotations

import difflib
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

FILE = (
    Path(__file__).resolve().parent.parent
    / "src"
    / "contract_triage"
    / "data"
    / "sources.json"
)
BASE = "https://api.gsa.gov/technology/datagov/v4/search"


def search(q: str, key: str) -> list[dict]:
    url = f"{BASE}?{urllib.parse.urlencode({'q': q, 'per_page': 5})}"
    req = urllib.request.Request(
        url, headers={"X-Api-Key": key, "User-Agent": "contract-triage"}
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        left = r.headers.get("X-RateLimit-Remaining")
        body = json.load(r)
    print(f"  {r.status} for q={q!r}; rate limit remaining {left}")
    return body.get("results") or body.get("data") or []


def main() -> int:
    key = os.environ.get("DATAGOV_API_KEY", "")
    if not key:
        print(
            "DATAGOV_API_KEY is not set. Run: set -a; source .env; set +a",
            file=sys.stderr,
        )
        return 2
    doc = json.loads(FILE.read_text())
    for s in doc["sources"]:
        if not s.get("datagov_query"):
            continue
        hits = search(s["datagov_query"], key)
        if not hits:
            print(
                f"  no Data.gov record for {s['id']}; keep the link and say so in the README"
            )
            continue
        best = max(
            hits,
            key=lambda h: difflib.SequenceMatcher(
                None, s["title"].lower(), str(h.get("title", "")).lower()
            ).ratio(),
        )
        s["datagov_identifier"] = best.get("identifier") or best.get("slug") or ""
        s["datagov_title"] = best.get("title", "")
        s["last_harvested_date"] = str(best.get("last_harvested_date", ""))[:10]
        print(f"  {s['id']} -> {s['datagov_title']!r} ({s['datagov_identifier']})")
    if "--write" in sys.argv:
        FILE.write_text(json.dumps(doc, indent=2) + "\n")
        print(f"wrote {FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
