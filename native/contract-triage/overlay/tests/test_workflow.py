"""Blueprint 5.1 to 5.3 on the fixture: verified packets, a planted wrong number, decision memory."""

from __future__ import annotations

import sys
from pathlib import Path

from fastmcp import Client

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "workflow"))
import triage  # noqa: E402
from verifier import unsupported  # noqa: E402

from contract_triage.app import mcp  # noqa: E402


async def run(explain, decisions=()):
    async with Client(mcp) as c:

        async def call_tool(name, args):
            return (await c.call_tool(name, args)).structured_content

        return await triage.run_office(
            call_tool, "TSTA01", explain, list(decisions), "t1"
        )


async def test_template_explanations_all_verify():
    res = await run(triage.template_explain)
    # ending within 90 days: A8 (40 days) and A1 (86 days); plus 3 closeout candidates
    assert res["found"] == 5
    assert len(res["accepted"]) == 5 and not res["rejected"]
    assert (
        res["accepted"][0]["evidence"]["piid"] == "TSTA0123C0005"
    )  # funded after end first
    assert "Review candidates for office TSTA01" in res["packet"]


async def test_planted_wrong_number_is_rejected():
    def liar(item):
        return triage.template_explain(item).replace(
            str(item["current_end"]), "2031-01-01"
        )

    res = await run(liar)
    assert not res["accepted"] and len(res["rejected"]) == 5
    assert all("date 2031-01-01" in r["problems"] for r in res["rejected"])


async def test_decided_items_are_skipped_until_they_change():
    first = await run(triage.template_explain)
    a5 = next(r for r in first["accepted"] if r["evidence"]["piid"] == "TSTA0123C0005")
    decision = {
        "award_key": a5["award_key"],
        "kind": "closeout",
        "current_end_at_decision": a5["evidence"]["current_end"],
        "obligations_at_decision": a5["evidence"]["obligations"],
    }
    second = await run(triage.template_explain, [decision])
    assert second["after_filter"] == 4
    changed = {**decision, "obligations_at_decision": 1.0}
    third = await run(triage.template_explain, [changed])
    assert third["after_filter"] == 5


def test_verifier_accepts_formatted_numbers_and_flags_inventions():
    ev = {
        "piid": "TSTA0124C0001",
        "obligations": 1800000.0,
        "current_end": "2026-12-31",
        "days_to_end": 86,
    }
    assert (
        unsupported(
            "TSTA0124C0001 ends 2026-12-31 in 86 days with $1,800,000 obligated.", ev
        )
        == []
    )
    assert unsupported("TSTA0124C0001 has $2,000,000 left.", ev) == [
        "number $2,000,000"
    ]
    assert unsupported("TSTA0199C0099 ends soon.", ev) == ["award TSTA0199C0099"]
