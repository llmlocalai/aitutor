"""python3 -m labs.m15_ops.nightly_evals

Two nights of scheduled evals. The jobs run as small units inside the scheduler,
wait while a live request holds the busy marker, append to the eval history,
and the daily report prints each metric beside its previous value.
Night 2 simulates a bad config change: keyword search switched off.
"""
from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path

from labs.common.paths import work
from labs.m05_rag.demo import build
from labs.m08_skills.loader import Router
from labs.m08_skills.route_eval import evaluate as route_evaluate
from labs.m08_skills.route_eval import seal_gold
from labs.m11_eval import retrieval_eval
from labs.m11_eval.seal import seal
from labs.m15_ops.scheduler import busy, run_window


# region: report
METRICS = [("retrieval_history.jsonl", "RETRIEVAL hit@5", "hit@5"), ("retrieval_history.jsonl", "RETRIEVAL mrr", "mrr"),
           ("routing_history.jsonl", "ROUTING accuracy", "accuracy")]


def report_lines(eval_dir: Path, drop: float = 0.05) -> list:
    """One line per metric: latest, previous, and a flag when it fell by more than `drop`."""
    out = []
    for fname, label, key in METRICS:
        rows = [json.loads(x) for x in (eval_dir / fname).read_text().splitlines()] if (eval_dir / fname).exists() else []
        if not rows:
            out.append(f"{label:18s} no runs yet")
            continue
        now = rows[-1][key]
        prev = rows[-2][key] if len(rows) > 1 else None
        flag = "  REGRESSED" if prev is not None and now < prev - drop else ""
        out.append(f"{label:18s} {now:.3f}" + (f"  (previous {prev:.3f})" if prev is not None else "  (first run)") + flag)
    return out
# endregion


def main():
    w = work("m15e", fresh=True)
    eval_dir = w / "evals"
    db, _ = build(fresh=True)
    seal(db, eval_dir)
    (eval_dir / "routing").mkdir()
    seal_gold(eval_dir / "routing")
    marker = w / "BUSY"

    def retrieval_job():
        retrieval_eval.run(db, eval_dir, "full")

    def routing_job():
        r = route_evaluate(Router(), eval_dir / "routing")
        with (eval_dir / "routing_history.jsonl").open("a") as f:
            f.write(json.dumps({"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "n": r["n"], "accuracy": r["accuracy"]}) + "\n")

    for night in (1, 2):
        if night == 2:
            os.environ["RAG_HYBRID"] = "0"                          # the bad change
            chat = threading.Thread(target=lambda: busy_for(marker, 0.3))
            chat.start()
            time.sleep(0.05)
        log = run_window([("retrieval-eval", retrieval_job), ("routing-eval", routing_job)], marker, window_s=60, duty=1.0)
        if night == 2:
            chat.join()
            os.environ.pop("RAG_HYBRID")
        waited = sum(1 for _, s in log if s.startswith("waited"))
        print(f"{night} night {night}: units {[n for n, s in log if s == 'ran']}, paused for a live request {waited} checks (50 ms apart)")
        print("  daily report:")
        for line in report_lines(eval_dir):
            print("   ", line)


def busy_for(marker: Path, seconds: float) -> None:
    with busy(marker):
        time.sleep(seconds)


if __name__ == "__main__":
    main()
