"""Resources (Blueprint 2.5)."""

from __future__ import annotations

from contract_triage.resources import contracts


def register_resources(mcp) -> None:
    contracts.register(mcp)


__all__ = ["register_resources"]
