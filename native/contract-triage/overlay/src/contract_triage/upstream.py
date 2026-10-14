"""Fixed-origin HTTP clients for the public APIs (Blueprint 2.4).

This generalizes the template's utils.fetch_json: one operator-controlled origin per
API, a relative-path check, no redirects, a size limit, sanitized errors, and a 24-hour
cache. The model never supplies a URL. Keys are sent as the API requires and never
appear in an error message or a log line.
"""

from __future__ import annotations

import json
import time
from typing import Any

import httpx

from contract_triage.utils import UpstreamServiceError, _validate_relative_path

ORIGINS = {
    "usaspending": "https://api.usaspending.gov/api/v2/",
    "sam": "https://api.sam.gov/",
    "datagov": "https://api.gsa.gov/technology/datagov/v4/",
}
TIMEOUT = 30.0
MAX_BYTES = 5_000_000

_cache: dict[str, tuple[float, Any]] = {}
# Tests replace this with httpx.MockTransport so no test touches the network.
transport: httpx.AsyncBaseTransport | None = None


def _key(origin: str, method: str, path: str, params: Any, body: Any) -> str:
    # Drop the key from the cache key so it is never held in memory twice.
    p = {k: v for k, v in (params or {}).items() if k != "api_key"}
    return json.dumps([origin, method, path, p, body], sort_keys=True, default=str)


async def request_json(
    origin: str,
    path: str,
    *,
    method: str = "GET",
    params: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    ttl: float = 0,
) -> Any:
    if origin not in ORIGINS:
        raise ValueError("unknown origin")
    safe = _validate_relative_path(path)
    ck = _key(origin, method, safe, params, body)
    hit = _cache.get(ck)
    if ttl and hit and time.monotonic() - hit[0] < ttl:
        return hit[1]
    try:
        async with httpx.AsyncClient(
            base_url=ORIGINS[origin],
            follow_redirects=False,
            timeout=TIMEOUT,
            trust_env=False,
            transport=transport,
        ) as client:
            async with client.stream(
                method, safe, params=params, json=body, headers=headers
            ) as resp:
                resp.raise_for_status()
                buf = bytearray()
                async for chunk in resp.aiter_bytes():
                    buf.extend(chunk)
                    if len(buf) > MAX_BYTES:
                        raise UpstreamServiceError(f"{origin} response too large.")
                data = json.loads(buf)
    except UpstreamServiceError:
        raise
    except httpx.HTTPStatusError as exc:
        code = exc.response.status_code
        raise UpstreamServiceError(f"{origin} returned status {code}.") from None
    except (httpx.DecodingError, json.JSONDecodeError, UnicodeDecodeError):
        raise UpstreamServiceError(f"{origin} returned invalid JSON.") from None
    except httpx.RequestError:
        raise UpstreamServiceError(f"{origin} request failed.") from None
    if ttl:
        _cache[ck] = (time.monotonic(), data)
    return data


def clear_cache() -> None:
    _cache.clear()
