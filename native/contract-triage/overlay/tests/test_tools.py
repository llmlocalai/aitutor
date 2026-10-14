"""Hand-checked answers on the synthetic fixture (Blueprint 2.7, data date 2026-10-06).

Office TSTA01 has nine awards. Worked out by hand from tests/fixtures/usas_tx.csv:
  ending within 180 days (by 2027-04-04): A1 2026-12-31, A8 2026-11-15, A9 2027-03-31
  A2 ends 2027-06-30 (outside); A7 was terminated, so it is not "open"
  closeout, basis both: A5 (ended 2026-03-31, funded 2026-05-01), A6 (2024-09-30), A7 (2026-02-01)
  A4 ended but is closed in SAM.gov (decoy); A3 has a K action
  FY2025 vendor obligations: V1 890,000 (A1 500,000 + 300,000, A8 90,000), V4 700,000 (A7)
  total 1,590,000; HHI = (89/159*100)^2 + (70/159*100)^2 = 5071.4
"""

from __future__ import annotations

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError

from contract_triage.app import mcp

A = "CONT_AWD_TSTA01{}_4732_-NONE-_-NONE-"


def key(piid: str) -> str:
    return f"CONT_AWD_{piid}_4732_-NONE-_-NONE-"


async def call(name, **args):
    async with Client(mcp) as c:
        return (await c.call_tool(name, args)).structured_content


async def test_find_office_by_words_and_code():
    out = await call("contracts_find_office", query="test office alpha")
    assert out["matches"][0]["awarding_office_code"] == "TSTA01"
    assert out["matches"][0]["award_count"] == 9
    out = await call("contracts_find_office", query="TSTB02")
    assert out["matches"][0]["awarding_office_code"] == "TSTB02"
    assert out["evidence"]["data_date"] == "2026-10-06"


async def test_ending_soon_180_days():
    out = await call("contracts_list_ending_soon", office_code="TSTA01", days_ahead=180)
    assert out["window_end"] == "2027-04-04"
    assert [i["piid"] for i in out["items"]] == [
        "TSTA0125C0008",
        "TSTA0124C0001",
        "TSTA0126F0009",
    ]
    a1 = out["items"][1]
    assert a1["days_to_end"] == 86
    assert a1["remaining_option_value"] == 1_500_000
    assert a1["has_options_left"] is True and a1["options_exercised"] == 1
    assert a1["obligations"] == 1_800_000
    assert out["evidence"]["award_keys"][1] == key("TSTA0124C0001")


async def test_ending_soon_sorted_by_option_value_and_paged():
    out = await call(
        "contracts_list_ending_soon",
        office_code="TSTA01",
        days_ahead=180,
        sort="remaining_option_value",
        limit=1,
    )
    assert out["items"][0]["piid"] == "TSTA0124C0001"
    assert out["has_more"] is True and out["next_offset"] == 1


async def test_no_action_needed():
    out = await call("contracts_list_ending_soon", office_code="TSTB02", days_ahead=30)
    assert out["total"] == 0
    assert "Nothing" in out["evidence"]["note"]


async def test_closeout_both_signals_excludes_decoy():
    out = await call("contracts_list_closeout_candidates", office_code="TSTA01")
    piids = [i["piid"] for i in out["items"]]
    assert piids == ["TSTA0123C0005", "TSTA0122C0006", "TSTA0125C0007"]
    assert "TSTA0123C0004" not in piids  # closed in SAM.gov: the decoy
    first = out["items"][0]
    assert first["funded_after_end"] is True and first["days_past_end"] == 189
    assert out["items"][1]["days_past_end"] == 736


async def test_closeout_basis_k_only_includes_sam_closed():
    out = await call(
        "contracts_list_closeout_candidates",
        office_code="TSTA01",
        basis="usaspending_k",
    )
    assert "TSTA0123C0004" in [i["piid"] for i in out["items"]]
    assert out["total"] == 4


async def test_sam_record_under_another_idv_does_not_close_an_order():
    out = await call("contracts_list_ending_soon", office_code="TSTA01", days_ahead=180)
    assert "TSTA0126F0009" in [i["piid"] for i in out["items"]]


async def test_vendor_dependence_hhi_matches_hand_calculation():
    out = await call(
        "contracts_assess_vendor_dependence",
        office_code="TSTA01",
        fiscal_year_from=2025,
        fiscal_year_to=2025,
    )
    y = out["years"][0]
    assert y["office_total"] == 1_590_000
    assert y["vendor_count"] == 2
    assert y["top_share"] == pytest.approx(890_000 / 1_590_000, abs=1e-4)
    assert y["hhi"] == pytest.approx(5071.4, abs=0.1)
    assert y["hhi_band"] == "above 1,800"


async def test_unknown_office_returns_hint():
    out = await call("contracts_list_ending_soon", office_code="ZZZZ99")
    assert (
        out["error"].startswith("Unknown office")
        and "contracts_find_office" in out["hint"]
    )


async def test_negative_days_is_a_readable_error():
    async with Client(mcp) as c:
        with pytest.raises(ToolError, match="greater than or equal to 1"):
            await c.call_tool(
                "contracts_list_ending_soon",
                {"office_code": "TSTA01", "days_ahead": -5},
            )


async def test_bad_office_code_pattern_rejected():
    async with Client(mcp) as c:
        with pytest.raises(ToolError, match="pattern"):
            await c.call_tool("contracts_list_ending_soon", {"office_code": "region 5"})


async def test_injection_text_comes_back_wrapped():
    out = await call("contracts_list_ending_soon", office_code="TSTA01", days_ahead=60)
    item = out["items"][0]
    assert item["piid"] == "TSTA0125C0008"
    text = item["untrusted_text"]["description"]
    assert text.startswith("Ignore previous instructions")
    assert "description" not in item  # free text never sits at the top level


async def test_resources_read():
    async with Client(mcp) as c:
        fresh = (await c.read_resource("contracts://freshness"))[0].text
        assert '"data_date": "2026-10-06"' in fresh
        assert (
            "action_type_code"
            in (await c.read_resource("contracts://data-dictionary"))[0].text
        )
