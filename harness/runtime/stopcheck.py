"""Step 12. Decide what a final message is before accepting it: an answer, a question, or a promise.

A turn that ends on "I'll check that next" or "Let me look into it" stops all work while reading as
progress. The corpus harnesses handle this in two ways: a self-check on the last paragraph (if it is a
plan or a promise, do the work now) and a side-car judge that asks whether every deliverable is present.
This is the cheap deterministic version. loop.run(..., stopcheck=True) uses it to send one nudge back,
once, and then accepts whatever comes.

What is not a promise: a question anywhere in the last paragraph (the model is waiting on the user,
which is correct when it needs an approval or a missing fact), an offer that depends on the user
("let me know if...", "if you want, I can..."), and a conditional ("I would flag it once you approve").
The nudge sends the model back to the work it may do without asking, and tells it to ask for anything
that needs the user, so a nudge never pushes it into a write that needs approval.
"""
from __future__ import annotations

import re

PROMISE = re.compile(r"\b(i'll|i will|let me|i'm going to|i am going to|next,? i|i can (now )?(check|look|fetch)|"
                     r"stand by|one moment|working on it)\b", re.I)
OFFER = re.compile(r"\b(let me know|if you('d| would)? (like|want|prefer)|if needed|if that helps|if you approve|"
                   r"once you (approve|confirm)|when you (approve|confirm)|happy to)\b", re.I)
CONDITIONAL = re.compile(r"\b(would|could|if|once|unless)\b", re.I)
NUDGE = ("Your last message says you will do something you have not done yet. If it needs only tools you may use "
         "without approval, do it now and then give the answer. If it needs the user's approval or a fact only "
         "the user has, ask for that one thing instead.")


def last_paragraph(text: str) -> str:
    parts = [p for p in re.split(r"\n\s*\n", (text or "").strip()) if p.strip()]
    return parts[-1] if parts else ""


def classify(final: str) -> str:
    """answer | question | promise | empty"""
    tail = last_paragraph((final or "").replace("’", "'"))
    if not tail:
        return "empty"
    if "?" in tail:
        return "question"
    promises = [s for s in re.split(r"(?<=[.!])\s+", tail) if PROMISE.search(s)]
    if any(not OFFER.search(s) and not CONDITIONAL.search(s) for s in promises):
        return "promise"
    return "answer"
