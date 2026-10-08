"""One screen that says whether every service is up.

    python3 -m labs.m15_ops.status http://127.0.0.1:11434/api/version http://127.0.0.1:8000/health
"""
from __future__ import annotations

import sys
import time
import urllib.request


# region: status
def probe(url: str, timeout: float = 3.0) -> dict:
    t0 = time.time()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return {"url": url, "up": 200 <= r.status < 300, "ms": int((time.time() - t0) * 1000), "detail": r.status}
    except Exception as e:  # noqa: BLE001
        return {"url": url, "up": False, "ms": int((time.time() - t0) * 1000), "detail": type(e).__name__}


def report(services: dict) -> str:
    lines = []
    for name, url in services.items():
        p = probe(url)
        lines.append(f"{'UP  ' if p['up'] else 'DOWN'} {name:14s} {p['detail']}")
    return "\n".join(lines)
# endregion


if __name__ == "__main__":
    print(report({u.split("//")[1].split("/")[0]: u for u in sys.argv[1:]}))
