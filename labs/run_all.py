"""Run every lab offline and record what each printed.

    python3 -m labs.run_all            # run, print a summary, write content/lab-output.json
    python3 -m labs.run_all --check    # also fail if any lab errors

The site shows these recorded outputs under each step, so what a lesson calls
"expected output" is what this script actually saw.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

LABS = [   # key, module, optional (needs a third-party package)
    ("m01.budget", "labs.m01_inference.budget", False),
    ("m01.bench", "labs.m01_inference.bench", False),
    ("m01.router", "labs.m01_inference.router", False),
    ("m02.demo", "labs.m02_gateway.demo", False),
    ("m02.route", "labs.m02_gateway.route", False),
    ("m03.demo", "labs.m03_knowledge.demo", False),
    ("m04.demo", "labs.m04_state.demo", False),
    ("m05.demo", "labs.m05_rag.demo", False),
    ("m05.pg", "labs.m05_rag.pg", True),
    ("m06.demo", "labs.m06_tools.demo", False),
    ("m06.mcp", "labs.m06_tools.mcp_check", True),
    ("m07.demo", "labs.m07_harness.demo", False),
    ("m07.triage", "labs.m07_harness.triage", False),
    ("m07.stream", "labs.m07_harness.stream", False),
    ("m08.demo", "labs.m08_skills.demo", False),
    ("m08.eval", "labs.m08_skills.route_eval", False),
    ("m09.demo", "labs.m09_memory.demo", False),
    ("m09.tool", "labs.m09_memory.tool_check", False),
    ("m10.demo", "labs.m10_guard.demo", False),
    ("m10.tests", "labs.m10_guard.run_tests", False),
    ("m11.demo", "labs.m11_eval.demo", False),
    ("m12.demo", "labs.m12_multi.demo", False),
    ("m12.calibrate", "labs.m12_multi.calibrate", False),
    ("m13.demo", "labs.m13_evolve.demo", False),
    ("m14.demo", "labs.m14_sdk.demo", True),
    ("m15.demo", "labs.m15_ops.demo", False),
    ("m15.logs", "labs.m15_ops.logs", False),
    ("m15.nightly", "labs.m15_ops.nightly_evals", False),
]


def main() -> int:
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LAB_", "RAG_", "GUARD_"))}   # always the fake model
    dest = ROOT / "content" / "lab-output.json"
    try:
        previous = json.loads(dest.read_text())["outputs"]
    except (OSError, ValueError, KeyError):
        previous = {}
    out, failed = {}, []
    for key, module, optional in LABS:
        t0 = time.time()
        p = subprocess.run([sys.executable, "-m", module], cwd=ROOT, env=env, capture_output=True, text=True, timeout=300)
        ok = p.returncode == 0
        if not ok and optional and "ModuleNotFoundError" in p.stderr:
            if key in previous:
                out[key] = previous[key]              # keep what an earlier full run recorded
                print(f"SKIP {key:11s} optional package or server missing; kept the earlier recorded output")
            else:
                print(f"SKIP {key:11s} optional package or server missing")
            continue
        print(f"{'ok  ' if ok else 'FAIL'} {key:14s} {time.time() - t0:5.1f}s")
        if ok and "not installed, skipped" in p.stdout and key in previous and "not installed, skipped" not in previous[key]:
            out[key] = previous[key]              # a partial run must not replace a full recording
            print(f"     {key:14s} ran with an SDK missing; kept the earlier full recorded output")
        elif ok:
            out[key] = p.stdout.rstrip()
        else:
            failed.append(key)
            print(p.stderr[-800:])
    if "--check" in sys.argv and failed:
        return 1
    if not failed:
        dest.write_text(json.dumps({"python": sys.version.split()[0], "outputs": out}, indent=1) + "\n")
        print("wrote", dest.relative_to(ROOT), f"({len(out)} outputs)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
