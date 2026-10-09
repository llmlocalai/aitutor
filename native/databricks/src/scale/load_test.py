"""Step 21. Find the knee: the concurrency at which latency or errors stop being acceptable.

Run against STAGING with dry_run requests. Steps concurrency up (1, 2, 4, 8, 16, 32) and prints
p50/p95 latency, error rate and throughput per step. The first step whose p95 exceeds the contract or
whose error rate exceeds 1% is the knee; production concurrency stays below it, and the scaling levers
in the page raise it.

  python load_test.py --agent-url https://<staging-agent> --ids ids.txt --levels 1,2,4,8,16
"""
from __future__ import annotations

import argparse
import asyncio
import time


def percentile(values: list, p: float) -> float:
    if not values:
        return 0.0
    v = sorted(values)
    k = (len(v) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(v) - 1)
    return round(v[lo] + (v[hi] - v[lo]) * (k - lo), 3)


def step_stats(latencies: list, errors: int, wall_s: float) -> dict:
    n = len(latencies) + errors
    return {"requests": n, "p50_s": percentile(latencies, 0.5), "p95_s": percentile(latencies, 0.95),
            "error_rate": round(errors / n, 4) if n else 0.0, "rps": round(n / wall_s, 3) if wall_s else 0.0}


def knee(steps: list, p95_max: float, error_max: float = 0.01):
    """First concurrency level that breaks the contract, or None if none did."""
    for s in steps:
        if s["p95_s"] > p95_max or s["error_rate"] > error_max:
            return s["concurrency"]
    return None


async def _level(url: str, headers: dict, ids: list, c: int) -> dict:  # pragma: no cover
    import aiohttp
    sem, lat, err = asyncio.Semaphore(c), [], 0

    async def one(session, eid):
        nonlocal err
        async with sem:
            t0 = time.perf_counter()
            try:
                async with session.post(f"{url.rstrip('/')}/responses", headers=headers, timeout=180,
                                        json={"input": [{"role": "user", "content": f"Triage exception {eid}."}],
                                              "custom_inputs": {"dry_run": True}}) as r:
                    await r.read()
                    if r.status == 200:
                        lat.append(time.perf_counter() - t0)
                    else:
                        err += 1
            except Exception:                                  # noqa: BLE001
                err += 1

    t0 = time.perf_counter()
    async with aiohttp.ClientSession() as s:
        await asyncio.gather(*[one(s, e) for e in ids[: c * 4]])     # four requests per worker per level
    return {"concurrency": c, **step_stats(lat, err, time.perf_counter() - t0)}


def main() -> None:  # pragma: no cover
    from databricks.sdk import WorkspaceClient

    ap = argparse.ArgumentParser()
    ap.add_argument("--agent-url", required=True)
    ap.add_argument("--ids", required=True)
    ap.add_argument("--levels", default="1,2,4,8,16")
    ap.add_argument("--p95-max", type=float, default=30.0)
    a = ap.parse_args()
    ids = [l.strip() for l in open(a.ids) if l.strip()]
    headers = WorkspaceClient().config.authenticate()
    steps = []
    for c in [int(x) for x in a.levels.split(",")]:
        steps.append(asyncio.run(_level(a.agent_url, headers, ids, c)))
        print(steps[-1])
    print("knee at concurrency:", knee(steps, a.p95_max))


if __name__ == "__main__":  # pragma: no cover
    main()
