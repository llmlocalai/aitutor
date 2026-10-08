"""python3 -m labs.m13_evolve.demo"""
from __future__ import annotations

import asyncio

from labs.common.paths import work
from labs.common.scripts import desk_policy
from labs.m06_tools.tools import build_registry
from labs.m07_harness.loop import BASE_PROMPT, Agent
from labs.m08_skills.loader import Router
from labs.m11_eval import agent_eval
from labs.m11_eval.demo import setup
from labs.m13_evolve.loop import nightly, read_rules
from labs.m13_evolve.promote import standing


def main():
    db, eval_dir = setup()
    w = work("m13", fresh=True)
    log_dir, rules_path = w / "logs", w / "learned-rules.md"
    reg, router = build_registry(db), Router()

    def make_agent(rules: str, logs=None):
        prompt = BASE_PROMPT + ("\n\n## Learned rules\n" + rules if rules else "")
        return Agent(reg, base_prompt=prompt, policy=desk_policy, skills=router.match, log_dir=logs)

    base = agent_eval.run(lambda rep: make_agent(""), eval_dir)
    print("0 sealed eval before any learning:", base["totals"][0], "of", base["n"],
          "| failing:", [q for q, r in base["pass_rate"].items() if r < 1])

    traffic = {"2026-07-01": ["How much was spent on meals in 2026-07?", "How much was spent on meals in 2026-07?",
                              "What is the nightly lodging cap?"],
               "2026-07-02": ["How much was spent on lodging in 2026-08?"],
               "2026-07-03": ["How much was spent on air travel in 2026-07?", "How much was spent on lodging in Denver?"]}
    for day, questions in traffic.items():
        live = make_agent(read_rules(rules_path), logs=log_dir)
        for q in questions:
            asyncio.run(live.run([{"role": "user", "content": q}]))
        rep = nightly(db, log_dir, reg, eval_dir, rules_path, make_agent, day, mode="report")
        print(f"{day}: found {rep['findings']} | standing {[(t, s, f'{d} day(s)') for t, s, d in standing(db)]}")
        if rep["pending"]:
            print("   gate passed, report mode, nothing written:", rep["pending"])

    rep = nightly(db, log_dir, reg, eval_dir, rules_path, make_agent, "2026-07-04", mode="apply")
    print("apply:", rep["applied"])
    print("rules file now:", read_rules(rules_path).strip())
    after = agent_eval.run(lambda rep_: make_agent(read_rules(rules_path)), eval_dir)
    print("sealed eval after:", after["totals"][0], "of", after["n"])
    r = asyncio.run(make_agent(read_rules(rules_path)).run([{"role": "user", "content": "How much was spent on meals in 2026-07?"}]))
    print("same question now:", r["answer"])
    print("tools used:", r["tools"])


if __name__ == "__main__":
    main()
