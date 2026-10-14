"""Backend parity (Blueprint 2.1 check, 3.3 check): the snapshot and the live tables
return the same rows for one office.

  uv run python scripts/parity.py --office 47QFLA \
      --url "$APP_URL/mcp" --token "$(databricks auth token -p $PROFILE -o json | jq -r .access_token)"

Calls the three table list tools on the local snapshot (in-process) and on the deployed
app, and compares award keys. The snapshot must come from the same data date as the
tables, so re-export it (step 1.9) after every refresh.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

CASES = [
    ("contracts_list_ending_soon", {"days_ahead": 365}),
    ("contracts_list_closeout_candidates", {}),
]


async def keys(client, tool: str, args: dict) -> set[str]:
    out, offset = set(), 0
    while True:
        r = (
            await client.call_tool(tool, {**args, "limit": 50, "offset": offset})
        ).structured_content
        out |= {i["award_key"] for i in r.get("items", [])}
        if not r.get("has_more"):
            return out
        offset = r["next_offset"]


async def main(a) -> int:
    from fastmcp import Client
    from fastmcp.client.transports import StreamableHttpTransport

    from contract_triage.app import mcp

    remote = StreamableHttpTransport(
        a.url, headers={"Authorization": f"Bearer {a.token}"}
    )
    bad = 0
    async with Client(mcp) as local, Client(remote) as live:
        for tool, extra in CASES:
            args = {"office_code": a.office, **extra}
            snap, live_keys = (
                await keys(local, tool, args),
                await keys(live, tool, args),
            )
            ok = snap == live_keys
            bad += not ok
            print(
                f"{'SAME' if ok else 'DIFF'} {tool}: snapshot {len(snap)}, live {len(live_keys)}"
                + (
                    ""
                    if ok
                    else f"; only snapshot {len(snap - live_keys)}, only live {len(live_keys - snap)}"
                )
            )
    return 1 if bad else 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--office", required=True)
    ap.add_argument("--url", required=True)
    ap.add_argument("--token", required=True)
    raise SystemExit(asyncio.run(main(ap.parse_args())))
