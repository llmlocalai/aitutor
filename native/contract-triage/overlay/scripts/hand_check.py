"""Trace one award by hand, from bronze rows to what the tools say (Blueprint 2.7).

  uv run python scripts/hand_check.py --duckdb local.duckdb --piid 47QFLA20C0002
  uv run python scripts/hand_check.py --warehouse $WAREHOUSE_ID --catalog $CATALOG \
      --profile $PROFILE --piid 47QFLA20C0002

Prints every bronze action of the award (date, mod, action type, obligation, end dates),
then the silver row, then which gold views list it. Work out the expected values from the
bronze rows yourself, then write them into tests/fixtures/hand_checked.json.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "eval"))
from build_golden import databricks_runner, duckdb_runner  # noqa: E402

BRONZE = (
    "SELECT action_date, modification_number AS mod, action_type_code AS type, "
    "federal_action_obligation AS obligation, current_total_value_of_award AS cur_value, "
    "potential_total_value_of_award AS pot_value, "
    "SUBSTR(period_of_performance_current_end_date, 1, 10) AS cur_end, "
    "SUBSTR(period_of_performance_potential_end_date, 1, 10) AS pot_end "
    "FROM bronze_usas_contract_tx WHERE award_id_piid = :piid "
    "ORDER BY action_date, modification_number"
)


def main() -> int:
    ap = argparse.ArgumentParser()
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--duckdb")
    src.add_argument("--warehouse")
    ap.add_argument("--catalog", default="")
    ap.add_argument("--profile", default="DEFAULT")
    ap.add_argument("--piid", required=True)
    a = ap.parse_args()
    run = (
        duckdb_runner(a.duckdb)
        if a.duckdb
        else databricks_runner(a.warehouse, a.catalog, a.profile)
    )
    rows = run(BRONZE, {"piid": a.piid})
    print(f"bronze actions for {a.piid}: {len(rows)}")
    for r in rows:
        print("  " + "  ".join(f"{k}={r[k]}" for k in r))
    s = run("SELECT * FROM silver_awards WHERE piid = :piid", {"piid": a.piid})
    print("silver_awards:")
    print(json.dumps(s, indent=1, default=str))
    for v in ("gold_contracts_ending", "gold_closeout_candidates"):
        n = run(f"SELECT COUNT(*) AS n FROM {v} WHERE piid = :piid", {"piid": a.piid})[
            0
        ]["n"]
        print(f"{v}: {'listed' if n else 'not listed'}")
    return 0 if rows else 1


if __name__ == "__main__":
    raise SystemExit(main())
