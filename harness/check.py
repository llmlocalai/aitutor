"""What this repository can verify about the harness kit without a model.

  python3 harness/check.py          # print
  python3 harness/check.py --write  # also write content/harness-check.json for the page

1. every .py file compiles, every .json file parses, every .yml file parses (PyYAML if installed)
2. the unit tests pass (tests/test_harness.py), including the oracle and null baselines
3. the template harness lints clean for every model family
The JSON records a SHA-256 per file. The site audit refuses to build if a file changed after its check
was recorded, so the page never shows a check for code it no longer shows. Nothing here calls a model:
model results come only from evals/run_eval.py --write on a machine that has one.
"""
from __future__ import annotations

import hashlib
import io
import json
import py_compile
import sys
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
OUT = REPO / "content" / "harness-check.json"
SKIP = {"__pycache__", "out"}


def main() -> int:
    files, failures = {}, 0
    for p in sorted(HERE.rglob("*")):
        if not p.is_file() or SKIP & set(p.relative_to(HERE).parts) or p.name == "check.py" or p.suffix == ".pyc":
            continue
        rel = str(p.relative_to(REPO))
        entry = {"sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
        if p.suffix == ".py":
            try:
                py_compile.compile(str(p), doraise=True, cfile=str(Path("/tmp") / (p.stem + ".pyc")))
                entry["check"] = "compiles"
            except py_compile.PyCompileError as e:
                entry["check"], entry["error"] = "FAILED compile", str(e)[:300]
        elif p.suffix == ".json":
            try:
                json.loads(p.read_text())
                entry["check"] = "json parses"
            except ValueError as e:
                entry["check"], entry["error"] = "FAILED json", str(e)[:300]
        elif p.suffix in (".yml", ".yaml"):
            try:
                import yaml
                yaml.safe_load(p.read_text())
                entry["check"] = "yaml parses"
            except ImportError:
                entry["check"] = "not checked (PyYAML missing)"
            except Exception as e:                       # noqa: BLE001
                entry["check"], entry["error"] = "FAILED yaml", str(e)[:300]
        else:
            entry["check"] = "read only"
        failures += entry["check"].startswith("FAILED")
        files[rel] = entry
        print(f"{entry['check']:28} {rel}")

    buf = io.StringIO()
    suite = unittest.defaultTestLoader.discover(str(HERE / "tests"), pattern="test_*.py")
    result = unittest.TextTestRunner(stream=buf, verbosity=2).run(suite)
    tests = {"run": result.testsRun, "failed": len(result.failures) + len(result.errors),
             "names": [l.split(" ... ")[0] for l in buf.getvalue().splitlines() if " ... " in l]}
    print(f"tests: {tests['run']} run, {tests['failed']} failed")
    failures += tests["failed"]

    for d in ("runtime", "evals", "lint"):
        sys.path.insert(0, str(HERE / d))
    import assemble
    import baselines
    import harness_lint
    import run_eval
    cases = json.loads((HERE / "evals" / "cases.json").read_text())["cases"]
    variants = json.loads((HERE / "evals" / "variants.json").read_text())["variants"]
    m = run_eval.contract_metrics()
    today = json.loads((HERE / "evals" / "fixtures" / "world.json").read_text())["world_now"]
    base = {}
    for name, chat in (("oracle", baselines.oracle_chat), ("null", baselines.null_chat)):
        rows = []
        for v in variants:
            built = assemble.build("generic", variant=v["settings"], production=False, today=today)
            built["runtime"] = v.get("runtime") or {}
            rows += [run_eval.run_case(chat, c, built, m) for c in cases]
        base[name] = {"runs": len(rows), "passed": sum(r["passed"] for r in rows)}
    print("baselines:", base)
    lint = {fam: sum(len(v) for v in harness_lint.lint_folder(HERE / "template", fam).values())
            for fam in assemble.load_families()}
    tokens = {fam: assemble.build(fam)["tokens"] for fam in assemble.load_families()}
    print("template lint findings per family:", lint)

    report = {"checked_at": time.strftime("%Y-%m-%d"), "python": sys.version.split()[0], "files": files,
              "tests": tests, "failures": failures, "baselines": base, "lint_findings": lint, "prompt_tokens": tokens,
              "cases": len(cases), "variants": len(variants)}
    if "--write" in sys.argv:
        OUT.write_text(json.dumps(report, indent=1) + "\n")
        print("wrote", OUT.relative_to(REPO))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
