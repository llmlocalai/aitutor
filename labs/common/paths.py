"""Where the labs keep their files. Everything a lab writes goes under labs/_work,
which is safe to delete at any time."""
from __future__ import annotations

import os
import shutil
from pathlib import Path

LABS = Path(__file__).resolve().parent.parent
DATA = LABS / "data"
WORK = Path(os.environ.get("LAB_WORK", LABS / "_work"))


def work(name: str, fresh: bool = False) -> Path:
    """A scratch folder for one lab."""
    p = WORK / name
    if fresh and p.exists():
        shutil.rmtree(p)
    p.mkdir(parents=True, exist_ok=True)
    return p
