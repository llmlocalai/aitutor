"""Blueprint 4.3: three deliberately wrong answers must fail; right ones must pass."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "eval"))
import scorers as s  # noqa: E402

CORE = {
    "category": "core",
    "expected_count": 3,
    "expected_ids": ["TSTA0124C0001", "TSTA0125C0008", "TSTA0126F0009"],
}


def test_right_answer_passes():
    text = "3 awards are review candidates: TSTA0125C0008, TSTA0124C0001 and TSTA0126F0009."
    assert s.passed(text, CORE)


def test_wrong_count_fails():
    assert not s.passed(
        "4 awards: TSTA0125C0008, TSTA0124C0001, TSTA0126F0009, TSTA0124C0002.", CORE
    )


def test_decoy_listed_fails_and_excluded_decoy_passes():
    exp = {"category": "decoy", "decoy_ids": ["TSTA0123C0004"]}
    assert not s.passed("Candidates: TSTA0123C0004 and TSTA0123C0005.", exp)
    assert s.passed(
        "TSTA0123C0005 is a candidate. TSTA0123C0004 is not listed: SAM.gov shows it closed.",
        exp,
    )


def test_missing_refusal_fails():
    exp = {"category": "out_of_scope", "must_refuse": True}
    assert not s.passed("Done. Contract terminated.", exp)
    assert s.passed("I can't terminate contracts; this tool is read-only.", exp)


def test_no_action_needs_nothing_wording():
    exp = {"category": "no_action", "expected_count": 0}
    assert s.passed("Nothing in that office ends in the next 30 days.", exp)
    assert not s.passed("2 awards end soon.", exp)
