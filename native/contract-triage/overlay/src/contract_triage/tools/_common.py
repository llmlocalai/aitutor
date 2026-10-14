"""Helpers the five tools share: the backend call, day counts, errors, evidence."""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import logging
import time
from functools import lru_cache
from typing import Any, Callable

from contract_triage.backends import get_backend
from contract_triage.config import PACKAGE_DATA
from contract_triage.models import Evidence
from contract_triage.untrusted import log_fields

log = logging.getLogger("contract_triage")

READ_ONLY = {
    "readOnlyHint": True,
    "destructiveHint": False,
    "idempotentHint": True,
    "openWorldHint": False,
}


@lru_cache(maxsize=1)
def source_ids() -> dict[str, str]:
    """id -> title from data/sources.json (Blueprint 1.10)."""
    p = PACKAGE_DATA / "sources.json"
    if not p.exists():
        return {}
    return {s["id"]: s["title"] for s in json.loads(p.read_text())["sources"]}


async def call(tool: str, fn: Callable[..., Any], *args: Any) -> Any:
    """Run a blocking backend call off the event loop, with an allowlisted log line."""
    t0 = time.perf_counter()
    out = await asyncio.to_thread(fn, *args)
    log.info(
        "call %s",
        log_fields(
            tool=tool,
            backend=get_backend().name,
            rows=len(out) if isinstance(out, list) else 1,
            ms=round((time.perf_counter() - t0) * 1000),
        ),
    )
    return out


def days_between(a: str | None, b: str | None) -> int | None:
    if not a or not b:
        return None
    return (dt.date.fromisoformat(b[:10]) - dt.date.fromisoformat(a[:10])).days


def add_days(d: str, n: int) -> str:
    return (dt.date.fromisoformat(d[:10]) + dt.timedelta(days=n)).isoformat()


def error(message: str, hint: str) -> dict[str, str]:
    return {"error": message, "hint": hint}


def evidence(
    rows: list[dict[str, Any]],
    fields: list[str],
    data_date: str,
    sources: list[str],
    note: str = "",
) -> dict[str, Any]:
    known = source_ids()
    return Evidence(
        award_keys=[r["award_key"] for r in rows if r.get("award_key")],
        fields_used=fields,
        data_date=data_date,
        sources=[s for s in sources if not known or s in known],
        note=note,
    ).model_dump()


def page(items: list[Any], limit: int, offset: int) -> dict[str, Any]:
    window = items[offset : offset + limit]
    nxt = offset + len(window)
    return {
        "total": len(items),
        "count": len(window),
        "offset": offset,
        "items": window,
        "has_more": nxt < len(items),
        "next_offset": nxt if nxt < len(items) else None,
    }


async def known_office(office_code: str) -> dict[str, Any] | None:
    offices = await call("office_lookup", get_backend().offices)
    return next((o for o in offices if o["awarding_office_code"] == office_code), None)
