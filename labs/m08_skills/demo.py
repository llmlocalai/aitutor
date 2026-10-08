"""python3 -m labs.m08_skills.demo"""
from __future__ import annotations

import asyncio

from labs.common.scripts import desk_policy
from labs.m05_rag.demo import build
from labs.m06_tools.tools import build_registry
from labs.m07_harness.loop import Agent
from labs.m08_skills.loader import Router, load_skills


def main():
    skills = load_skills()
    print("1 loaded:", {k: v["description"][:48] + "..." for k, v in skills.items()})
    router = Router(skills)
    for q in ["What is the cap on a hotel room per night?", "How much did Rivera spend on air travel?",
              "hi there", "Can you total lodging for Boston in 2026-06?"]:
        m = router.match(q)
        s = {k: round(v, 2) for k, v in router.scores(q).items()}
        print(f"2 {q:46s} -> {m['name'] if m else 'no skill':22s} {s}")

    db, _ = build()
    agent = Agent(build_registry(db), policy=desk_policy, skills=router.match)
    prompt, name = agent.compose_system_prompt("How much did Rivera spend on air travel?", "anon")
    print("3 prompt with skill:", name, "|", len(prompt), "chars | last line:", prompt.splitlines()[-1])
    prompt, name = agent.compose_system_prompt("hi there", "anon")
    print("4 prompt without   :", name, "|", len(prompt), "chars")
    r = asyncio.run(agent.run([{"role": "user", "content": "What is the nightly lodging cap?"}]))
    print("5 run:", r["skill"], "->", r["answer"][:80], "...")


if __name__ == "__main__":
    main()
