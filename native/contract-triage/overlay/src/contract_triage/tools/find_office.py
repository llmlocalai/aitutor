"""contracts_find_office: resolve a spoken office name to its six-character code."""

from __future__ import annotations

import difflib
import re
from typing import Annotated, Any

from fastmcp import FastMCP
from pydantic import Field

from contract_triage.backends import get_backend
from contract_triage.tools._common import READ_ONLY, call, error, evidence

_WORD = re.compile(r"[a-z0-9]+")
# Spoken forms people use for GSA office names.
_ALIASES = {
    "region": "region",
    "reg": "region",
    "r": "region",
    "aas": "aas",
    "assisted": "aas",
    "acquisition": "acquisition",
    "fas": "fas",
    "pbs": "pbs",
}


def _tokens(s: str) -> set[str]:
    return {_ALIASES.get(w, w) for w in _WORD.findall(s.lower())}


def score(query: str, code: str, name: str) -> float:
    q, n = _tokens(query), _tokens(f"{code} {name}")
    if query.strip().upper() == code:
        return 2.0
    overlap = len(q & n) / max(len(q), 1)
    ratio = difflib.SequenceMatcher(None, query.lower(), name.lower()).ratio()
    return round(0.7 * overlap + 0.3 * ratio, 4)


def register(mcp: FastMCP) -> None:
    @mcp.tool(
        name="contracts_find_office",
        annotations={"title": "Find an office", **READ_ONLY},
    )
    async def contracts_find_office(
        query: Annotated[
            str,
            Field(
                min_length=2,
                max_length=120,
                description="Office name or code, e.g. 'region 5 assisted acquisition'.",
            ),
        ],
    ) -> dict[str, Any]:
        """Which office do you mean? Returns the five best matching awarding offices.

        Use this first when the user names an office in words. Every other tool needs
        the six-character `awarding_office_code` this returns. Do not use it to count
        contracts; the counts here are context for choosing the right office.

        Data: USAspending contract archive, refreshed monthly; see data_date.
        Returns: {matches: [{awarding_office_code, awarding_office_name, award_count,
        open_count, score}], evidence}.
        """
        b = get_backend()
        offices = await call("contracts_find_office", b.offices)
        if not offices:
            return error(
                "No offices are loaded.", "Build the snapshot or check the gold views."
            )
        ranked = sorted(
            (
                {
                    **o,
                    "score": score(
                        query,
                        o["awarding_office_code"],
                        o["awarding_office_name"] or "",
                    ),
                }
                for o in offices
            ),
            key=lambda o: (-o["score"], -int(o["award_count"] or 0)),
        )
        top = [o for o in ranked[:5] if o["score"] > 0]
        keep = [
            "awarding_office_code",
            "awarding_office_name",
            "award_count",
            "open_count",
            "score",
        ]
        dd = await call("data_date", b.data_date)
        return {
            "matches": [{k: o[k] for k in keep} for o in top],
            "evidence": evidence(
                [],
                ["awarding_office_code", "awarding_office_name"],
                dd,
                ["usaspending-award-archive"],
                "Names are as reported in USAspending; ask the user to confirm.",
            ),
        }
