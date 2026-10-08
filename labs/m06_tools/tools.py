"""Two tools over the sample data: document search, and a query over expense rows.

The second one shows the rule that matters most for data tools: an empty result
must say which filter emptied it.
"""
from __future__ import annotations

import csv
import sqlite3

from labs.common.paths import DATA
from labs.m05_rag.search import search
from labs.m06_tools.registry import Registry


def load_expenses() -> list:
    with (DATA / "expenses.csv").open() as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["amount_usd"] = float(r["amount_usd"])
    return rows


# region: tools
def build_registry(db: sqlite3.Connection) -> Registry:
    reg = Registry()
    expenses = load_expenses()

    @reg.tool("Search policy documents. Use for rules, limits, definitions and deadlines. "
              "Returns passages with their source file.", enums={"collection": ["POLICY"]})
    def search_policy(query: str, collection: str = "POLICY") -> dict:
        res = search(db, collection, query, top_k=3)
        out = {"results": [{"source": r["source"], "tier": r["tier"], "section": r["context"], "text": r["text"]} for r in res["results"]]}
        if "diagnostic" in res:
            out["diagnostic"] = res["diagnostic"]
        return out

    @reg.tool("Total and list expense records. Use for questions about what was actually spent. "
              "Filters are optional: category (lodging, meals, air), city, cost_center, month (YYYY-MM).")
    def query_expenses(category: str = "", city: str = "", cost_center: str = "", month: str = "") -> dict:
        filters = {"category": category, "city": city, "cost_center": cost_center, "month": month}
        active = {k: v for k, v in filters.items() if v}

        def keep(row, use):
            return all((row["date"].startswith(v) if k == "month" else row[k].lower() == v.lower())
                       for k, v in use.items())

        rows = [r for r in expenses if keep(r, active)]
        out = {"filters": active, "rows": rows, "count": len(rows),
               "total_usd": round(sum(r["amount_usd"] for r in rows), 2)}
        if not rows and active:
            # Which single filter, if dropped, would have returned rows?
            culprits = [k for k in active if any(keep(r, {a: b for a, b in active.items() if a != k}) for r in expenses)]
            known = {k: sorted({(r["date"][:7] if k == "month" else r[k]) for r in expenses}) for k in active}
            out["diagnostic"] = (f"{' and '.join(culprits) or 'the combination of filters'} emptied this result. "
                                 f"Values that exist: {known}")
        return out

    return reg
# endregion
