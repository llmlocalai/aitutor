"""python3 -m labs.m12_multi.calibrate

Calibrate the two judges against hand labels before they are allowed to remove
anything. Dry run only: nothing is changed. Every disagreement is printed so a
person can see what kind of claim each judge gets wrong.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from labs.common.paths import DATA
from labs.m12_multi.judges import judge_literal, judge_semantic, verify

HERE = Path(__file__).parent


def sections() -> dict:
    text = (DATA / "bank" / "policy" / "travel-policy.md").read_text()
    parts = re.split(r"^## Section (\d+)\.[^\n]*\n", text, flags=re.M)
    return {int(parts[i]): parts[i + 1].strip() for i in range(1, len(parts), 2)}


# region: calibrate
def calibrate(items: list, passages: dict) -> dict:
    rows = []
    for it in items:
        p = passages[it["section"]]
        rows.append({**it, "literal": judge_literal(it["claim"], p)["supported"],
                     "semantic": judge_semantic(it["claim"], p)["supported"],
                     "removed": verify(it["claim"], p)["verdict"].startswith("remove")})
    n = len(rows)
    agree = {j: sum(r[j] == r["supported"] for r in rows) / n for j in ("literal", "semantic")}
    true_removed = [r for r in rows if r["supported"] and r["removed"]]      # the costly mistake
    false_kept = [r for r in rows if not r["supported"] and not r["removed"]]
    return {"n": n, "agreement": agree, "true_claims_removed": true_removed,
            "false_claims_kept": false_kept, "rows": rows}
# endregion


def main():
    items = json.loads((HERE / "calibration_labels.json").read_text())["items"]
    r = calibrate(items, sections())
    print(f"1 {r['n']} hand-labelled claims | agreement with labels: "
          f"literal {r['agreement']['literal']:.2f}, semantic {r['agreement']['semantic']:.2f}")
    for j in ("literal", "semantic"):
        for row in r["rows"]:
            if row[j] != row["supported"]:
                print(f"2 {j:8s} wrong ({'said yes' if row[j] else 'said no '}): {row['claim']}")
    print(f"3 two-vote rule: true claims it would remove {len(r['true_claims_removed'])}, "
          f"false claims it would keep {len(r['false_claims_kept'])}")
    for row in r["false_claims_kept"]:
        print("  kept but false:", row["claim"])


if __name__ == "__main__":
    main()
