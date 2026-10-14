"""Replay every local step of the contract triage guide in a clean directory.

  python3 native/contract-triage/replay.py                 # print
  python3 native/contract-triage/replay.py --write         # also write content/triage-replay.json
  python3 native/contract-triage/replay.py --template /path/to/mcp-hackathon-template

It clones GSA-TTS/mcp-hackathon-template at commit 6e5fb39 (the commit the blueprint was
checked against), then runs the commands the page shows, in the page's order, with
REPO and KIT set the way ~/.contract-triage.env sets them. Each step's output is kept,
and the page prints it under that step as "recorded output". Steps that need a GitHub
account, an API key, the public internet or a Databricks workspace are not replayed;
the page marks them "run by you".

Needs git, uv and network access to GitHub and PyPI. Takes about two minutes.
"""

from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
KIT = HERE / "overlay"
OUT = HERE.parent.parent / "content" / "triage-replay.json"
TEMPLATE_URL = "https://github.com/GSA-TTS/mcp-hackathon-template.git"
TEMPLATE_SHA = "6e5fb39"
REAL_SAMPLE = os.environ.get("TRIAGE_REAL_SAMPLE", "")  # optional real archive CSV sample

ECHO_TOOL = '''from typing import Annotated

from fastmcp import FastMCP
from pydantic import Field


def register(mcp: FastMCP) -> None:
    @mcp.tool(name="echo_office", annotations={"readOnlyHint": True})
    async def echo_office(
        name: Annotated[str, Field(description="An office name.")],
    ) -> dict:
        """Echo an office name back. A learning tool; it reads nothing."""
        return {"office": name.strip().upper()}
'''

LIST_AND_CALL = (
    "uv run python -c \"import asyncio; from fastmcp import Client; "
    "from example_server.app import mcp\n"
    "async def m():\n"
    "    async with Client(mcp) as c:\n"
    "        print(sorted(t.name for t in await c.list_tools()))\n"
    "        r = await c.call_tool('echo_office', {'name': ' region 5 aas '})\n"
    "        print(r.structured_content)\n"
    "asyncio.run(m())\""
)


def main() -> int:
    write = "--write" in sys.argv
    tpl = sys.argv[sys.argv.index("--template") + 1] if "--template" in sys.argv else TEMPLATE_URL
    root = Path(tempfile.mkdtemp(prefix="triage-replay-"))
    repo = root / "contract-triage-mcp"
    env = {**os.environ, "REPO": str(repo), "KIT": str(KIT), "GIT_TERMINAL_PROMPT": "0",
           "UV_NO_PROGRESS": "1", "NO_COLOR": "1"}
    env.pop("VIRTUAL_ENV", None)
    steps: list[dict] = []
    t_start = time.time()

    def run(step: str, cmd: str, cwd: Path = repo, keep: int = 40, expect: int = 0) -> str:
        t0 = time.time()
        p = subprocess.run(["bash", "-c", cmd], cwd=cwd, env=env, capture_output=True, text=True)
        out = (p.stdout + p.stderr).replace(str(root), "~/code").replace(str(KIT), "$KIT")
        lines = [ln for ln in out.splitlines() if "UV_NATIVE_TLS" not in ln and ln.strip()]
        shown = lines if len(lines) <= keep else lines[: keep // 2] + ["..."] + lines[-keep // 2:]
        steps.append({"step": step, "cmd": cmd.replace(str(KIT), "$KIT"), "exit": p.returncode,
                      "seconds": round(time.time() - t0, 1), "output": "\n".join(shown)})
        mark = "ok " if p.returncode == expect else "BAD"
        print(f"[{mark}] {step:18s} {cmd.splitlines()[0][:70]}  ({p.returncode}, {steps[-1]['seconds']}s)")
        if p.returncode != expect:
            print(out[-3000:])
        return out

    # 0.3 "Use this template" + clone, approximated by a clone at the checked commit.
    run("clone", f"git clone -q {tpl} {repo} && git -C {repo} checkout -q -B main {TEMPLATE_SHA} "
                 f"&& git -C {repo} log --oneline -1", cwd=root)
    run("clone", "git config user.email replay@example.com && git config user.name replay")
    run("template-run", "cp .env.example .env && uv sync --group dev -q && uv run pytest tests/ -q")
    run("template-run", "uv run ruff check . && uv run ruff format --check .")
    # 0.3 learn: one tool of your own, on a branch you do not merge
    run("echo-tool", "git switch -q -c learn/echo-office && "
        f"cat > src/example_server/tools/echo_office.py <<'EOF'\n{ECHO_TOOL}EOF\n"
        "perl -0pi -e 's/from example_server.tools import example_tool\\n/from example_server.tools import echo_office, example_tool\\n/; "
        "s/    example_tool.register\\(mcp\\)\\n/    example_tool.register(mcp)\\n    echo_office.register(mcp)\\n/' "
        "src/example_server/tools/__init__.py && git diff --stat")
    run("echo-tool", LIST_AND_CALL)
    run("echo-tool", "git add -A && git commit -qm 'learn: echo_office' && git switch -q main && git branch")
    # 0.5 scripts and env lines into the repo (the probe itself needs keys: not replayed)
    run("scripts", 'mkdir -p scripts && cp -R "$KIT/scripts/." scripts/ && cat "$KIT/env.example.addition" >> .env.example '
        "&& cat \"$KIT/env.example.addition\" >> .env && git add scripts .env.example && git commit -qm 'scripts and env keys' && ls scripts")
    run("scripts", "python3 scripts/probe_apis.py", expect=1)  # no keys, no internet here: must say NOT OK
    # 1.1 rename
    run("rename", "bash scripts/rename_package.sh")
    run("rename", "echo \"matches: $(git grep -i example_server -- ':!uv.lock' ':!scripts/rename_package.sh' | wc -l | tr -d ' ')\"")
    run("rename", "uv sync --group dev -q && uv run pytest tests/ -q && git add -A && git commit -qm 'Rename example_server to contract_triage'")
    # 1.2 to 1.6 laptop path, on the synthetic fixture first
    run("data-files", 'cp -R "$KIT/sql" "$KIT/pipelines" . && mkdir -p tests/fixtures && cp "$KIT"/tests/fixtures/* tests/fixtures/ && ls sql pipelines')
    run("local-pipeline", "uv run --with duckdb python scripts/local_pipeline.py --csv tests/fixtures/usas_tx.csv "
        "--sam-json tests/fixtures/sam_closed.json --data-date 2026-10-06 --out /tmp/triage-snap --db /tmp/triage-fixture.duckdb")
    if REAL_SAMPLE and Path(REAL_SAMPLE).exists():
        d = root / "real"
        d.mkdir()
        shutil.copy(REAL_SAMPLE, d / "FY2026_097_Contracts_Full_20260907_1.csv")
        run("local-pipeline-real", f"uv run --with duckdb python scripts/local_pipeline.py --csv {d} "
            f"--out /tmp/triage-snap-real --db /tmp/triage-real.duckdb")
        run("local-pipeline-real", "uv run --with duckdb python -c \"import duckdb; c=duckdb.connect('/tmp/triage-real.duckdb', read_only=True); "
            "print(c.execute('SELECT COUNT(*) AS ended_no_k, SUM(CASE WHEN obligations >= 250000 THEN 1 ELSE 0 END) AS over_250k FROM gold_closeout_candidates').fetchall())\"")
    # 2.x server code
    run("apply-server", 'bash "$KIT/scripts/apply_server.sh" && git status --short | head -40')
    run("tests", "uv sync --group dev -q && uv run pytest tests/ -q")
    run("tests", "uv run ruff check . && uv run ruff format --check .")
    run("tests-list", "uv run pytest tests/ --collect-only -q | grep '::'", keep=200)
    # 1.9 snapshot into the package (fixture data here; your real export in step 1.9)
    run("snapshot", "uv run python scripts/local_pipeline.py --csv tests/fixtures/usas_tx.csv "
        "--sam-json tests/fixtures/sam_closed.json --data-date 2026-10-06 --db local.duckdb | tail -3 && ls src/contract_triage/data")
    # 2.3 to 2.6 call every tool from the command line
    run("call-tools", "uv run python scripts/call_tool.py --list")
    run("call-tools", "uv run python scripts/call_tool.py contracts_find_office '{\"query\": \"test office alpha\"}'")
    run("call-tools", "uv run python scripts/call_tool.py contracts_list_ending_soon '{\"office_code\": \"TSTA01\", \"days_ahead\": 180}' --max 1400")
    run("call-tools", "uv run python scripts/call_tool.py contracts_list_closeout_candidates '{\"office_code\": \"TSTA01\"}' --max 900")
    run("call-tools", "uv run python scripts/call_tool.py contracts_assess_vendor_dependence '{\"office_code\": \"TSTA01\", \"fiscal_year_from\": 2025, \"fiscal_year_to\": 2025}' --max 900")
    run("call-tools", "uv run python scripts/call_tool.py contracts_list_ending_soon '{\"office_code\": \"TSTA01\", \"days_ahead\": -5}'", expect=1)
    run("award-brief", "uv run python scripts/call_tool.py contracts_get_award_brief '{\"award_id\": \"TSTA0124C0001\"}' --max 1500")
    run("call-tools", "uv run python scripts/call_tool.py --resource contracts://freshness")
    # 4.1 and 4.2: golden set from the answer key, then key against tools
    run("golden", "uv run python eval/build_golden.py --duckdb local.duckdb --offices TSTA01,TSTB02")
    run("golden", "uv run python eval/local/run_tool_eval.py")
    # 5.7 the whole keyless path, timed from the clone
    steps.append({"step": "fresh-clone", "cmd": "(elapsed from clone to first tool call)", "exit": 0,
                  "seconds": round(time.time() - t_start, 1), "output": ""})
    rep = {"replayed_at": time.strftime("%Y-%m-%d %H:%M"), "template_commit": TEMPLATE_SHA,
           "platform": f"{platform.system()} {platform.machine()}, Python {platform.python_version()}",
           "uv": subprocess.run(["uv", "--version"], capture_output=True, text=True).stdout.strip(),
           "steps": steps, "failures": sum(1 for s in steps if s["exit"] not in (0,) and s["step"] not in ("scripts", "call-tools"))}
    bad = [s for s in steps if s["exit"] != 0 and not (s["step"] in ("scripts",) and "probe" in s["cmd"])
           and "days_ahead\": -5" not in s["cmd"]]
    rep["failures"] = len(bad)
    print(f"{len(steps)} commands, {len(bad)} unexpected exits, {rep['steps'][-1]['seconds']}s total")
    if write:
        OUT.write_text(json.dumps(rep, indent=1) + "\n")
        print("wrote", OUT)
    shutil.rmtree(root, ignore_errors=True)
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
