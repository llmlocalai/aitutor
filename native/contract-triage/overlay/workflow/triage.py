"""Blueprint 5.1. The weekly triage as fixed phases in code: detect, filter, explain,
verify, draft. The model writes only the explanation; code decides what is listed and
rejects any explanation with a number, date or ID the tools did not return.

`call_tool(name, args)` is any async function that calls the MCP server (in-process,
or the deployed app). `explain(item)` returns text; on Databricks it calls a model.
"""

from __future__ import annotations

import datetime as dt
from typing import Any, Awaitable, Callable

from verifier import unsupported

CallTool = Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]]


async def detect(call_tool: CallTool, office: str) -> list[dict[str, Any]]:
    ending = await call_tool(
        "contracts_list_ending_soon",
        {"office_code": office, "days_ahead": 90, "limit": 50},
    )
    closeout = await call_tool(
        "contracts_list_closeout_candidates", {"office_code": office, "limit": 50}
    )
    items = [
        {"kind": "ending_soon", "data_date": ending["window_start"], **i}
        for i in ending.get("items", [])
    ]
    items += [
        {"kind": "closeout", "data_date": closeout["data_date"], **i}
        for i in closeout.get("items", [])
    ]
    return items


def keep(item: dict[str, Any], decisions: list[dict[str, Any]]) -> bool:
    """Drop an item a person already decided, unless its end date or money changed since."""
    for d in decisions:
        if d["award_key"] == item["award_key"] and d["kind"] == item["kind"]:
            same_end = (
                str(d.get("current_end_at_decision") or "")[:10]
                == str(item.get("current_end"))[:10]
            )
            same_money = float(d.get("obligations_at_decision") or 0) == float(
                item.get("obligations") or 0
            )
            if same_end and same_money:
                return False
    return True


def reason(item: dict[str, Any]) -> str:
    if item["kind"] == "ending_soon":
        opt = "options remain" if item.get("has_options_left") else "no options remain"
        return f"ends {item['current_end']} ({item['days_to_end']} days); {opt}"
    sig = (
        "no K closeout"
        if not item.get("k_closeout_in_usaspending")
        else "K closeout present"
    )
    sam = (
        "not closed in SAM.gov"
        if not item.get("closed_in_sam")
        else "closed in SAM.gov"
    )
    extra = "; funded after end" if item.get("funded_after_end") else ""
    return f"ended {item['current_end']} ({item['days_past_end']} days ago); {sig}; {sam}{extra}"


async def run_office(
    call_tool: CallTool,
    office: str,
    explain: Callable[[dict[str, Any]], str],
    decisions: list[dict[str, Any]],
    run_id: str = "",
) -> dict[str, Any]:
    found = await detect(call_tool, office)
    todo = [i for i in found if keep(i, decisions)]
    # Closeout first; within a kind keep the tool's own ranking (stable sort).
    todo.sort(key=lambda i: i["kind"] != "closeout")
    accepted, rejected = [], []
    for item in todo:
        text = explain(item)
        problems = unsupported(text, item)
        row = {
            "run_id": run_id,
            "office_code": office,
            "award_key": item["award_key"],
            "kind": item["kind"],
            "reason": reason(item),
            "explanation": text,
            "evidence": item,
            "data_date": item["data_date"],
            "verified": not problems,
            "problems": problems,
        }
        (rejected if problems else accepted).append(row)
    return {
        "office": office,
        "found": len(found),
        "after_filter": len(todo),
        "accepted": accepted,
        "rejected": rejected,
        "packet": packet(office, accepted, rejected),
    }


def packet(
    office: str, accepted: list[dict[str, Any]], rejected: list[dict[str, Any]]
) -> str:
    dd = accepted[0]["data_date"] if accepted else ""
    lines = [
        f"# Review candidates for office {office}",
        f"Data date {dd}. Generated {dt.date.today().isoformat()}. "
        "Every item needs a person's decision; nothing here is a finding.",
        "",
    ]
    for kind, title in (("closeout", "Closeout"), ("ending_soon", "Ending soon")):
        rows = [r for r in accepted if r["kind"] == kind]
        if not rows:
            continue
        lines += [
            f"## {title} ({len(rows)})",
            "",
            "| PIID | Award key | Reason |",
            "|---|---|---|",
        ]
        lines += [
            f"| {r['evidence']['piid']} | {r['award_key']} | {r['reason']} |"
            for r in rows
        ]
        lines.append("")
        for r in rows:
            lines += [f"- **{r['evidence']['piid']}**: {r['explanation']}"]
        lines.append("")
    if rejected:
        lines += [
            f"_{len(rejected)} explanation(s) were rejected by the verifier and left out._"
        ]
    return "\n".join(lines) + "\n"


def template_explain(item: dict[str, Any]) -> str:
    """The no-model explanation: built only from tool fields, so it always verifies."""
    if item["kind"] == "ending_soon":
        return (
            f"Review candidate: {item['piid']} ends {item['current_end']}; remaining option "
            f"value {item['remaining_option_value']}."
        )
    return (
        f"Review candidate: {item['piid']} ended {item['current_end']}, "
        f"{item['days_past_end']} days before the data date, with {item['obligations']} obligated."
    )
