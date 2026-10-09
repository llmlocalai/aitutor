"""Step 18. Release gate: may this candidate harness replace the one in production?

  python3 harness/ops/release_gate.py --control harness/evals/out/<release>/results.jsonl \
                                       --candidate harness/evals/out/<candidate>/results.jsonl

Both runs must use the same model, cases and variant; the gate blocks if the models or cases differ,
and --variant picks the same variant from both files. The candidate ships only if it clears every
contract.yml success metric (including grounded_figures_min), loses no safety case the control passed
(within regression_tolerance), fits max_prompt_tokens, and is not worse than the control outside the
noise floor. "Better within noise" is not a reason to ship a riskier change; it is a reason
to keep the simpler of the two.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

KIT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(KIT / "evals"))
import report  # noqa: E402


def decide(control: list[dict], candidate: list[dict], metrics: dict, max_prompt_tokens: int | None = None) -> dict:
    """ship True only if every check below passes. Rows are results.jsonl rows of one variant."""
    reasons: list[str] = []
    if not control or not candidate:
        reasons.append(f"no rows to compare: control {len(control)}, candidate {len(candidate)}")
        return {"ship": False, "reasons": reasons, "delta": {"delta": 0.0, "lo": 0.0, "hi": 0.0, "significant": False},
                "noise_floor": None, "candidate_pass_rate": None}
    models = {"control": {r.get("served_model") or r.get("model") for r in control} - {None, ""},
              "candidate": {r.get("served_model") or r.get("model") for r in candidate} - {None, ""}}
    if models["control"] and models["candidate"] and models["control"] != models["candidate"]:
        reasons.append(f"different models: control {sorted(models['control'])}, candidate {sorted(models['candidate'])}")
    a, b = {r["case"] for r in control}, {r["case"] for r in candidate}
    if a - b:
        reasons.append(f"candidate did not run {len(a - b)} control cases: {sorted(a - b)[:5]}")
    if b - a:
        reasons.append(f"control did not run {len(b - a)} candidate cases: {sorted(b - a)[:5]}")
    rows = [{**r, "variant": "control"} for r in control] + [{**r, "variant": "candidate"} for r in candidate]
    s = report.summarize(rows, [], "control", metrics)
    cand = next(v for v in s["variants"] if v["id"] == "candidate")
    reasons += list(cand.get("gate", []))
    vc = cand["vs_control"]
    if vc["significant"] and vc["delta"] < 0:
        reasons.append(f"worse than control: {vc['delta']:+.3f} [{vc['lo']:+.3f}, {vc['hi']:+.3f}]")
    tokens = max((r.get("system_tokens", 0) for r in candidate), default=0)
    if max_prompt_tokens and tokens > max_prompt_tokens:
        reasons.append(f"prompt and tools about {tokens} tokens, above the budget of {max_prompt_tokens}")
    return {"ship": not reasons, "reasons": reasons, "delta": vc, "noise_floor": s["noise_floor"],
            "candidate_pass_rate": cand["pass_rate"]}


def _rows(p: str) -> list[dict]:
    return [json.loads(x) for x in Path(p).read_text().splitlines() if x.strip()]


def main(argv: list[str]) -> int:
    sys.path.insert(0, str(KIT / "evals"))
    from run_eval import contract_metrics
    ap = argparse.ArgumentParser()
    ap.add_argument("--control", required=True)
    ap.add_argument("--candidate", required=True)
    ap.add_argument("--variant", default="family-default")
    a = ap.parse_args(argv)
    ctl = [r for r in _rows(a.control) if r["variant"] == a.variant]
    cand = [r for r in _rows(a.candidate) if r["variant"] == a.variant]
    m = contract_metrics()
    d = decide(ctl, cand, m, int(m["max_prompt_tokens"]) if "max_prompt_tokens" in m else None)
    print("PASS: ship it" if d["ship"] else "BLOCKED")
    for r in d["reasons"]:
        print(" -", r)
    print(f"delta {d['delta']['delta']:+.3f} [{d['delta']['lo']:+.3f}, {d['delta']['hi']:+.3f}], noise floor {d['noise_floor']}")
    return 0 if d["ship"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
