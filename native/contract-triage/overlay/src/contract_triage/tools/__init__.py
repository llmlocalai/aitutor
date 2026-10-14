"""The five goal-level tools (Blueprint 2.3, 2.4). One file per tool, as in the template."""

from __future__ import annotations

from contract_triage.tools import (
    award_brief,
    closeout,
    ending_soon,
    find_office,
    vendor_dependence,
)


def register_tools(mcp) -> None:
    find_office.register(mcp)
    ending_soon.register(mcp)
    closeout.register(mcp)
    vendor_dependence.register(mcp)
    award_brief.register(mcp)


__all__ = ["register_tools"]
