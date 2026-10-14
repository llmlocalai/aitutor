"""Replaces the template's smoke tests after the rename (Blueprint 1.1)."""

from __future__ import annotations

from fastmcp import Client, FastMCP

from contract_triage.app import mcp
from contract_triage.config import settings

TOOLS = {
    "contracts_find_office",
    "contracts_list_ending_soon",
    "contracts_list_closeout_candidates",
    "contracts_assess_vendor_dependence",
    "contracts_get_award_brief",
}


def test_server_name():
    assert mcp.name == "Contract Triage MCP Server"


def test_default_transport_is_stdio():
    assert settings.mcp_transport == "stdio"


def test_submodules_register():
    from contract_triage.prompts import register_prompts
    from contract_triage.resources import register_resources
    from contract_triage.routes import register_routes
    from contract_triage.tools import register_tools

    for f in (register_tools, register_prompts, register_resources, register_routes):
        f(FastMCP("t"))


async def test_five_tools_three_resources_two_prompts():
    async with Client(mcp) as c:
        tools = await c.list_tools()
        assert {t.name for t in tools} == TOOLS
        assert {str(r.uri) for r in await c.list_resources()} == {
            "contracts://data-dictionary",
            "contracts://freshness",
            "contracts://sources",
        }
        assert {p.name for p in await c.list_prompts()} == {
            "closeout_sweep",
            "recompete_review",
        }


async def test_every_tool_is_read_only_and_documented():
    async with Client(mcp) as c:
        for t in await c.list_tools():
            assert t.annotations.read_only_hint is True, t.name
            assert t.annotations.destructive_hint is False, t.name
            doc = t.description or ""
            assert "?" in doc.splitlines()[0], (
                f"{t.name}: first line should be the user's question"
            )
            assert "Do not" in doc or "do not" in doc.lower(), (
                f"{t.name}: say when not to use it"
            )
