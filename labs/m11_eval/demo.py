"""python3 -m labs.m11_eval.demo"""
from __future__ import annotations

import json
import random

from labs.common.paths import work
from labs.common.scripts import desk_policy, fabricating_policy
from labs.m05_rag.demo import build
from labs.m06_tools.tools import build_registry
from labs.m07_harness.loop import Agent
from labs.m08_skills.loader import Router
from labs.m11_eval import agent_eval, retrieval_eval
from labs.m11_eval.seal import assert_sealed, seal, studiable


def flaky(seed: int, p: float = 0.3):
    """A model that is right most of the time and invents a figure now and then."""
    rng = random.Random(seed)

    def policy(messages, tools):
        if tools is None or any(m.get("role") == "tool" for m in messages):
            if rng.random() < p:
                return fabricating_policy(messages, tools)
        return desk_policy(messages, tools)
    return policy


def setup(fresh: bool = True):
    db, _ = build(fresh=fresh)
    eval_dir = work("m11", fresh=fresh) / "evals"
    if not (eval_dir / "SEAL.json").exists():
        seal(db, eval_dir)
    return db, eval_dir


def main():
    db, eval_dir = setup()
    m = assert_sealed(eval_dir)
    print("1 sealed:", list(m["files"]), "| held out", len(m["heldout_chunks"]), "of 20 chunks | studiable", len(studiable(db)))
    try:
        seal(db, eval_dir)
    except RuntimeError as e:
        print("2 reseal refused:", str(e)[:44], "...")

    print("3 gold filter:", retrieval_eval.copies_passage("What is reimbursed at actual cost up to 220 dollars per night?",
                                                         "Lodging is reimbursed at actual cost up to 220 dollars per night."),
          "(copied run, dropped) vs",
          retrieval_eval.copies_passage("What is the most a hotel room can cost per night?",
                                        "Lodging is reimbursed at actual cost up to 220 dollars per night."), "(paraphrase, kept)")

    print("4 retrieval, same gold set, one flag changed per row:")
    print("     variant        n  hit@1  hit@3  hit@5  doc@5   mrr")
    for v in retrieval_eval.VARIANTS:
        r = retrieval_eval.run(db, eval_dir, v)
        print(f"     {v:13s} {r['n']:2d}  {r['hit@1']:.3f}  {r['hit@3']:.3f}  {r['hit@5']:.3f}  {r['doc@5']:.3f}  {r['mrr']:.3f}")
    r = retrieval_eval.run(db, eval_dir, "full")
    print("   misses with everything on:", r["misses"])
    for t in ("define", "rule", "cite"):
        a, b = retrieval_eval.run(db, eval_dir, "full", t), retrieval_eval.run(db, eval_dir, "no-graph", t)
        print(f"   type {t:6s} n={a['n']}: hit@5 full {a['hit@5']:.2f} vs no-graph {b['hit@5']:.2f}")
    print("   history lines:", sum(1 for _ in (eval_dir / "retrieval_history.jsonl").open()))

    reg, router = build_registry(db), Router()
    steady = agent_eval.run(lambda rep: Agent(reg, policy=desk_policy, skills=router.match), eval_dir)
    print("5 agent eval, deterministic model:", steady["totals"][0], "of", steady["n"])
    for q, rate in steady["pass_rate"].items():
        if rate < 1:
            d = steady["detail"][q][0]
            print("   fails:", q, {k: v for k, v in d.items() if k != "pass"})

    noisy = agent_eval.run(lambda rep: Agent(reg, policy=flaky(rep), skills=router.match), eval_dir, repeats=7)
    print("6 a model that invents a figure 30% of the time, 7 runs of the same", noisy["n"], "questions:")
    print("   totals", noisy["totals"], "| mean", noisy["mean"], "| spread", noisy["spread"], "| stdev", noisy["stdev"])
    print("   run 1 alone says", noisy["totals"][0], "of", noisy["n"], "and run", noisy["totals"].index(min(noisy["totals"])) + 1,
          "alone says", min(noisy["totals"]), "of", noisy["n"])

    gold = eval_dir / "frozen" / "gold_v1.json"
    import os
    os.chmod(gold, 0o644)
    data = json.loads(gold.read_text())
    data["items"] = data["items"][:3]                       # someone 'simplifies' the test
    gold.write_text(json.dumps(data))
    try:
        retrieval_eval.run(db, eval_dir, "full")
    except RuntimeError as e:
        print("7 tampered gold set:", e)


if __name__ == "__main__":
    main()
