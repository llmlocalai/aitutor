"""The SQL itself, checked on the fixture DuckDB the snapshot fixture leaves behind (Blueprint 1.4 to 1.6)."""

from __future__ import annotations

import sys
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipelines"))
import common  # noqa: E402


def con(snapshot):
    return duckdb.connect(str(snapshot / "fixture.duckdb"), read_only=True)


def test_one_row_per_award(snapshot):
    c = con(snapshot)
    assert c.execute(
        "SELECT COUNT(*), COUNT(DISTINCT award_key) FROM silver_awards"
    ).fetchone() == (11, 11)


def test_silver_takes_latest_end_date_and_sums_obligations(snapshot):
    c = con(snapshot)
    end, obl, g, cfund = c.execute(
        "SELECT current_end, obligations, option_exercises, funding_actions FROM silver_awards "
        "WHERE piid = 'TSTA0124C0001'"
    ).fetchone()
    assert str(end) == "2026-12-31" and float(obl) == 1_800_000 and (g, cfund) == (1, 1)


def test_sam_join_uses_parent_idv(snapshot):
    c = con(snapshot)
    rows = dict(
        c.execute(
            "SELECT piid, sam_closed FROM silver_awards WHERE piid IN "
            "('TSTA0123C0004', 'TSTA0126F0009')"
        ).fetchall()
    )
    assert rows == {"TSTA0123C0004": True, "TSTA0126F0009": False}


def test_dq_checks_pass_and_agreement_is_reported(snapshot):
    c = con(snapshot)
    res = {
        r["check_name"]: r
        for r in common.run_checks(lambda q: c.execute(q).fetchone()[0])
    }
    assert all(r["result"] in ("pass", "info") for r in res.values())
    assert round(res["k_vs_sam_agreement_on_ended"]["value"], 4) == 0.6667


def test_duplicate_check_fails_on_broken_input(snapshot):
    c = duckdb.connect()
    c.execute(
        "CREATE TABLE silver_awards AS SELECT 'x' AS award_key UNION ALL SELECT 'x'"
    )
    name, sql, thr, cmp_, _ = common.DQ_CHECKS[2]
    assert name == "duplicate_award_keys"
    assert common.evaluate(float(c.execute(sql).fetchone()[0]), thr, cmp_) == "fail"


def test_archive_names_pick_newest_full_file():
    names = [
        "FY2025_047_Contracts_Full_20260806.zip",
        "FY2025_047_Contracts_Full_20261006.zip",
        "FY(All)_047_Contracts_Delta_20261006.zip",
        "FY2026_047_Contracts_Full_20261006.zip",
        "FY2025_097_Contracts_Full_20261006.zip",
    ]
    assert common.latest_full_per_fy(names, "047", 2025, 2026) == [
        "FY2025_047_Contracts_Full_20261006.zip",
        "FY2026_047_Contracts_Full_20261006.zip",
    ]


def test_sam_parser_normalizes_dates():
    rec = {
        "contractId": {"piid": "P1"},
        "awardDetails": {
            "transactionData": {"closedStatus": "Yes", "closedDate": "2/5/2026"}
        },
    }
    row = common.parse_sam_record(rec)
    assert row["closed_date"] == "2026-02-05" and row["closed_status"] == "Yes"


def test_statement_splitter_ignores_comments():
    assert common.statements("-- a; b\nSELECT 1;\n\nSELECT 2;") == [
        "SELECT 1",
        "SELECT 2",
    ]
