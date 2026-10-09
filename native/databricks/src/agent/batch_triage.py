"""Step 19. The scheduled path: send every new exception to the DEPLOYED agent, with bounded concurrency.

One code path for interactive and batch use: the job calls the same agent endpoint reviewers' tools
call, so what was evaluated is what runs. The job never imports the agent in-process.

  python batch_triage.py --catalog fin_prd --agent-url https://<agent-url> --agent-principal <agent-client-id> --concurrency 8

select_new(), changed_after_decision() and backoff() are pure and tested.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def select_new(open_rows: list, live: dict, limit: int, units: set | None = None) -> list:
    """Which exceptions to send to the agent, oldest first (input order), at most `limit`.

    open_rows  (exception_id, invoice_amount, business_unit) from gold.open_exceptions, oldest first
    live       {exception_id: (invoice_amount, status)} for every proposal not superseded
    units      business units the agent's principal can read; None means no filter

    Sent: no live proposal, or a PENDING proposal whose amount no longer matches the invoice (the invoice
    was corrected, so the proposal was made on old facts; the agent supersedes it).
    Not sent: a decided proposal (approved, rejected). Re-proposing an approved payment invites a second
    approval; a changed amount after a decision is an incident for a person, listed by changed_after_decision().
    Not sent: units the agent cannot read. Its get_exception call would return found=false and escalate,
    every run, for ever. Step 20 query 6 alerts on those units instead.
    The limit is a cost and blast-radius control: a bad deploy can only spend one batch."""
    out = []
    for eid, amount, unit in open_rows:
        if units is not None and unit not in units:
            continue
        if eid in live:
            amt, status = live[eid]
            if status not in ("pending", "needs_second") or round(float(amt), 2) == round(float(amount), 2):
                continue
        out.append(eid)
    return out[:limit]


def changed_after_decision(open_rows: list, live: dict) -> list:
    """Decided exceptions whose invoice amount changed afterwards. A person must look; the job prints them."""
    return [eid for eid, amount, _ in open_rows
            if eid in live and live[eid][1] not in ("pending", "needs_second")
            and round(float(live[eid][0]), 2) != round(float(amount), 2)]


def backoff(attempt: int, base: float = 1.0, cap: float = 30.0, jitter: float = 0.25) -> float:
    """Exponential backoff with jitter for 429 and 5xx. Jitter stops eight workers retrying in lockstep."""
    d = min(cap, base * (2 ** attempt))
    return round(d * (1 - jitter + 2 * jitter * random.random()), 3)


def summarize(results: list) -> dict:
    out = {"total": len(results)}
    for r in results:
        out[r.get("status", "error")] = out.get(r.get("status", "error"), 0) + 1
    return out


async def _one(session, url: str, headers: dict, exception_id: str, sem: asyncio.Semaphore) -> dict:  # pragma: no cover
    import aiohttp
    async with sem:
        for attempt in range(5):
            try:
                async with session.post(f"{url.rstrip('/')}/responses", headers=headers,
                                        timeout=aiohttp.ClientTimeout(total=180),
                                        json={"input": [{"role": "user", "content": f"Triage exception {exception_id}."}]}) as r:
                    if r.status in (429, 500, 502, 503, 504):
                        await asyncio.sleep(backoff(attempt))
                        continue
                    if r.status != 200:
                        return {"exception_id": exception_id, "status": "error", "http": r.status}
                    body = await r.json()
                    return {"exception_id": exception_id, **((body.get("custom_outputs") or {}) or {"status": "queued"})}
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:      # one bad call must not end the batch
                if attempt == 4:
                    return {"exception_id": exception_id, "status": "error", "http": type(e).__name__}
                await asyncio.sleep(backoff(attempt))
        return {"exception_id": exception_id, "status": "error", "http": "retries exhausted"}


async def run(catalog: str, agent_url: str, concurrency: int, limit: int, agent_principal: str | None) -> dict:  # pragma: no cover
    import aiohttp
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.service.sql import StatementParameterListItem

    from common.pg import pool

    w = WorkspaceClient()
    wh = os.environ["DATABRICKS_WAREHOUSE_ID"]
    res = w.statement_execution.execute_statement(
        statement=f"SELECT exception_id, invoice_amount, business_unit FROM {catalog}.gold.open_exceptions ORDER BY detected_at",
        warehouse_id=wh, wait_timeout="50s")
    open_rows = [tuple(r) for r in (res.result.data_array or [])] if res.result else []
    units = None
    if agent_principal:                                   # the units the AGENT can read, not the job
        s = w.statement_execution.execute_statement(
            statement=f"SELECT business_unit FROM {catalog}.gold.reviewer_scope WHERE reviewer = :p",
            parameters=[StatementParameterListItem(name="p", value=agent_principal)], warehouse_id=wh, wait_timeout="50s")
        units = {r[0] for r in (s.result.data_array or [])} if s.result else set()
    with pool().connection() as conn:
        live = {r[0]: (r[1], r[2]) for r in conn.execute(
            "SELECT exception_id, invoice_amount, status FROM proposals WHERE status <> 'superseded'")}
    todo = select_new(open_rows, live, limit, units)
    for eid in changed_after_decision(open_rows, live):
        print("CHANGED AFTER DECISION, needs a person:", eid)
    headers = w.config.authenticate()                     # job service principal, OAuth (M2M)
    sem = asyncio.Semaphore(concurrency)
    t0 = time.time()
    async with aiohttp.ClientSession() as s:
        results = await asyncio.gather(*[_one(s, agent_url, headers, e, sem) for e in todo], return_exceptions=True)
    results = [r if isinstance(r, dict) else {"status": "error", "http": type(r).__name__} for r in results]
    out = summarize(results)
    out["seconds"] = round(time.time() - t0, 1)
    print(out)
    return out


if __name__ == "__main__":  # pragma: no cover
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--agent-url", required=True)
    ap.add_argument("--concurrency", type=int, default=8)
    ap.add_argument("--limit", type=int, default=500)
    ap.add_argument("--agent-principal", help="the agent app's client id; only its units are sent")
    from common.pg import add_args, apply_args
    add_args(ap)
    a = ap.parse_args()
    apply_args(a)
    s = asyncio.run(run(a.catalog, a.agent_url, a.concurrency, a.limit, a.agent_principal))
    raise SystemExit(1 if s.get("error", 0) > max(5, s["total"] // 20) else 0)   # >5% errors fails the task
