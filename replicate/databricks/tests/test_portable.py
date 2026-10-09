"""Tests for the parts of the replication that do not need a Databricks workspace.

They run in this repository (python3 replicate/databricks/check.py) and on any laptop:
ranking, chunking and validation, graph edges, the answer guard, the harness rules,
the scorers and the seal digest, the tool contract, the learner's proof rule.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import unittest

SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src")
sys.path.insert(0, SRC)

from agent.harness import compose, guarded, match_skill, triage  # noqa: E402
from evals.scorers import figures_grounded, must_contain, seal_digest, to_records, used_tool  # noqa: E402
from graph.edges import build_edges  # noqa: E402
from guard.answer_guard import FALLBACK, check  # noqa: E402
from knowledge.chunking import chunk_markdown, tier, validate  # noqa: E402
from learner.nightly import findings_from_tool_call  # noqa: E402
from models.router import lineup  # noqa: E402
from common.config import Config  # noqa: E402
from retrieval.ranking import diagnose, rank, rrf  # noqa: E402
from skills.register_prompts import to_double_brace  # noqa: E402
from tools.uc_tools import contract_ok  # noqa: E402


class Ranking(unittest.TestCase):
    def rows(self):
        return {
            "a": {"chunk_id": "a", "source": "notes/a.md", "text": "Lodging cap is 220 per night.", "tier": 3},
            "b": {"chunk_id": "b", "source": "policy/p.md", "text": "Lodging cap is 220 per night.", "tier": 1},
            "c": {"chunk_id": "c", "source": "policy/p.md", "text": "Meals are capped at 75.", "tier": 1},
        }

    def test_rrf_uses_positions_only(self):
        s = rrf([["a", "b"], ["b"]])
        self.assertAlmostEqual(s["b"], 1 / 62 + 1 / 61)
        self.assertGreater(s["b"], s["a"])

    def test_dedup_shows_most_authoritative_copy(self):
        hits = rank(self.rows(), ["a", "c", "b"], [])
        same = [h for h in hits if "220" in h["text"]]
        self.assertEqual(len(same), 1)                              # one paragraph, shown once
        self.assertEqual(same[0]["chunk_id"], "b")                  # from the tier 1 source, not the notes copy

    def test_authority_breaks_near_tie_only(self):
        rows = self.rows()
        rows["b"]["text"] = "different text"
        hits = rank(rows, ["a", "b"], [], dedup=False)
        self.assertEqual(hits[0]["chunk_id"], "b")                  # 1/61 vs 1/62 + 2*0.0004
        far = rank(rows, ["a", "x1", "x2", "x3", "b"], [], dedup=False)
        self.assertEqual(far[0]["chunk_id"], "a")                   # bonus does not jump several ranks

    def test_flags_off(self):
        hits = rank(self.rows(), ["a", "b"], [], authority=False, dedup=False)
        self.assertEqual(hits[0]["chunk_id"], "a")

    def test_empty_has_diagnostic(self):
        self.assertIn("known collections", diagnose([], "hr", ["policy"]))
        self.assertIn("different terms", diagnose([], "policy", ["policy"]))
        self.assertIsNone(diagnose([{"x": 1}], "policy", ["policy"]))


class Knowledge(unittest.TestCase):
    def test_validate(self):
        self.assertEqual(validate("x.pdf", b"PK\x03\x04..."), (False, "not a real .pdf file"))
        self.assertEqual(validate("x.md", b""), (False, "empty file"))
        self.assertTrue(validate("x.md", "# T\n\nhello".encode())[0])
        self.assertFalse(validate("x.exe", b"MZ")[0])

    def test_tier_first_match(self):
        rules = [{"pattern": "policy/*", "tier": 1}, {"pattern": "*", "tier": 2}]
        self.assertEqual(tier("policy/travel.md", rules), 1)
        self.assertEqual(tier("notes/x.md", rules), 2)
        self.assertEqual(tier("notes/x.md", []), 3)

    def test_chunks_keep_heading_path(self):
        md = "# Travel\n\n## Section 5 Lodging\n\nCap is 220.\n\n## Section 6 Meals\n\nSee Section 5 for lodging."
        ch = chunk_markdown("policy/travel.md", md)
        self.assertEqual([c["context"] for c in ch], ["Travel > Section 5 Lodging", "Travel > Section 6 Meals"])
        self.assertEqual(ch[0]["chunk_id"], "policy/travel.md::0")
        edges = build_edges(ch)
        rel = {(e["relation"], e["from_key"], e["to_chunk"]) for e in edges}
        self.assertIn(("section", "policy/travel.md#5", "policy/travel.md::0"), rel)
        self.assertIn(("cites", "policy/travel.md::1", "policy/travel.md#5"), rel)

    def test_defines_edge(self):
        ch = [{"chunk_id": "g::0", "source": "g", "context": "", "text": "Approving official means the manager who signs."}]
        self.assertIn(("defines", "approving official", "g::0"),
                      {(e["relation"], e["from_key"], e["to_chunk"]) for e in build_edges(ch)})


class Guard(unittest.TestCase):
    msgs = [{"role": "user", "content": "meals in July?"}, {"role": "tool", "content": '{"rows": [[1, 200.0], [2, 158.6]]}'}]

    def test_grounded_sum(self):
        self.assertTrue(check("You spent $358.60.", self.msgs)["ok"])

    def test_invented_figure(self):
        v = check("You spent $312.40.", self.msgs)
        self.assertFalse(v["ok"])
        self.assertIn("312.40", v["corrective"])

    def test_assistant_words_are_not_evidence(self):
        msgs = [{"role": "assistant", "content": "It was $999."}]
        self.assertFalse(check("It was $999.", msgs)["ok"])


class Harness(unittest.TestCase):
    def test_triage(self):
        self.assertEqual(triage("hi there!"), "chat")
        self.assertEqual(triage("hi, what is the lodging cap?"), "work")

    def test_skill_floor(self):
        skills = {"skill_expense": ["expense", "claim", "total"], "skill_policy": ["policy", "cap", "limit"]}
        self.assertEqual(match_skill("total of my expense claim", skills), "skill_expense")
        self.assertIsNone(match_skill("hello there", skills))
        self.assertIsNone(match_skill("the cap", skills))           # one hit is below the floor

    def test_compose_order(self):
        p = compose("BASE", "- name: Dana", "SKILL")
        self.assertLess(p.index("BASE"), p.index("Dana"))
        self.assertLess(p.index("Dana"), p.index("SKILL"))
        self.assertEqual(compose("BASE"), "BASE")

    def run_guarded(self, drafts):
        it = iter(drafts)

        async def run(_msgs):
            return next(it), [{"role": "tool", "content": "total 358.60"}]
        return asyncio.run(guarded(run, [{"role": "user", "content": "meals?"}], check, FALLBACK))

    def test_guard_loop(self):
        self.assertEqual(self.run_guarded(["$358.60"])["guard"], "pass")
        self.assertEqual(self.run_guarded(["$312.40", "$358.60"])["guard"], "pass after retry")
        out = self.run_guarded(["$312.40", "$999.00"])
        self.assertEqual(out["guard"], "fallback")
        self.assertEqual(out["answer"], FALLBACK)                    # the unsupported draft never ships

    def test_lineup_no_repeats(self):
        os.environ.pop("AGENT_CHAT_FAST", None)
        lu = lineup("fast", Config())
        self.assertEqual(lu[0], Config().chat_fast)
        self.assertEqual(len(lu), len(set(lu)))


class Evals(unittest.TestCase):
    def test_scorers(self):
        self.assertTrue(must_contain("The cap is 220 per night", ["220"]))
        self.assertFalse(must_contain("The cap is high", ["220"]))
        self.assertTrue(used_tool(["search_kb"], None))
        self.assertFalse(used_tool(["search_kb"], "query_expenses"))
        self.assertTrue(figures_grounded("$358.60", ["358.60"]))

    def test_seal_digest_detects_one_changed_row(self):
        recs = to_records({"items": [{"q": "a", "must_contain": ["1"]}, {"q": "b", "must_contain": ["2"]}]})
        d = seal_digest(recs)
        self.assertEqual(d, seal_digest(list(reversed(recs))))       # order does not matter
        recs[1]["expectations"]["must_contain"] = ["3"]
        self.assertNotEqual(d, seal_digest(recs))


class Tools(unittest.TestCase):
    def test_contract(self):
        self.assertTrue(contract_ok('{"count": 2, "total": 10.0, "rows": []}', True)[0])
        self.assertTrue(contract_ok('{"count": 0, "diagnostic": "month filter emptied"}', False)[0])
        self.assertFalse(contract_ok('{"count": 0}', False)[0])
        self.assertFalse(contract_ok("oops", False)[0])

    def test_prompt_braces(self):
        self.assertEqual(to_double_brace("Hi {name}, {{kept}} {\"json\": 1}"), "Hi {{name}}, {{kept}} {\"json\": 1}")

    def test_learner_proves_by_rerun(self):
        def rerun(name, args):
            return json.dumps({"count": 4 if "claim_month" not in args else 0})
        f = findings_from_tool_call("query_expenses", {"employee_id": "E-1", "claim_month": "1999-01"},
                                    '{"count": 0}', rerun)
        self.assertEqual(f[0]["key"], "query_expenses.relax_claim_month")
        self.assertEqual(findings_from_tool_call("query_expenses", {"employee_id": "E-1"}, '{"count": 3}', rerun), [])
        # the identity argument is never relaxed, even when dropping it would return rows
        def rerun_any(name, args):
            return json.dumps({"count": 9})
        self.assertEqual(findings_from_tool_call("query_expenses", {"employee_id": "E-404"}, '{"count": 0}', rerun_any), [])
        # span inputs can arrive as a JSON string
        f2 = findings_from_tool_call("query_expenses", '{"employee_id": "E-1", "claim_month": "1999-01"}', '{"count": 0}', rerun)
        self.assertEqual(f2[0]["key"], "query_expenses.relax_claim_month")


if __name__ == "__main__":
    unittest.main(verbosity=2)
