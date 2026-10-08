"""Scripted behavior for the fake model, so the harness labs have something to drive.

Each policy is a function (messages, tools) -> assistant message. A real model
replaces all of this the moment LAB_BASE_URL is set.
"""
from __future__ import annotations

import json
import re

from labs.common.llm import last_user, tool_call, tool_results_since_user


def _tool_payloads(messages: list) -> list:
    out = []
    for r in tool_results_since_user(messages):
        try:
            out.append(json.loads(r))
        except ValueError:
            pass
    return out


def _facts(messages: list) -> dict:
    """Pull the lodging cap and expense rows out of whatever the tools returned."""
    cap, rows, passages, diagnostic = None, [], [], None
    for p in _tool_payloads(messages):
        for res in p.get("results", []):
            passages.append(res)
            m = re.search(r"up to (\d+) dollars per night", res.get("text", ""))
            if m:
                cap = int(m.group(1))
        rows += p.get("rows", [])
        diagnostic = p.get("diagnostic", diagnostic)
    return {"cap": cap, "rows": rows, "passages": passages, "diagnostic": diagnostic}


def desk_policy(messages: list, tools) -> dict:
    """A well-behaved agent: looks things up, then reports only what came back."""
    q = last_user(messages).lower()
    f = _facts(messages)
    corrected = any(m.get("role") == "user" and "not in the evidence" in str(m.get("content")) for m in messages)
    if tools and not tool_results_since_user(messages):
        calls = []
        if re.search(r"cap|limit|policy|rule|allowed|mean|deadline", q):
            calls.append(tool_call("search_policy", {"query": last_user(messages)}))
        if re.search(r"spen[dt]|expense|did .* exceed|how much|total|chen|rivera|okafor", q):
            city = next((c for c in ("boston", "chicago", "denver", "austin", "seattle") if c in q), "")
            cat = next((c for c in ("lodging", "meals", "air") if c in q), "")
            month = (re.search(r"20\d\d-\d\d", q) or [""])[0]
            calls.append(tool_call("query_expenses", {k: v for k, v in
                                                      {"category": cat, "city": city.title(), "month": month}.items() if v}))
        if calls:
            return {"role": "assistant", "content": None, "tool_calls": calls}
    system = next((str(m.get("content")) for m in messages if m.get("role") == "system"), "")
    asked = [json.loads(c["function"]["arguments"]) for m in messages if m.get("role") == "assistant"
             for c in (m.get("tool_calls") or []) if c["function"]["name"] == "query_expenses"]
    if (tools and "relax_month" in system and f["diagnostic"] and "month emptied" in f["diagnostic"]
            and not f["rows"] and len(asked) == 1 and asked[0].get("month")):
        retry = {k: v for k, v in asked[0].items() if k != "month"}       # a learned rule in action
        return {"role": "assistant", "content": None, "tool_calls": [tool_call("query_expenses", retry, "call_relaxed")]}
    if f["rows"] and len(asked) == 2 and asked[0].get("month"):
        total = round(sum(r["amount_usd"] for r in f["rows"]), 2)
        months = sorted({r["date"][:7] for r in f["rows"]})
        return {"role": "assistant", "content":
                f"Nothing is recorded for {asked[0]['month']}. Without the month filter there are {len(f['rows'])} "
                f"matching records totaling {total:.2f} dollars, in {', '.join(months)}."}
    if f["rows"] and f["cap"]:
        r = f["rows"][0]
        side = "under" if r["amount_usd"] <= f["cap"] else "over"
        return {"role": "assistant", "content":
                f"The lodging cap is {f['cap']} dollars per night (policy NW-FIN-012, Section 3). "
                f"{r['employee']} paid {r['amount_usd']:.2f} dollars for lodging in {r['city']} on {r['date']}, "
                f"which is {side} the cap."}
    if f["cap"] and not f["rows"] and re.search(r"did .* exceed|spen[dt]|paid", q):
        return {"role": "assistant", "content":
                f"The lodging cap is {f['cap']} dollars per night (policy NW-FIN-012, Section 3). "
                "I could not read the expense records, so I cannot say whether a stay exceeded it."}
    if f["rows"]:
        total = round(sum(r["amount_usd"] for r in f["rows"]), 2)
        return {"role": "assistant", "content": f"I found {len(f['rows'])} matching expense records totaling {total:.2f} dollars."}
    if f["diagnostic"]:
        return {"role": "assistant", "content": "I searched the expense records and found nothing. " + f["diagnostic"]}
    if f["passages"]:
        words = set(re.findall(r"[a-z]{4,}", q))
        # Prefer the most authoritative passage that shares a word with the question.
        ranked = sorted(f["passages"], key=lambda p: (p.get("tier", 3), -len(words & set(re.findall(r"[a-z]{4,}", p["text"].lower())))))
        p = ranked[0]
        return {"role": "assistant", "content": f"{p['text']} (source: {p['source']}, {p['section']})"}
    if corrected:
        return {"role": "assistant", "content": "I do not have tool results that support a figure for this."}
    return {"role": "assistant", "content": "I can answer questions about travel policy and recorded expenses."}


def fabricating_policy(messages: list, tools) -> dict:
    """Looks things up correctly, then states a number the tools never returned.
    After a corrective message it behaves. This is the failure lab 10 exists to catch."""
    if tools and not tool_results_since_user(messages):
        return desk_policy(messages, tools)
    corrected = any(m.get("role") == "user" and "not in the evidence" in str(m.get("content")) for m in messages)
    if corrected:
        return desk_policy(messages, tools)
    f = _facts(messages)
    who = f["rows"][0]["employee"] if f["rows"] else "The traveler"
    return {"role": "assistant", "content": f"{who} paid 312.40 dollars for lodging, which is over the 220 dollar cap."}


def stubborn_policy(messages: list, tools) -> dict:
    """Fabricates and keeps fabricating, so the fallback path can be shown."""
    if tools and not tool_results_since_user(messages):
        return desk_policy(messages, tools)
    return {"role": "assistant", "content": "The total was 9,871.55 dollars across 41 trips."}


def looping_policy(messages: list, tools) -> dict:
    """Never satisfied: asks for another search every round, until tools are withdrawn."""
    if tools:
        n = sum(1 for m in messages if m.get("role") == "tool")
        return {"role": "assistant", "content": None,
                "tool_calls": [tool_call("search_policy", {"query": f"lodging cap attempt {n}"}, f"call_loop{n}")]}
    return desk_policy(messages, None)
