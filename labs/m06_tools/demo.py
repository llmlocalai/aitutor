"""python3 -m labs.m06_tools.demo"""
from __future__ import annotations

from labs.m05_rag.demo import build
from labs.m06_tools.tools import build_registry


def main():
    db, _ = build()
    reg = build_registry(db)
    print("1 tools:", [s["function"]["name"] for s in reg.schemas()], "| schema cost per turn ~", reg.schema_cost(), "tokens")
    print("2 schema:", reg.schemas()[1]["function"]["parameters"])
    r = reg.call("query_expenses", {"category": "meals", "cost_center": "CC-200"})
    print("3 meals, CC-200:", r["count"], "rows, total", r["total_usd"])
    r = reg.call("query_expenses", {"category": "meals", "month": "2026-07"})
    print("4 meals, 2026-07:", r["count"], "rows ->", r["diagnostic"])
    print("5 unknown tool:", reg.call("delete_everything", {}))
    print("6 bad argument:", reg.call("query_expenses", {"year": 2026}))
    text = reg.call_as_text("query_expenses", {})
    print("7 as tool message:", len(text), "chars", "(capped)" if "truncated" in text else "(fits)")
    print("8 call log:", [(c["tool"], "empty" if c["empty"] else "error" if c["error"] else "ok") for c in reg.log])


if __name__ == "__main__":
    main()
