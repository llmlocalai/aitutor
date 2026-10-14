"""Free text written by other people comes back as data, never as instructions (Blueprint 2.6).

Contract descriptions and vendor names are typed by contracting staff and vendors. A
record can contain "ignore previous instructions". Every such field is returned inside an
`untrusted_text` object, stripped of control characters and cut to 300 characters, and
the tool docstrings tell the model to treat that object as quoted data.
"""

from __future__ import annotations

import re
from typing import Any

MAX_CHARS = 300
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_SPACE = re.compile(r"\s+")


def clean(text: Any, limit: int = MAX_CHARS) -> str:
    if text is None:
        return ""
    s = _SPACE.sub(" ", _CONTROL.sub(" ", str(text))).strip()
    return s if len(s) <= limit else s[: limit - 1] + "…"


def wrap(**fields: Any) -> dict[str, dict[str, str]]:
    """wrap(description=..., vendor_name=...) -> {"untrusted_text": {...}}"""
    return {
        "untrusted_text": {
            k: clean(v) for k, v in fields.items() if v not in (None, "")
        }
    }


# Log only these keys. Upstream bodies, URLs, query strings and keys never reach a log.
LOG_ALLOWLIST = {"tool", "office_code", "award_key", "rows", "ms", "backend", "status"}


def log_fields(**fields: Any) -> dict[str, Any]:
    return {k: v for k, v in fields.items() if k in LOG_ALLOWLIST}
