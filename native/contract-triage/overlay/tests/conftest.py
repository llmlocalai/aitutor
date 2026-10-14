"""Build a snapshot from the synthetic fixtures once, and point the server at it.

The fixtures (tests/fixtures/) are SYNTHETIC records in the real USAspending and SAM.gov
shapes, built so every expected value in the tests can be worked out by hand. They are
for tests only and never for the evaluation set.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / "tests" / "fixtures"
DATA_DATE = "2026-10-06"


@pytest.fixture(scope="session", autouse=True)
def snapshot(tmp_path_factory):
    out = tmp_path_factory.mktemp("snapshot")
    subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "local_pipeline.py"),
            "--csv",
            str(FIX / "usas_tx.csv"),
            "--sam-json",
            str(FIX / "sam_closed.json"),
            "--data-date",
            DATA_DATE,
            "--out",
            str(out),
            "--db",
            str(out / "fixture.duckdb"),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    from contract_triage.backends import get_backend
    from contract_triage.config import settings

    settings.data_backend = "snapshot"
    settings.snapshot_dir = str(out)
    settings.sam_api_key = ""
    get_backend.cache_clear()
    yield out
    get_backend.cache_clear()
