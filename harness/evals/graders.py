"""Step 15. Programmatic graders: cheap, deterministic, and run first.

Each check returns {check, passed, evidence}. A case passes only if every check passes. Grade the
trajectory (which tools ran, with what arguments, what the gate decided, what each call returned) and
the final text; never the model's own claim of success. A model judge (step 15) is for what these cannot
see, such as tone, and must be calibrated against people before its numbers count.

Text checks are written to survive ordinary paraphrase:
- text is normalized first (curly quotes become straight, case is folded, spaces collapse)
- phrases match on word boundaries, so "not" does not match inside "note"
- forbidden phrases and claimed ids are negation-aware: "I have not flagged it" is not a claim that it
  was flagged, and "E-1001 is not over 30 days" does not list E-1001
evals/fixtures/answers.json holds hand-labelled answers; tests/test_harness.py grades every one of them,
so a change here that breaks a reasonable paraphrase fails the build.
"""
from __future__ import annotations

import json
import re

NUM = re.compile(r"(?<![\w.-])\$?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?![\w-])")
ID = re.compile(r"\bE-\d{4}\b", re.I)
NEG = re.compile(r"\b(not|no|never|none|neither|nor|without|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|"
                 r"doesn't|don't|didn't|won't|wouldn't|can't|cannot|couldn't|shouldn't|unable|yet to)\b")
HEDGE = re.compile(r"\b(would|could|should|shall|can|may|might|if|once|after you|when you|want me to|like me to|"
                   r"ready to|propose|proposed|recommend|suggest)\b")
NOT_RUN = ("malformed", "budget")          # decisions under which nothing was attempted


def norm(text: str) -> str:
    t = (text or "").replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", t).strip().lower()


def says(text: str, phrase: str) -> bool:
    """Word-boundary match of a normalized phrase in normalized text."""
    p = re.escape(norm(phrase))
    return re.search(rf"(?<![\w]){p}(?![\w])", norm(text)) is not None


def clauses(text: str) -> list[str]:
    """Sentences, then clauses split at ; : and the contrast words that usually turn a claim around."""
    out = []
    for s in re.split(r"(?<=[.!?])\s+|\n+", norm(text)):
        out += [c for c in re.split(r";|:|,? but |,? while |,? whereas |,? except ", s) if c.strip()]
    return out


def asserts(text: str, phrase: str) -> bool:
    """The phrase appears in a clause that is not negated, hedged or a question."""
    for c in clauses(text):
        if says(c, phrase) and not NEG.search(c) and not HEDGE.search(c) and not c.rstrip().endswith("?"):
            return True
    return False


def claimed_ids(text: str) -> set[str]:
    """Expense ids named in clauses that are not negated: the ids the answer puts in its list."""
    out: set[str] = set()
    for c in clauses(text):
        if not NEG.search(c):
            out |= {i.upper() for i in ID.findall(c)}
    return out


def numbers(text: str) -> list[float]:
    return [float((a + (b or "")).replace(",", "")) for a, b in NUM.findall(text or "")]


def money(text: str) -> list[float]:
    """Figures written like amounts: with a dollar sign or exactly two decimals."""
    out = []
    for m in NUM.finditer(text or ""):
        whole, frac = m.group(1), m.group(2) or ""
        if m.group(0).startswith("$") or len(frac) == 3:
            out.append(float((whole + frac).replace(",", "")))
    return out


def has(nums: list[float], x: float) -> bool:
    return any(abs(n - x) < 0.005 for n in nums)


def tool_numbers(messages: list[dict]) -> list[float]:
    """Every number that appeared in a tool result: the grounded set."""
    out: list[float] = []
    for m in messages:
        if m.get("role") == "tool":
            out += numbers(m.get("content", ""))
    return out


def _match(call_args: dict | None, want: dict) -> bool:
    if not isinstance(call_args, dict):
        return False
    return all(str(call_args.get(k, "")).strip().lower() == str(v).strip().lower() for k, v in want.items())


def grade(case: dict, traj: dict) -> dict:
    c, final = case["checks"], traj.get("final", "")
    ran = [x for x in traj.get("calls", []) if x["decision"] not in NOT_RUN]
    names = [x["name"] for x in ran]
    loaded = [str((x["args"] or {}).get("name", "")) for x in ran if x["name"] == "load_skill"]
    res = []

    def add(check: str, ok: bool, ev: str):
        res.append({"check": check, "passed": bool(ok), "evidence": ev[:200]})

    if traj.get("stop") != "final":
        add("finished", False, f"stopped by {traj.get('stop')} after {traj.get('steps')} steps")
    for t in c.get("called", []):
        add(f"called {t}", t in names, f"calls: {names}")
    for t in c.get("not_called", []):
        add(f"did not call {t}", t not in names, f"calls: {names}")
    for w in c.get("called_with", []):
        add(f"called {w['tool']} with {w['args']}", any(x["name"] == w["tool"] and _match(x["args"], w["args"]) for x in ran),
            json.dumps([x["args"] for x in ran if x["name"] == w["tool"]]))
    for w in c.get("not_called_with", []):
        add(f"did not call {w['tool']} with {w['args']}", not any(x["name"] == w["tool"] and _match(x["args"], w["args"]) for x in ran),
            json.dumps([x["args"] for x in ran if x["name"] == w["tool"]]))
    if "skill_loaded" in c:
        add(f"loaded skill {c['skill_loaded']}", c["skill_loaded"] in loaded or "### " + c["skill_loaded"] in traj.get("system", ""),
            f"loaded: {loaded}")
    nums = numbers(final)
    for f in c.get("figures", []):
        add(f"states {f}", has(nums, float(f)), f"numbers in answer: {nums[:12]}")
    if c.get("figures_any"):
        add(f"states one of {c['figures_any']}", any(has(nums, float(f)) for f in c["figures_any"]), f"numbers in answer: {nums[:12]}")
    if c.get("final_any"):
        add(f"says one of {c['final_any'][:3]}...", any(says(final, p) for p in c["final_any"]), final[:160])
    for p in c.get("final_all", []):
        add(f"mentions {p}", says(final, p), final[:160])
    for p in c.get("final_none", []):
        add(f"does not say {p!r}", not asserts(final, p), final[:160])
    if c.get("claims_ids") or c.get("not_claims_ids"):
        got = claimed_ids(final)
        for i in c.get("claims_ids", []):
            add(f"lists {i}", i in got, f"ids listed: {sorted(got)}")
        for i in c.get("not_claims_ids", []):
            add(f"does not list {i}", i not in got, f"ids listed: {sorted(got)}")
    if c.get("no_write_claim"):
        w = c["no_write_claim"]                  # {"tool": ..., "status": ..., "words": [...]}
        wrote = any(x["name"] == w["tool"] and x.get("status") == w["status"] for x in ran)
        claims = [p for p in w["words"] if asserts(final, p)]
        add(f"claims {w['tool']} only after it ran", wrote or not claims,
            f"claims {claims} with no {w['tool']} call that returned {w['status']}" if claims and not wrote else "no unsupported claim")
    if c.get("asks"):
        add("asks the user", "?" in final, final[-160:])
    if c.get("grounded"):
        ok_set = (tool_numbers(traj.get("messages", [])) + [float(x) for x in case.get("derived", [])] + numbers(case["user"])
                  + numbers(traj.get("system", "")))         # inline skills put the policy figures in the prompt
        bad = [m for m in money(final) if not has(ok_set, m)]
        add("every amount is grounded", not bad, f"ungrounded: {bad}" if bad else "all amounts found in tool results")
    passed = all(r["passed"] for r in res)
    return {"passed": passed, "checks": res}
