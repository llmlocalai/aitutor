"""Key against tools, with no model in the loop (Blueprint 4.1 check, 2.7, 6.1).

  uv run python eval/local/run_tool_eval.py                 # golden_set.json, snapshot backend
  DATA_BACKEND=databricks ... uv run python eval/local/run_tool_eval.py   # same, live tables

For every golden row with a tool_check, calls the tool directly (all pages) and compares
the PIIDs it returns with the answer key's expected_ids, and checks that no decoy is
listed. A disagreement is a bug in the server SQL, in the key, or in the data; trace each
one to a cause before running any model. Exit code 1 on any disagreement.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))


async def all_items(c, tool: str, args: dict) -> list[dict]:
    items, offset = [], 0
    while True:
        out = (
            await c.call_tool(tool, {**args, "limit": 50, "offset": offset})
        ).structured_content
        if "error" in out:
            raise SystemExit(f"{tool} {args}: {out}")
        items += out["items"]
        if not out["has_more"]:
            return items
        offset = out["next_offset"]


async def main(path: Path) -> int:
    from fastmcp import Client

    from contract_triage.app import mcp

    rows = [
        r for r in json.loads(path.read_text()) if r["expectations"].get("tool_check")
    ]
    bad = 0
    async with Client(mcp) as c:
        for r in rows:
            e = r["expectations"]
            got = {
                i["piid"]
                for i in await all_items(
                    c, e["tool_check"]["tool"], e["tool_check"]["args"]
                )
            }
            if e.get("decoy_ids"):
                ok = not (set(e["decoy_ids"]) & got)
                why = f"decoys listed: {sorted(set(e['decoy_ids']) & got)}"
            else:
                want = set(e.get("expected_ids") or [])
                ok = got == want
                why = f"missing {sorted(want - got)[:5]} extra {sorted(got - want)[:5]}"
            bad += not ok
            print(
                f"{'PASS' if ok else 'FAIL'} {e['id']:12s} {e['category']:10s} "
                f"{len(got):>4} items" + ("" if ok else f"  {why}")
            )
    print(
        f"{len(rows) - bad}/{len(rows)} rows agree between the answer key and the tools"
    )
    return 1 if bad else 0


if __name__ == "__main__":
    p = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "eval" / "golden_set.json"
    raise SystemExit(asyncio.run(main(p)))
