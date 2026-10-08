"""Two independent judges decide whether a stored claim is supported by its source.

A claim leaves service only when BOTH fail it. One judge alone is wrong often
enough to delete true statements.
"""
from __future__ import annotations

import re

from labs.common import llm

NUM = re.compile(r"\d[\d,]*(?:\.\d+)?")
STOP = {"the", "a", "an", "is", "are", "of", "for", "to", "in", "on", "and", "or", "per", "at", "be", "must", "any", "that"}


# region: judges
def judge_literal(claim: str, passage: str) -> dict:
    """Strict reader: every number and most content words of the claim must be in the passage."""
    nums = set(NUM.findall(claim))
    missing = [n for n in nums if n not in NUM.findall(passage)]
    words = {w for w in re.findall(r"[a-z]+", claim.lower()) if w not in STOP and len(w) > 2}
    have = set(re.findall(r"[a-z]+", passage.lower()))
    coverage = len(words & have) / max(len(words), 1)
    ok = not missing and coverage >= 0.7
    return {"judge": "literal", "supported": ok,
            "why": f"numbers missing: {missing}" if missing else f"word coverage {coverage:.2f}"}


def judge_semantic(claim: str, passage: str) -> dict:
    """Lenient reader: is the claim about the same thing, and are its numbers present?
    With a real model this judge is a prompt. Here it is embedding similarity."""
    sim = llm.cosine(llm.embed(claim), llm.embed(passage))
    nums_ok = all(n in NUM.findall(passage) for n in NUM.findall(claim))
    return {"judge": "semantic", "supported": sim >= 0.30 and nums_ok, "why": f"similarity {sim:.2f}, numbers present: {nums_ok}"}


def verify(claim: str, passage: str) -> dict:
    votes = [judge_literal(claim, passage), judge_semantic(claim, passage)]
    failed = sum(not v["supported"] for v in votes)
    verdict = "keep" if failed == 0 else "keep (one dissent, flag for review)" if failed == 1 else "remove: unsupported"
    return {"verdict": verdict, "votes": votes}
# endregion
