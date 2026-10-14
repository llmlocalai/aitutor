"""p50 and p95 per tool on the deployed app, 20 calls each (Blueprint 5.8).

  uv run python scripts/latency.py --url "$APP_URL/mcp" --token "$TOKEN" --office 47QFLA

Goal: p95 under 2 seconds for the four table tools. Run it once with a cold warehouse
and once warm, and write both in docs/evaluation.md.
"""

from __future__ import annotations

import argparse
import asyncio
import statistics
import time


async def main(a) -> int:
    from fastmcp import Client
    from fastmcp.client.transports import StreamableHttpTransport

    t = StreamableHttpTransport(a.url, headers={"Authorization": f"Bearer {a.token}"})
    calls = [
        ("contracts_find_office", {"query": a.office}),
        ("contracts_list_ending_soon", {"office_code": a.office}),
        ("contracts_list_closeout_candidates", {"office_code": a.office}),
        ("contracts_assess_vendor_dependence", {"office_code": a.office}),
    ]
    slow = 0
    async with Client(t) as c:
        for name, args in calls:
            ms = []
            for _ in range(a.n):
                t0 = time.perf_counter()
                await c.call_tool(name, args)
                ms.append((time.perf_counter() - t0) * 1000)
            q = statistics.quantiles(ms, n=20)
            p50, p95 = statistics.median(ms), q[18]
            slow += p95 > 2000
            print(f"{name:38s} p50 {p50:7.0f} ms   p95 {p95:7.0f} ms")
    return 1 if slow else 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--token", required=True)
    ap.add_argument("--office", required=True)
    ap.add_argument("-n", type=int, default=20)
    raise SystemExit(asyncio.run(main(ap.parse_args())))
