"""What this repository can verify about the Databricks-native kit without a workspace.

  python3 native/databricks/check.py          # print
  python3 native/databricks/check.py --write  # also write content/native-check.json

1. every .py file compiles
2. every .yml file parses (PyYAML, if installed)
3. every .sh file passes `bash -n`
4. the portable tests pass (tests/test_portable.py)
The JSON records a SHA-256 per file. The site's audit refuses to build if a file changed
after its check was recorded, so the page never claims a check for code it no longer shows.
Nothing here calls Databricks. Platform calls are marked "not executed" on the page.
"""
from __future__ import annotations

import hashlib
import io
import json
import py_compile
import subprocess
import sys
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
OUT = REPO / "content" / "native-check.json"


POSTGRES_SQL = ("review_queue.sql",)


def sql_check(p: Path) -> str:
    """Parse with sqlglot (a third-party parser, not the Databricks or Postgres engine). It knows
    standard SELECT/CREATE/MERGE syntax and not newer DDL such as CREATE POLICY or CREATE VOLUME, so the
    result says how many statements it could check. It is a typo net, not proof the SQL runs."""
    try:
        import logging
        import sqlglot
        logging.getLogger("sqlglot").setLevel(logging.ERROR)
    except ImportError:
        return "read only (sqlglot missing)"
    dialect = "postgres" if p.name in POSTGRES_SQL else "databricks"
    import re
    text, note = p.read_text(), ""
    # Lakeflow pipeline syntax sqlglot does not know; the clause is from the vendor's expectations page.
    text, n = re.subn(r"\s+ON VIOLATION (DROP ROW|FAIL UPDATE)", "", text)
    if n:
        note = f" ({n} ON VIOLATION clauses skipped)"
    try:
        stmts = [x for x in sqlglot.parse(text, read=dialect) if x is not None]
    except Exception as e:                                # noqa: BLE001
        return f"FAILED sqlglot {dialect}: {str(e).splitlines()[0][:120]}"
    known = sum(1 for x in stmts if not isinstance(x, sqlglot.exp.Command))
    return f"sqlglot {dialect}: {known}/{len(stmts)} statements parsed{note}"


def main() -> int:
    files, failures = {}, 0
    for p in sorted(HERE.rglob("*")):
        if not p.is_file() or "__pycache__" in p.parts or p.name == "check.py":
            continue
        rel = str(p.relative_to(REPO))
        entry = {"sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
        if p.suffix == ".py":
            try:
                py_compile.compile(str(p), doraise=True, cfile=str(Path("/tmp") / (p.stem + ".pyc")))
                entry["check"] = "compiles"
            except py_compile.PyCompileError as e:
                entry["check"], entry["error"] = "FAILED compile", str(e)[:300]
        elif p.suffix in (".yml", ".yaml") or p.name == ".gitlab-ci.yml":
            try:
                import yaml
                yaml.safe_load(p.read_text())
                entry["check"] = "yaml parses"
            except ImportError:
                entry["check"] = "not checked (PyYAML missing)"
            except Exception as e:                       # noqa: BLE001
                entry["check"], entry["error"] = "FAILED yaml", str(e)[:300]
        elif p.suffix == ".json":
            try:
                json.loads(p.read_text())
                entry["check"] = "json parses"
            except ValueError as e:
                entry["check"], entry["error"] = "FAILED json", str(e)[:300]
        elif p.suffix == ".sh":
            r = subprocess.run(["bash", "-n", str(p)], capture_output=True, text=True)
            entry["check"] = "bash -n passes" if r.returncode == 0 else "FAILED bash -n"
            if r.returncode:
                entry["error"] = r.stderr[:300]
        elif p.suffix == ".sql":
            entry["check"] = sql_check(p)
        else:
            entry["check"] = "read only"
        failures += entry["check"].startswith("FAILED")
        files[rel] = entry
        print(f"{entry['check']:28} {rel}")

    sys.path.insert(0, str(HERE / "tests"))
    buf = io.StringIO()
    suite = unittest.defaultTestLoader.discover(str(HERE / "tests"), pattern="test_*.py")
    result = unittest.TextTestRunner(stream=buf, verbosity=2).run(suite)
    tests = {"run": result.testsRun, "failed": len(result.failures) + len(result.errors),
             "names": [l.split(" ... ")[0] for l in buf.getvalue().splitlines() if " ... " in l]}
    print(f"portable tests: {tests['run']} run, {tests['failed']} failed")
    failures += tests["failed"]

    report = {"checked_at": time.strftime("%Y-%m-%d"), "python": sys.version.split()[0],
              "files": files, "tests": tests, "failures": failures}
    if "--write" in sys.argv:
        OUT.write_text(json.dumps(report, indent=1) + "\n")
        print("wrote", OUT.relative_to(REPO))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
