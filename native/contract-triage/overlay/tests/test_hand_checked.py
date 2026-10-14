"""Ten real awards traced by hand (Blueprint 2.7), checked against the committed snapshot.

tests/fixtures/hand_checked.json is yours to write (step 2.7): one entry per award, with
values you worked out from its bronze rows (scripts/hand_check.py prints them). The
test is skipped until the file exists, and fails on any value that differs.

  [{"piid": "47QFLA20C0002", "why": "ending soon",
    "expect": {"current_end": "2025-08-05", "obligations": 195552467.34,
               "in_ending": false, "in_closeout": true}}]
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from contract_triage.backends.snapshot import SnapshotBackend
from contract_triage.config import PACKAGE_DATA

FILE = Path(__file__).parent / "fixtures" / "hand_checked.json"
CASES = json.loads(FILE.read_text()) if FILE.exists() else []


@pytest.mark.skipif(
    not CASES, reason="write tests/fixtures/hand_checked.json in step 2.7"
)
@pytest.mark.parametrize("case", CASES, ids=[c["piid"] for c in CASES])
def test_hand_checked(case):
    b = SnapshotBackend(PACKAGE_DATA)
    rows = b.award(case["piid"])
    assert rows, f"{case['piid']} is not in the snapshot"
    row, exp = rows[0], case["expect"]
    for k in (
        "current_end",
        "potential_end",
        "obligations",
        "current_value",
        "option_exercises",
        "k_closeouts",
        "sam_closed",
    ):
        if k in exp:
            assert (
                row[k] == pytest.approx(exp[k])
                if isinstance(exp[k], float)
                else row[k] == exp[k]
            ), k
    office = row["awarding_office_code"]
    if "in_ending" in exp:
        listed = any(
            r["award_key"] == row["award_key"] for r in b.contracts_ending(office)
        )
        assert listed == exp["in_ending"]
    if "in_closeout" in exp:
        listed = any(
            r["award_key"] == row["award_key"]
            and not r["has_k_closeout"]
            and not r["sam_closed"]
            for r in b.closeout_candidates(office)
        )
        assert listed == exp["in_closeout"]
