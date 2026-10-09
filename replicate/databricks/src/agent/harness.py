"""The harness rules that do not depend on any SDK. Pure Python, tested by tests/test_portable.py.

  triage       answer greetings and chit-chat without tools or the big model (module 7)
  match_skill  pick at most one skill for a request, or none (module 8)
  compose      base prompt + briefing + skill, in a fixed order with fixed headings (module 7)
  guarded      the guard loop: check, one corrective retry with the majority rule, then fallback (module 10)
"""
from __future__ import annotations

import re
from typing import Awaitable, Callable, Optional

SMALL_TALK = re.compile(r"^\s*(hi|hello|hey|thanks|thank you|good (morning|afternoon|evening)|ok|okay)( there| all)?\b[\s!.?]*$", re.I)


def triage(text: str) -> str:
    """'chat' for small talk, 'work' for everything else. Cheap, and wrong only in the safe direction."""
    return "chat" if SMALL_TALK.match(text or "") else "work"


def match_skill(text: str, skills: dict, floor: int = 2) -> Optional[str]:
    """skills: name -> list of trigger words. The skill with the most distinct hits wins, if it reaches the floor.
    A request that matches nothing gets no skill: a wrong skill is worse than none."""
    words = set(re.findall(r"[a-z0-9\-]+", (text or "").lower()))
    best, score = None, 0
    for name, triggers in sorted(skills.items()):
        hits = len(words & {t.lower() for t in triggers})
        if hits > score:
            best, score = name, hits
    return best if score >= floor else None


def compose(base: str, briefing: str = "", skill_text: str = "") -> str:
    parts = [base.strip()]
    if briefing.strip():
        parts.append("## What you know about this user\n" + briefing.strip())
    if skill_text.strip():
        parts.append("## Skill for this request\n" + skill_text.strip())
    return "\n\n".join(parts)


async def guarded(run: Callable[[list], Awaitable[tuple]], messages: list, check: Callable, fallback: str) -> dict:
    """run(messages) -> (answer, tool_messages). check(answer, evidence, strict) -> {"ok", "corrective", ...}.

    1. run once, check strictly
    2. if it fails, run again with the corrective note, check with the majority rule
    3. if it still fails, return the fallback text, never the unsupported draft
    """
    answer, tools = await run(messages)
    verdict = check(answer, messages + tools, True)
    if verdict["ok"]:
        return {"answer": answer, "attempts": 1, "guard": "pass"}
    retry_msgs = messages + [{"role": "user", "content": "[harness] " + verdict["corrective"]}]
    answer2, tools2 = await run(retry_msgs)
    verdict2 = check(answer2, messages + tools + tools2, False)
    if verdict2["ok"]:
        return {"answer": answer2, "attempts": 2, "guard": "pass after retry"}
    return {"answer": fallback, "attempts": 2, "guard": "fallback", "unsupported": verdict2.get("unsupported")}
