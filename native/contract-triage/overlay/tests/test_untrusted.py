from contract_triage.untrusted import clean, log_fields, wrap


def test_truncates_to_300_and_strips_controls():
    s = clean("a\x00b\n" + "x" * 400)
    assert len(s) == 300 and "\x00" not in s and s.endswith("…")


def test_wrap_drops_empty_fields():
    assert wrap(description="hi", vendor_name="") == {
        "untrusted_text": {"description": "hi"}
    }


def test_log_allowlist():
    assert log_fields(tool="t", url="https://x?api_key=SECRET", rows=3) == {
        "tool": "t",
        "rows": 3,
    }
