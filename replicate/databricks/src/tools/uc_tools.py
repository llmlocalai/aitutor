"""Step 14. Call the Unity Catalog tools the way an agent will, and check the tool contract.

Create the function first (query_expenses.sql). Then:
  pip install unitycatalog-ai databricks-sdk
  python uc_tools.py
The managed MCP endpoint that exposes the same function to any MCP client is:
  https://<workspace-host>/api/2.0/mcp/functions/<catalog>/<schema>/<function_name>
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import Config  # noqa: E402


def contract_ok(raw: str, expect_rows: bool) -> tuple:
    """The two rules from module 6: a result is JSON, and an empty result carries a diagnostic."""
    try:
        out = json.loads(raw)
    except (TypeError, ValueError):
        return False, f"not JSON: {str(raw)[:80]}"
    if expect_rows and not out.get("count"):
        return False, "expected rows, got none"
    if not out.get("count") and not out.get("diagnostic"):
        return False, "empty result without a diagnostic"
    return True, out.get("diagnostic") or f"{out['count']} rows, total {out['total']}"


def main() -> None:  # pragma: no cover
    from unitycatalog.ai.core.databricks import DatabricksFunctionClient

    cfg = Config()
    fn = f"{cfg.catalog}.tools.query_expenses"
    client = DatabricksFunctionClient()            # serverless execution; local mode does not run SQL functions
    for args, expect in (({"employee_id": "E-1042", "claim_month": "2026-03"}, True),
                         ({"employee_id": "E-1042", "claim_month": "1999-01"}, False)):
        res = client.execute_function(fn, args)
        raw = getattr(res, "value", res)
        ok, detail = contract_ok(raw, expect)
        print(f"{'PASS' if ok else 'FAIL'} {args} -> {detail}")


if __name__ == "__main__":  # pragma: no cover
    main()
