"""contracts://data-dictionary, contracts://freshness, contracts://sources (Blueprint 2.5).

Resources keep tool docstrings short: the model reads field meanings, the data date and
the dataset provenance here, without a tool call.
"""

from __future__ import annotations

import json

from fastmcp import FastMCP

from contract_triage.backends import get_backend
from contract_triage.config import PACKAGE_DATA

DICTIONARY = """Fields used by the contract triage tools (USAspending contract archive names).

award_key            contract_award_unique_key: CONT_AWD_<piid>_<agency>_<parent piid>_<parent agency>
piid                 award_id_piid: the contract or order number
parent_piid          parent_award_id_piid: the IDV an order sits under ('-NONE-' if none)
current_end          period_of_performance_current_end_date on the latest action
potential_end        period_of_performance_potential_end_date: the end if every option is exercised
current_value        current_total_value_of_award: base plus exercised options
potential_value      potential_total_value_of_award: base plus all options
remaining_option_value  potential_value minus current_value
obligations          sum of federal_action_obligation over all actions
fiscal_year          action_date_fiscal_year (October to September)

Action type codes (action_type_code):
  blank  base award (no action type)      C  funding only action
  G      exercise an option                K  close out
  E, F, X  terminations (default, convenience, cause)
  M      other administrative action

Closeout signals:
  k_closeout_in_usaspending  the award has at least one K action
  closed_in_sam              SAM.gov Contract Awards closedStatus = Yes
The two can disagree. The tools report both and never decide which is right.

Every list is a set of review candidates for a person, not a finding about anyone.
"""


def register(mcp: FastMCP) -> None:
    @mcp.resource("contracts://data-dictionary", mime_type="text/plain")
    def data_dictionary() -> str:
        """Field meanings, action type codes, and the two closeout signals."""
        return DICTIONARY

    @mcp.resource("contracts://freshness", mime_type="application/json")
    def freshness() -> str:
        """The data date of the tables, and how often each source refreshes."""
        b = get_backend()
        return json.dumps(
            {
                "data_date": b.data_date(),
                "backend": b.name,
                "usaspending_archive": "monthly (around the 6th of each month)",
                "sam_contract_awards": "daily; DoD awards appear 90 days after signing",
                "live_award_brief": "live calls, cached 24 hours",
            }
        )

    @mcp.resource("contracts://sources", mime_type="application/json")
    def sources() -> str:
        """Each public dataset behind the answers, with its Data.gov record."""
        p = PACKAGE_DATA / "sources.json"
        return p.read_text() if p.exists() else json.dumps({"sources": []})
