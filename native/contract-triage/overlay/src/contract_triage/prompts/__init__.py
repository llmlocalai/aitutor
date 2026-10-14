"""Prompts (Blueprint 2.5)."""

from __future__ import annotations

from contract_triage.prompts import triage


def register_prompts(mcp) -> None:
    triage.register(mcp)


__all__ = ["register_prompts"]
