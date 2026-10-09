"""Steps 15 and 16. Run the cases against a model, for each structure variant, with repeats.

  # baselines first (no model needed): the oracle must score 1.0, the null near 0
  python3 harness/evals/run_eval.py --agent oracle
  python3 harness/evals/run_eval.py --agent null

  # a local model through Ollama's OpenAI-compatible endpoint (stays on your machine)
  python3 harness/evals/run_eval.py --base-url http://localhost:11434/v1 --model qwen3.6:35b-a3b \
      --family qwen --variants all --repeats 3 --label "Mac Studio, Q8" --write

  # a hosted model through its own API shape; the key is read from the named environment variable
  python3 harness/evals/run_eval.py --api anthropic --model <model id> --family claude --api-key-env ANTHROPIC_API_KEY
  python3 harness/evals/run_eval.py --api responses --base-url https://api.openai.com/v1 --model <model id> \
      --family gpt --api-key-env OPENAI_API_KEY

  # skill routing only (the description is the router): every query in each skill's evals/triggers.json
  python3 harness/evals/run_eval.py --base-url ... --model ... --triggers

  # look only at train cases while you change the harness; run test cases to confirm (step 17)
  python3 harness/evals/run_eval.py ... --split train

Writes harness/evals/out/<run>/results.jsonl (one row per case, variant and repeat, written as each
finishes, so a crash keeps what ran), errors.jsonl (infrastructure failures, never scored),
traces/<variant>.<case>.<rep>.json (the full message list, for reading a failure), and summary.json.
--write stores the summary in content/harness-results.json for the page; it is refused for the oracle
and null agents, because those are checks of the graders, not results.
A run is resumable: a row is skipped only if the same prompt, tools and case already produced it (the
fingerprint), so editing core.md or a case reruns exactly what changed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

KIT = Path(__file__).resolve().parent.parent
REPO = KIT.parent
sys.path.insert(0, str(KIT / "runtime"))
sys.path.insert(0, str(KIT / "evals"))
import assemble  # noqa: E402
import baselines  # noqa: E402
import gate  # noqa: E402
import graders  # noqa: E402
import loop  # noqa: E402
import report  # noqa: E402
import world as world_mod  # noqa: E402
import adapters  # noqa: E402

CASES = KIT / "evals" / "cases.json"
VARIANTS = KIT / "evals" / "variants.json"
PAGE = REPO / "content" / "harness-results.json"


def contract_metrics() -> dict:
    """success_metrics and release from contract.yml, flat numbers only."""
    out, sect = {}, None
    for raw in (KIT / "contract.yml").read_text().splitlines():
        line = raw.split("#")[0].rstrip()
        if not line.strip():
            continue
        if not line.startswith(" "):
            sect = line.split(":")[0]
            continue
        if sect in ("success_metrics", "release", "budgets"):
            k, _, v = line.strip().partition(":")
            try:
                out[k] = float(v)
            except ValueError:
                pass
    return out


def select_variants(spec: str, all_v: list[dict]) -> list[dict]:
    if spec == "all":
        return all_v
    want = [x.strip() for x in spec.split(",") if x.strip()]
    found = [v for v in all_v if v["id"] in want]
    missing = set(want) - {v["id"] for v in found}
    if missing:
        raise SystemExit(f"unknown variants: {sorted(missing)}")
    return found


def fingerprint(built: dict, case: dict) -> str:
    """Same prompt, tools, runtime checks and case: same fingerprint. A resumed run reuses only these rows."""
    blob = json.dumps([built["system"], built["tools"], built.get("runtime") or {}, case], sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:16]


def run_case(chat, case: dict, built: dict, metrics: dict, trace: Path | None = None) -> dict:
    execute = gate.guarded(world_mod.executor(), gate.load_tiers(), case.get("approvals", []))
    rt = built.get("runtime") or {}
    traj = loop.run(chat, built["system"], built["tools"], case["user"], execute,
                    max_steps=int(metrics.get("max_steps", 12)), max_tool_calls=int(metrics.get("max_tool_calls", 20)),
                    stopcheck=bool(rt.get("stopcheck")), verify=bool(rt.get("verify")))
    traj["system"] = built["system"]
    g = graders.grade(case, traj)
    if trace is not None:
        trace.parent.mkdir(parents=True, exist_ok=True)
        trace.write_text(json.dumps({"case": case["id"], "checks": g["checks"], "calls": traj["calls"],
                                     "messages": traj["messages"]}, indent=1, default=str))
    return {"case": case["id"], "category": case["category"], "split": case.get("split", "train"), "passed": g["passed"],
            "fp": fingerprint(built, case), "system_tokens": built.get("tokens", 0), "served_model": traj.get("served_model", ""),
            "failed_checks": [c["check"] for c in g["checks"] if not c["passed"]], "checks": g["checks"],
            "steps": traj["steps"], "stop": traj["stop"], "malformed": traj["malformed"], "nudges": traj["nudges"],
            "prompt_tokens": traj["usage"]["prompt_tokens"], "completion_tokens": traj["usage"]["completion_tokens"],
            "seconds": traj["seconds"], "calls": [[c["name"], c["decision"]] for c in traj["calls"]],
            "final": traj["final"][:600]}


def run_triggers(chat, built: dict) -> dict:
    """Per skill: how often load_skill named it when it should, and when it should not."""
    out = {}
    for f in sorted((KIT / "template" / "skills").glob("*/evals/triggers.json")):
        spec = json.loads(f.read_text())
        tp = fp = pos = neg = 0
        for q in spec["queries"]:
            hits = 0
            for _ in range(3):
                calls: list[str] = []

                def execute(name, args, calls=calls):
                    calls.append(str(args.get("name", "")) if name == "load_skill" else "")
                    return {"note": "trigger eval: tool not run"}, "allow"
                loop.run(chat, built["system"], built["tools"], q["query"], execute, max_steps=2)
                hits += spec["skill"] in calls
            rate = hits / 3
            if q["should_trigger"]:
                pos += 1
                tp += rate >= 0.5
            else:
                neg += 1
                fp += rate >= 0.5
        out[spec["skill"]] = {"recall": round(tp / max(1, pos), 3), "false_trigger_rate": round(fp / max(1, neg), 3),
                              "queries": len(spec["queries"])}
    return out


def _same_model(asked: str, served: str) -> bool:
    a, s = asked.lower(), served.lower()
    return a == s or s.startswith(a) or a.startswith(s) or a.split("/")[-1] == s.split("/")[-1]


def make_chat(a):
    """The chat function for --api. Keys come only from an environment variable named on the command line."""
    key = os.environ.get(a.api_key_env) if a.api_key_env else None
    if a.api_key_env and not key:
        raise SystemExit(f"environment variable {a.api_key_env} is empty")
    if not a.model:
        raise SystemExit("--model is required for --agent model")
    fam = assemble.load_families()[a.family]
    if a.api == "anthropic":
        if not key:
            raise SystemExit("--api anthropic needs --api-key-env")
        return adapters.anthropic_chat(a.model, api_key=key, base_url=a.base_url or "https://api.anthropic.com")
    if not a.base_url:
        raise SystemExit("--base-url is required for --api chat and --api responses")
    if a.api == "responses":
        return adapters.responses_chat(a.base_url, a.model, api_key=key)
    return loop.openai_chat(a.base_url, a.model, api_key=key, sampling=fam.get("sampling") or {})


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--agent", choices=["model", "oracle", "null"], default="model")
    ap.add_argument("--api", choices=["chat", "responses", "anthropic"], default="chat",
                    help="chat: any /chat/completions endpoint; responses: OpenAI Responses API; anthropic: Messages API")
    ap.add_argument("--base-url")
    ap.add_argument("--model")
    ap.add_argument("--api-key-env", help="name of an environment variable holding the key; never pass a key itself")
    ap.add_argument("--family", default="generic")
    ap.add_argument("--variants", default="family-default")
    ap.add_argument("--repeats", type=int, default=3)
    ap.add_argument("--cases", help="comma-separated case ids (default: all)")
    ap.add_argument("--split", choices=["train", "test", "all"], default="all")
    ap.add_argument("--label", default="", help="hardware and quantization, shown next to the results")
    ap.add_argument("--run-id")
    ap.add_argument("--triggers", action="store_true")
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args(argv)

    if a.write and a.agent != "model":
        raise SystemExit("--write is for model runs only: the oracle and null agents check the graders (check.py records them)")
    if a.agent == "model":
        chat = make_chat(a)
    else:
        chat = baselines.oracle_chat if a.agent == "oracle" else baselines.null_chat
    today = world_mod.load_world().get("world_now")

    spec = json.loads(VARIANTS.read_text())
    variants = select_variants(a.variants, spec["variants"])
    cases = json.loads(CASES.read_text())["cases"]
    if a.cases:
        keep = {x.strip() for x in a.cases.split(",")}
        cases = [c for c in cases if c["id"] in keep]
    if a.split != "all":
        cases = [c for c in cases if c.get("split", "train") == a.split]
    metrics = contract_metrics()
    run_id = a.run_id or f"{a.agent}-{(a.model or a.agent).replace(':', '_').replace('/', '_')}-{a.family}"
    out = KIT / "evals" / "out" / run_id
    out.mkdir(parents=True, exist_ok=True)

    if a.triggers:
        built = assemble.build(a.family, variant=variants[0]["settings"], production=False, today=today)
        res = run_triggers(chat, built)
        (out / "triggers.json").write_text(json.dumps(res, indent=1))
        print(json.dumps(res, indent=1))
        return 0

    rpath, epath = out / "results.jsonl", out / "errors.jsonl"
    rows = [json.loads(x) for x in rpath.read_text().splitlines()] if rpath.exists() else []
    errors = [json.loads(x) for x in epath.read_text().splitlines()] if epath.exists() else []
    reps = 1 if a.agent != "model" else a.repeats
    t0 = time.time()
    fresh: list[dict] = []
    for v in variants:
        built = assemble.build(a.family, variant=v["settings"], production=False, today=today)
        built["runtime"] = v.get("runtime") or {}
        for rep in range(reps):
            for c in cases:
                fp = fingerprint(built, c)
                old = next((r for r in reversed(rows) if (r["variant"], r["case"], r["rep"]) == (v["id"], c["id"], rep)), None)
                if old is not None and old.get("fp") == fp:
                    fresh.append(old)
                    continue
                try:
                    tr = out / "traces" / f"{v['id']}.{c['id']}.{rep}.json"
                    row = {"variant": v["id"], "rep": rep, "model": a.model or a.agent, **run_case(chat, c, built, metrics, tr)}
                except Exception as e:  # noqa: BLE001  infrastructure, not the model: never scored
                    err = {"variant": v["id"], "case": c["id"], "rep": rep, "error": f"{type(e).__name__}: {str(e)[:200]}"}
                    errors.append(err)
                    with epath.open("a") as f:
                        f.write(json.dumps(err) + "\n")
                    print("INFRA", err["variant"], err["case"], err["error"])
                    continue
                fresh.append(row)
                with rpath.open("a") as f:
                    f.write(json.dumps(row) + "\n")
                if a.model and row["served_model"] and not _same_model(a.model, row["served_model"]):
                    print(f"WARNING: asked for {a.model}, the server answered as {row['served_model']}")
                print(f"{'PASS' if row['passed'] else 'FAIL'} {v['id']:14} {c['id']:22} rep {rep} "
                      f"steps {row['steps']} {'; '.join(row['failed_checks'])[:90]}")
    rows = fresh                                           # this run's rows only: stale fingerprints drop out
    ran = {(r["variant"], r["case"], r["rep"]) for r in rows}
    errors = [e for e in errors if (e["variant"], e["case"], e["rep"]) not in ran]   # a retry that succeeded clears its error
    summary = report.summarize(rows, errors, spec["control"] if any(v["id"] == spec["control"] for v in variants) else variants[0]["id"],
                               metrics)
    served = sorted({r["served_model"] for r in rows if r.get("served_model")})
    summary.update({"run": run_id, "agent": a.agent, "model": a.model or a.agent, "served_models": served, "family": a.family,
                    "api": a.api, "split": a.split,
                    "label": a.label, "date": time.strftime("%Y-%m-%d"), "minutes": round((time.time() - t0) / 60, 1)})
    (out / "summary.json").write_text(json.dumps(summary, indent=1))
    for v in summary["variants"]:
        vc = v.get("vs_control")
        print(f"{v['id']:14} pass {v['pass_rate']:.3f}  safety {v['by_category'].get('safety', 'n/a')}  steps {v['mean_steps']}"
              + (f"  delta {vc['delta']:+.3f} [{vc['lo']:+.3f}, {vc['hi']:+.3f}] {v['verdict']}" if vc else "  (control)"))
    print(f"noise floor {summary['noise_floor']} by cases ({summary['noise_floor_runs']} if every run counted); "
          f"infra errors {summary['infra_errors']}")
    if a.write:
        page = json.loads(PAGE.read_text()) if PAGE.exists() else {"runs": []}
        page["runs"] = [r for r in page.get("runs", []) if r.get("run") != run_id] + [summary]
        PAGE.write_text(json.dumps(page, indent=1) + "\n")
        print("wrote", PAGE.relative_to(REPO))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
