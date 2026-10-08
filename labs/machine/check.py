#!/usr/bin/env python3
"""check.py -- verify the steps the labs cannot run, on your own machine.

    python3 labs/machine/check.py            # print results
    python3 labs/machine/check.py --write    # also write content/machine-output.json (scrubbed)

Reads labs/machine/machine.json (copy machine.example.json). Every check is
read-only: it lists, reads, or sends one short request. It starts, stops and
writes nothing on the machine. The only model call is the contract check, and it
runs only if you name a probe_model that is already loaded, so nothing is evicted.

Python 3.9+, standard library only. macOS commands (launchctl, lsof) are used
where present; each check reports SKIP when its tool or setting is missing.
"""
from __future__ import annotations

import datetime as dt
import glob
import json
import os
import shutil
import statistics
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
PASS, FAIL, SKIP, MANUAL = "pass", "fail", "skip", "manual"


def get_json(url: str, timeout: float = 5.0, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or "{}")


def sh(args: list, timeout: float = 20.0) -> str:
    if not shutil.which(args[0]) and not Path(args[0]).exists():
        raise FileNotFoundError(args[0])
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout).stdout


def launchd(cfg: dict) -> dict:
    """label suffix -> (pid or None, last exit status) for loaded jobs with the prefix."""
    out = {}
    for line in sh(["launchctl", "list"]).splitlines()[1:]:
        parts = line.split("\t")
        if len(parts) == 3 and parts[2].startswith(cfg["launchd_prefix"]):
            out[parts[2][len(cfg["launchd_prefix"]):]] = (None if parts[0] == "-" else parts[0], parts[1])
    return out


# --- one function per step key --------------------------------------------
def c_engine(cfg):
    tags = get_json(cfg["engine_url"].rstrip("/") + "/api/tags")
    names = [m["name"] for m in tags.get("models", [])]
    d = Path(cfg["models_dir"]) if cfg.get("models_dir") else None
    on_volume = bool(d and d.is_dir() and str(d).startswith(cfg.get("ai_data_root", "/")))
    ok = bool(names) and on_volume
    return (PASS if ok else FAIL), f"{len(names)} models listed; model folder on the data volume: {on_volume}"


def c_params(cfg):
    want = ["OLLAMA_MAX_LOADED_MODELS", "OLLAMA_KEEP_ALIVE", "OLLAMA_NUM_PARALLEL", "OLLAMA_CONTEXT_LENGTH"]
    found = {}
    p = Path(cfg.get("engine_env_file") or "")
    if p.is_file():
        for line in p.read_text().splitlines():
            line = line.strip()
            if line.startswith("export "):
                k, _, v = line[7:].partition("=")
                if k in want:
                    found[k] = v.split("#")[0].strip()
    ps = get_json(cfg["engine_url"].rstrip("/") + "/api/ps")
    loaded = [(m.get("name"), m.get("context_length")) for m in ps.get("models", [])]
    missing = [k for k in want if k not in found]
    detail = "set: " + ", ".join(f"{k.replace('OLLAMA_', '')}={v}" for k, v in found.items())
    detail += f" | loaded now: {loaded}"
    return (PASS if not missing else FAIL), detail + (f" | not set: {missing}" if missing else "")


def c_contract(cfg):
    model = cfg.get("probe_model")
    if not model:
        return SKIP, "set probe_model to a model that is already loaded; this check never loads one"
    loaded = [m.get("name") for m in get_json(cfg["engine_url"].rstrip("/") + "/api/ps").get("models", [])]
    if model not in loaded:
        return SKIP, f"{model} is not loaded right now; skipped so nothing is evicted"
    t0 = time.time()
    r = get_json(cfg["engine_url"].rstrip("/") + "/v1/chat/completions", timeout=120,
                 body={"model": model, "messages": [{"role": "user", "content": "Reply with the word ready."}], "max_tokens": 16})
    secs = time.time() - t0
    toks = r.get("usage", {}).get("completion_tokens", 0)
    return PASS, f"completion in {secs:.1f}s, {toks} completion tokens, usage block present: {'usage' in r}"


def c_second(cfg):
    url = cfg.get("second_runtime_url")
    if not url:
        return SKIP, "no second runtime configured"
    models = get_json(url.rstrip("/") + "/models")
    return PASS, f"second runtime answers /models with {len(models.get('data', []))} model(s)"


def c_latency(cfg):
    p = Path(cfg.get("request_log") or "")
    if not p.is_file():
        return SKIP, "request log not found"
    rows = []
    with p.open("rb") as f:
        f.seek(max(0, p.stat().st_size - 2_000_000))
        for raw in f.read().splitlines()[1:]:
            try:
                r = json.loads(raw)
            except ValueError:
                continue
            if r.get("latency_ms") and r.get("status") in (200, "200", "ok"):
                rows.append(r)
    if len(rows) < 10:
        return SKIP, f"only {len(rows)} successful requests in the recent log"
    lat = sorted(r["latency_ms"] / 1000 for r in rows[-500:])
    out = [r.get("completion_tokens") or 0 for r in rows[-500:]]
    p50, p90 = lat[len(lat) // 2], lat[int(len(lat) * 0.9)]
    return PASS, f"last {len(lat)} requests: p50 {p50:.1f}s, p90 {p90:.1f}s, median completion {statistics.median(out):.0f} tokens"


def c_private(cfg):
    port = cfg.get("engine_port")
    out = sh(["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN"])
    addrs = sorted({line.split()[8].rsplit(":", 1)[0] for line in out.splitlines()[1:] if len(line.split()) > 8})
    if not addrs:
        return FAIL, f"nothing is listening on port {port}"
    local = all(a in ("127.0.0.1", "[::1]", "localhost") for a in addrs)
    return (PASS if local else FAIL), f"port {port} listens on {addrs}"


def c_expose(cfg):
    ts = shutil.which("tailscale") or "/Applications/Tailscale.app/Contents/MacOS/Tailscale"
    out = sh([ts, "funnel", "status"])
    lines = [l.strip() for l in out.splitlines() if "proxy" in l or "|--" in l]
    engine = str(cfg.get("engine_port"))
    leaks = [l for l in lines if f":{engine}" in l]
    return (FAIL if leaks else PASS), f"{len(lines)} public route(s); engine port exposed: {bool(leaks)}"


def c_register(cfg):
    p = Path(cfg.get("mcp_config") or "")
    if not p.is_file():
        return SKIP, "no MCP client config"
    servers = json.loads(p.read_text()).get("mcpServers", {})
    notes = []
    ok = True
    for name, s in servers.items():
        cmd = s.get("command", "")
        exists = bool(shutil.which(cmd) or Path(cmd).exists())
        ok &= exists
        n_tools = "not listed"
        if exists and cfg.get("mcp_list_flag"):
            try:
                env = {**os.environ, **{k: v for k, v in (s.get("env") or {}).items()}}
                r = subprocess.run([cmd, *s.get("args", []), cfg["mcp_list_flag"]], capture_output=True, text=True,
                                   timeout=90, env=env)
                n_tools = f"{sum(1 for l in r.stdout.splitlines() if l.strip())} lines from {cfg['mcp_list_flag']}"
            except Exception as e:  # noqa: BLE001
                n_tools = f"list failed: {type(e).__name__}"
        notes.append(f"{name}: command found {exists}, {n_tools}")
    return (PASS if servers and ok else FAIL), "; ".join(notes) or "no servers"


def c_share(cfg):
    d = Path(cfg.get("coding_agent_skills_dir") or "")
    if not d.is_dir():
        return SKIP, "no coding-agent skills folder"
    links, broken = 0, []
    for f in d.rglob("*"):
        if f.is_symlink():
            links += 1
            if not f.resolve().exists():
                broken.append(f.name)
    return (PASS if links and not broken else FAIL), f"{links} linked skill file(s), broken: {broken or 'none'}"


def c_supervise(cfg):
    jobs = launchd(cfg)
    need = cfg.get("required_services", [])
    down = [s for s in need if s not in jobs or jobs[s][0] is None]
    bad_exit = sorted(k for k, (pid, status) in jobs.items() if pid is None and status not in ("0", "-"))
    return (PASS if not down else FAIL), (f"{len(jobs)} jobs loaded; required and running: "
                                          f"{len(need) - len(down)}/{len(need)}; not running: {down or 'none'}; "
                                          f"jobs whose last exit was non-zero: {bad_exit or 'none'}")


def c_nightly(cfg):
    jobs = launchd(cfg)
    return (PASS if "scheduler" in jobs else FAIL), f"scheduler job loaded: {'scheduler' in jobs}"


def c_collect(cfg):
    jobs = launchd(cfg)
    want = cfg.get("collector_services", [])
    have = [s for s in want if s in jobs]
    return (PASS if want and len(have) == len(want) else FAIL), f"collector jobs loaded: {have}"


def c_wiki(cfg):
    d = Path(cfg.get("wiki_dir") or "")
    if not d.is_dir():
        return SKIP, "no wiki folder"
    pages = list(d.rglob("*.md"))
    newest = max((p.stat().st_mtime for p in pages), default=0)
    return (PASS if pages else FAIL), f"{len(pages)} wiki pages, newest {dt.datetime.fromtimestamp(newest).date() if newest else 'none'}"


def c_rollback(cfg):
    files = [Path(p) for p in glob.glob(cfg.get("backup_glob") or "")]
    if not files:
        return FAIL, "no backups found"
    newest = max(files, key=lambda p: p.stat().st_mtime)
    age = (time.time() - newest.stat().st_mtime) / 3600
    return (PASS if age <= cfg.get("backup_max_age_hours", 48) else FAIL), f"{len(files)} backups, newest is {age:.0f} hours old"


def c_change(cfg):
    repo = cfg.get("repo_dir")
    last = sh(["git", "-C", repo, "log", "-1", "--format=%cs %s"]).strip()
    if not last:
        return FAIL, "not a git repository, or no commits"
    dirty = len([l for l in sh(["git", "-C", repo, "status", "--porcelain"]).splitlines() if l.strip()])
    skip = {"models", "pgdata", "knowledge-bank", "backups", "logs", "venv", ".venv", "node_modules", ".git", "data"}
    baks = 0
    for cur, dirs, files in os.walk(repo):
        dirs[:] = [d for d in dirs if d not in skip]
        baks += sum(1 for f in files if ".bak-" in f or ".pre-" in f)
    return PASS, f"last commit {last[:10]}; uncommitted paths {dirty}; dated backup copies kept beside files {baks}"


CHECKS = {
    "inference.engine": c_engine, "inference.params": c_params, "inference.contract": c_contract,
    "inference.second-runtime": c_second, "inference.latency": c_latency, "inference.private": c_private,
    "api-gateway.expose": c_expose, "tools-mcp.register": c_register, "skills.share": c_share,
    "ops.supervise": c_supervise, "ops.nightly": c_nightly, "ops.change": c_change,
    "knowledge.collect": c_collect, "knowledge.wiki": c_wiki, "self-evolving.rollback": c_rollback,
}
MANUAL_STEPS = {
    "self-evolving.limits": "a reading step; nothing to measure",
    "self-evolving.documents": "needs your learner's own report; read its daily line",
    "sdk.claude": "needs the Claude Agent SDK and an account; run it by hand",
}


def run(cfg: dict) -> dict:
    results = {}
    for key, fn in CHECKS.items():
        try:
            status, detail = fn(cfg)
        except FileNotFoundError as e:
            status, detail = SKIP, f"tool not found: {Path(str(e)).name}"
        except Exception as e:  # noqa: BLE001  -- a failed probe is a result, not a crash
            status, detail = FAIL, f"{type(e).__name__}: {str(e)[:160]}"
        results[key] = {"status": status, "detail": detail}
    for key, why in MANUAL_STEPS.items():
        results[key] = {"status": MANUAL, "detail": why}
    return results


def main() -> int:
    cfg_path = HERE / "machine.json"
    if not cfg_path.exists():
        print("copy labs/machine/machine.example.json to labs/machine/machine.json and edit it", file=sys.stderr)
        return 2
    cfg = json.loads(cfg_path.read_text())
    results = run(cfg)
    for k, v in results.items():
        print(f"{v['status'].upper():6s} {k:26s} {v['detail']}")
    if "--write" in sys.argv:
        sys.path.insert(0, str(REPO / "sync"))
        from scrub import Scrubber
        sc = Scrubber(json.loads((REPO / "sync" / "config.json").read_text()))
        clean = {k: {"status": v["status"], "detail": sc.scrub(v["detail"])} for k, v in results.items()}
        leaks = sc.leaks(json.dumps(clean))
        if leaks:
            print("not written: leak check failed:", leaks, file=sys.stderr)
            return 1
        out = {"checkedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "results": clean}
        (REPO / "content" / "machine-output.json").write_text(json.dumps(out, indent=1) + "\n")
        print("wrote content/machine-output.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
