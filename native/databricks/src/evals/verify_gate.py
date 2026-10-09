"""Step 18. The release pipeline's first job: prove this exact commit passed the gate on main.

  python verify_gate.py gate_result.json $CI_COMMIT_SHA

The release branch is protected and only receives commits from main, but "it was on main" is not "it
passed". gate.py on main writes {sha, passed, reasons}; this check refuses to release anything else,
including a newer commit of main that has not been gated yet. check() is pure and tested.
"""
from __future__ import annotations

import json
import sys


def check(result: dict, sha: str) -> list:
    out = []
    if not sha:
        out.append("no commit sha given")
    if result.get("sha") != sha:
        out.append(f"the gate result is for {str(result.get('sha'))[:12]}, not {sha[:12]}: gate this commit on main first")
    if result.get("passed") is not True:
        out.append("the gate did not pass: " + "; ".join(result.get("reasons") or ["no reasons recorded"]))
    return out


if __name__ == "__main__":  # pragma: no cover
    problems = check(json.load(open(sys.argv[1])), sys.argv[2] if len(sys.argv) > 2 else "")
    for p in problems:
        print("RELEASE BLOCKED:", p)
    print("gate verified for this commit" if not problems else "release refused")
    sys.exit(1 if problems else 0)
