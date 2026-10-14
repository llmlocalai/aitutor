"""What this repository verifies about the contract triage kit (the /databricks/contract-triage page).

  python3 native/contract-triage/check.py           # file checks only
  python3 native/contract-triage/check.py --write   # file checks + replay.py, then write
                                                     # content/triage-check.json and triage-replay.json

1. every .py file compiles; every .json and .yml parses; every .sh passes `bash -n`
2. every .sql file parses with sqlglot (Databricks dialect), a typo net only
3. replay.py runs the page's local steps in a clean clone of the GSA template; the
   pytest result recorded there is the kit's test result
The JSON records a SHA-256 per file. The site's audit refuses to build if a file changed
after its check, so the page never shows a check for code it no longer contains.
Nothing here calls Databricks, GitHub's API, SAM.gov or USAspending.
"""

from __future__ import annotations

import hashlib
import json
import py_compile
import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
OUT = REPO / "content" / "triage-check.json"
REPLAY = REPO / "content" / "triage-replay.json"


def sql_check(p: Path) -> str:
    try:
        import logging

        import sqlglot

        logging.getLogger("sqlglot").setLevel(logging.ERROR)
    except ImportError:
        return "read only (sqlglot missing)"
    text = re.sub(r":([a-z]+)", r"'\1'", p.read_text())  # named parameters
    text = re.sub(r"\$\{([A-Z_]+)\}", r"\1", text)  # render.py placeholders
    try:
        stmts = [x for x in sqlglot.parse(text, read="databricks") if x is not None]
    except Exception as e:  # noqa: BLE001
        return f"FAILED sqlglot databricks: {str(e).splitlines()[0][:120]}"
    known = sum(1 for x in stmts if not isinstance(x, sqlglot.exp.Command))
    return f"sqlglot databricks: {known}/{len(stmts)} statements parsed"


def main() -> int:
    files, failures = {}, 0
    for p in sorted(HERE.rglob("*")):
        if not p.is_file() or "__pycache__" in p.parts or p.name in ("check.py",):
            continue
        rel = str(p.relative_to(REPO))
        e = {"sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
        if p.suffix == ".py":
            try:
                py_compile.compile(str(p), doraise=True, cfile="/tmp/_triage_check.pyc")
                e["check"] = "compiles"
            except py_compile.PyCompileError as x:
                e["check"], e["error"] = "FAILED compile", str(x)[:300]
        elif p.suffix == ".json":
            try:
                json.loads(p.read_text())
                e["check"] = "json parses"
            except ValueError as x:
                e["check"], e["error"] = "FAILED json", str(x)[:300]
        elif p.suffix in (".yml", ".yaml"):
            try:
                import yaml

                yaml.safe_load(p.read_text())
                e["check"] = "yaml parses"
            except ImportError:
                e["check"] = "not checked (PyYAML missing)"
            except Exception as x:  # noqa: BLE001
                e["check"], e["error"] = "FAILED yaml", str(x)[:300]
        elif p.suffix == ".sh" or p.name == "pre-commit":
            r = subprocess.run(["bash", "-n", str(p)], capture_output=True, text=True)
            e["check"] = "bash -n passes" if r.returncode == 0 else "FAILED bash -n"
            if r.returncode:
                e["error"] = r.stderr[:300]
        elif p.suffix == ".sql":
            e["check"] = sql_check(p)
        else:
            e["check"] = "read only"
        failures += e["check"].startswith("FAILED")
        files[rel] = e

    tests = {"run": 0, "failed": 0, "names": []}
    if "--write" in sys.argv:
        r = subprocess.run([sys.executable, str(HERE / "replay.py"), "--write", *sys.argv[2:]])
        failures += r.returncode != 0
    if REPLAY.exists():
        rep = json.loads(REPLAY.read_text())
        out = "\n".join(s["output"] for s in rep["steps"] if s["step"] == "tests")
        m = re.search(r"(\d+) passed", out)
        f = re.search(r"(\d+) failed", out)
        tests["run"] = int(m.group(1)) + (int(f.group(1)) if f else 0) if m else 0
        tests["failed"] = int(f.group(1)) if f else 0
        names = next((s["output"] for s in rep["steps"] if s["step"] == "tests-list"), "")
        tests["names"] = [ln.split("tests/", 1)[-1] for ln in names.splitlines() if "::" in ln]
        failures += rep.get("failures", 0)
    report = {"checked_at": time.strftime("%Y-%m-%d %H:%M"), "python": sys.version.split()[0],
              "files": files, "tests": tests, "failures": failures}
    bad = [k for k, v in files.items() if v["check"].startswith("FAILED")]
    print(f"{len(files)} files, {len(bad)} failed checks; tests {tests['run'] - tests['failed']}/{tests['run']}")
    for k in bad:
        print("  FAILED", k, files[k].get("error", ""))
    if "--write" in sys.argv:
        OUT.write_text(json.dumps(report, indent=1) + "\n")
        print("wrote", OUT)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
