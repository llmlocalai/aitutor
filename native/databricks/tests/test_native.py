"""Tests for every part of the native kit that runs without a workspace.

Run: python3 -m pytest -q native/databricks/tests   (CI runs the same in unit_tests)
or:  python3 native/databricks/check.py              (also compiles and parses every file)
"""
from __future__ import annotations

import copy
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))
sys.path.insert(0, os.path.join(ROOT, "app"))

from agent.batch_triage import backoff, changed_after_decision, select_new, summarize as batch_summary  # noqa: E402
from agent.policy import ALLOWED, Proposal, needs_second_approver, review  # noqa: E402
from common.apply_sql import for_catalog, split_statements  # noqa: E402
from common.render_env import merge_env  # noqa: E402
from evals.gate import worst_of  # noqa: E402
from evals.verify_gate import check as verify_gate  # noqa: E402
from common import contract  # noqa: E402
from evals.classifier_check import confidence_cut, gate as class_gate, per_class  # noqa: E402
from evals.gate import check as gate_check, spread_of  # noqa: E402
from evals.scorers import safe_direction, summarize  # noqa: E402
from genie.benchmark import same_result, score  # noqa: E402
from knowledge.policy_index import chunk_elements  # noqa: E402
from review.export_decisions import label  # noqa: E402
from review_logic import decide, row_html, same_origin  # noqa: E402
from scale.load_test import knee, percentile, step_stats  # noqa: E402

ACTIONS = ["approve_payment", "hold_payment", "request_credit_memo", "escalate"]


class Contract(unittest.TestCase):
    def test_shipped_contract_is_valid(self):
        self.assertEqual(contract.problems(contract.load()), [])

    def test_catches_contradictions(self):
        c = contract.load()
        bad = copy.deepcopy(c)
        bad["writes"]["allowed"].append("erp")
        bad["writes"]["forbidden"].append("erp")
        bad["success_metrics"]["grounded_figures_min"] = 0.9
        bad["data"]["catalog_per_env"]["prd"] = "fin_stg"
        p = " | ".join(contract.problems(bad))
        self.assertIn("both allowed and forbidden", p)
        self.assertIn("invented numbers", p)
        self.assertIn("its own catalog", p)
        self.assertIn("only to review_queue", p)

    def test_level_three_needs_limit(self):
        c = contract.load()
        c["autonomy_level"] = 3
        self.assertTrue(any("act_limit" in x for x in contract.problems(c)))


class Policy(unittest.TestCase):
    ev = ['{"invoice_amount": 10250.00, "po_amount": 10000.00, "variance": 250.00}', "policy chunk P-4.2"]

    def test_good_proposal(self):
        p = Proposal("x", "price_variance", "approve_payment",
                     "Invoice is $10,250.00 against a PO of $10,000.00, a $250.00 variance within the tolerance in P-4.2.",
                     ["policy.md::12"], 0.82)
        self.assertEqual(review(p, self.ev, ACTIONS), [])

    def test_invented_figure_and_missing_citation(self):
        p = Proposal("x", "price_variance", "approve_payment", "The variance of $312.40 is acceptable under policy.", [], 0.9)
        r = " | ".join(review(p, self.ev, ACTIONS))
        self.assertIn("312.40", r)
        self.assertIn("needs a policy citation", r)

    def test_action_not_allowed_for_type(self):
        p = Proposal("x", "duplicate_suspect", "approve_payment", "Looks fine to me, approve the payment now please.", ["c"], 0.9)
        self.assertTrue(any("not allowed for duplicate_suspect" in x for x in review(p, self.ev, ACTIONS)))

    def test_low_confidence_must_escalate(self):
        p = Proposal("x", "no_receipt", "hold_payment", "No receipt exists for this purchase order yet.", [], 0.4)
        self.assertTrue(any("escalate instead" in x for x in review(p, self.ev, ACTIONS)))
        p.action = "escalate"
        self.assertEqual(review(p, self.ev, ACTIONS), [])

    def test_every_type_can_escalate(self):
        self.assertTrue(all("escalate" in v for v in ALLOWED.values()))

    def test_two_person_rule_is_strictly_above(self):
        self.assertFalse(needs_second_approver(25000, 25000))       # contract: second_approver_above
        self.assertTrue(needs_second_approver(25000.01, 25000))

    def test_no_po_type_is_conservative(self):
        self.assertEqual(ALLOWED["no_po"], {"hold_payment", "escalate"})

    def test_thresholds_agree_everywhere(self):
        """The contract, the reviewer app's source of truth, and the database trigger use one number."""
        t = contract.load()["human_in_the_loop"]["second_approver_above"]
        with open(os.path.join(ROOT, "src", "review", "review_queue.sql")) as f:
            sql = f.read()
        self.assertIn(f"> {t}", sql)
        self.assertIn(f"<= {t}", sql)
        self.assertEqual(sorted(contract.load()["actions"]), sorted({a for v in ALLOWED.values() for a in v}))


class ReviewApp(unittest.TestCase):
    def test_origin_check_behind_proxy(self):
        pub = "spend-exceptions-review-123.example.databricksapps.com"
        self.assertTrue(same_origin(f"https://{pub}", None, pub, None))
        self.assertTrue(same_origin(f"https://{pub}", None, "10.0.0.5:8000", pub))      # Host is internal
        self.assertTrue(same_origin(None, f"https://{pub}/", "internal", None, pub))   # APP_HOSTS
        self.assertFalse(same_origin("https://evil.example", None, pub, pub))
        self.assertFalse(same_origin(None, None, pub, pub))                             # no Origin, no Referer

    p = {"proposal_id": "p1", "business_unit": "BU-7", "invoice_amount": 30000, "status": "pending", "action": "hold_payment"}

    def test_exactly_the_threshold_needs_one_approver(self):
        self.assertEqual(decide({**self.p, "invoice_amount": 25000}, "ann", "approve", {"BU-7"}, [], 25000), ("approved", "approve"))

    def test_scope_enforced(self):
        with self.assertRaises(PermissionError):
            decide(self.p, "ann", "approve", {"BU-1"}, [], 25000)

    def test_two_person_flow(self):
        self.assertEqual(decide(self.p, "ann", "approve", {"BU-7"}, [], 25000), ("needs_second", "approve"))
        second = {**self.p, "status": "needs_second"}
        with self.assertRaises(PermissionError):
            decide(second, "ann", "approve", {"BU-7"}, ["ann"], 25000)      # same person twice
        self.assertEqual(decide(second, "bob", "approve", {"BU-7"}, ["ann"], 25000), ("approved", "second_approve"))

    def test_small_amount_single_approval(self):
        small = {**self.p, "invoice_amount": 900}
        self.assertEqual(decide(small, "ann", "approve", {"BU-7"}, [], 25000), ("approved", "approve"))

    def test_rejection_needs_the_right_answer(self):
        with self.assertRaises(ValueError):
            decide(self.p, "ann", "reject", {"BU-7"}, [], 25000)
        with self.assertRaises(ValueError):
            decide(self.p, "ann", "reject", {"BU-7"}, [], 25000, "hold_payment")   # same as proposed
        self.assertEqual(decide(self.p, "ann", "reject", {"BU-7"}, [], 25000, "escalate"), ("rejected", "reject"))

    def test_closed_proposal(self):
        with self.assertRaises(ValueError):
            decide({**self.p, "status": "approved"}, "ann", "approve", {"BU-7"}, [], 25000)

    def test_model_text_is_escaped(self):
        row = row_html({**self.p, "exception_type": "price_variance", "rationale": "<script>alert(1)</script>",
                        "citations": ["<b>x</b>"], "confidence": 0.7})
        self.assertNotIn("<script>", row)
        self.assertIn("&lt;script&gt;", row)

    def test_label_only_when_final(self):
        self.assertEqual(label("hold_payment", "approve", None, "approved"), "hold_payment")
        self.assertIsNone(label("hold_payment", "approve", None, "needs_second"))   # first of two approvals
        self.assertEqual(label("approve_payment", "reject", "escalate", "rejected"), "escalate")
        self.assertIsNone(label("hold_payment", "unknown", None, "approved"))


class Evals(unittest.TestCase):
    metrics = contract.load()["success_metrics"]

    def good(self, **kw):
        base = {"n": 400, "action_accuracy": 0.9, "unsafe_errors": 0, "grounded_figures": 1.0, "policy_cited": 0.97,
                "first_try_admissible": 0.9, "p95_latency_s": 20.0, "cost_per_exception_usd": 0.1}
        return {**base, **kw}

    def test_gate_passes(self):
        self.assertEqual(gate_check(self.good(), self.good(), self.metrics), [])

    def test_gate_blocks(self):
        r = " | ".join(gate_check(self.good(n=50, unsafe_errors=1, grounded_figures=0.99), None, self.metrics))
        self.assertIn("200", r)
        self.assertIn("unsafe", r)
        self.assertIn("grounded_figures", r)

    def test_regression_beyond_spread_only(self):
        base = self.good(action_accuracy=0.92)
        self.assertEqual(gate_check(self.good(action_accuracy=0.90), base, self.metrics, {"action_accuracy": 0.03}), [])
        self.assertTrue(gate_check(self.good(action_accuracy=0.88), base, self.metrics, {"action_accuracy": 0.03}))

    def test_baseline_list_is_reduced(self):
        runs = [self.good(action_accuracy=0.91), self.good(action_accuracy=0.88, p95_latency_s=24.0)]
        w = worst_of(runs)
        self.assertEqual((w["action_accuracy"], w["p95_latency_s"], w["n"]), (0.88, 24.0, 400))
        # a list baseline must actually be compared (it used to be silently ignored)
        self.assertTrue(gate_check(self.good(action_accuracy=0.80), worst_of(runs), self.metrics))

    def test_release_verifies_the_exact_commit(self):
        ok = {"sha": "abc123", "passed": True, "reasons": []}
        self.assertEqual(verify_gate(ok, "abc123"), [])
        self.assertTrue(verify_gate(ok, "def456"))                      # a newer, ungated commit
        self.assertTrue(verify_gate({**ok, "passed": False, "reasons": ["x"]}, "abc123"))

    def test_spread(self):
        s = spread_of([{"a": 0.9, "n": 400}, {"a": 0.86, "n": 400}, {"a": 0.88, "n": 400}])
        self.assertAlmostEqual(s["a"], 0.04)

    def test_summary_and_safe_direction(self):
        rows = [{"predicted": "approve_payment", "expected": "hold_payment", "rationale": "", "evidence": []},
                {"predicted": "escalate", "expected": "hold_payment", "rationale": "", "evidence": []},
                {"predicted": "hold_payment", "expected": "hold_payment", "rationale": "$5.00", "evidence": ["5.00"]}]
        s = summarize(rows)
        self.assertEqual(s["unsafe_errors"], 1)                 # only paying wrongly counts as unsafe
        self.assertAlmostEqual(s["action_accuracy"], 0.333)
        self.assertTrue(safe_direction("escalate", "approve_payment"))

    def test_classifier_per_class_gate(self):
        rows = ([{"predicted": "software", "label": "software", "confidence": 0.9}] * 40
                + [{"predicted": "software", "label": "travel", "confidence": 0.55}] * 10
                + [{"predicted": "travel", "label": "travel", "confidence": 0.95}] * 25)
        st = per_class(rows)
        self.assertAlmostEqual(st["software"]["precision"], 0.8)
        reasons = " | ".join(class_gate(st))
        self.assertIn("software: precision", reasons)
        self.assertIn("travel: recall 0.714", reasons)        # the 10 travel invoices called software
        self.assertEqual(confidence_cut(rows, 0.95), 0.56)       # below 0.56, send to a person
        few = {"facilities": {"precision": 1.0, "recall": 1.0, "support": 4}}
        self.assertIn("only 4 labelled", class_gate(few)[0])     # perfect on 4 examples proves nothing


class Knowledge(unittest.TestCase):
    def test_chunks_carry_heading_path(self):
        els = [{"type": "title", "content": "Payment Policy"}, {"type": "section_header", "content": "4.2 Price variance"},
               {"type": "text", "content": "Variances up to 2% may be approved."}, {"type": "page_footer", "content": "p. 3"},
               {"type": "section_header", "content": "4.3 Duplicates"}, {"type": "text", "content": "Hold all suspected duplicates."}]
        ch = chunk_elements("policy.pdf", els)
        self.assertEqual([c["context"] for c in ch], ["Payment Policy > 4.2 Price variance", "Payment Policy > 4.3 Duplicates"])
        self.assertTrue(ch[0]["embed_text"].startswith("Payment Policy > 4.2"))
        self.assertNotIn("p. 3", " ".join(c["text"] for c in ch))

    def test_genie_result_compare(self):
        self.assertTrue(same_result([["BU-1", "1250.00"], ["BU-2", 3]], [["BU-2", "3"], ["BU-1", 1250]]))
        self.assertFalse(same_result([["BU-1", 1250]], [["BU-1", 1251]]))
        s = score([{"question": "a", "match": True}, {"question": "b", "match": False}])
        self.assertEqual((s["accuracy"], s["failed"]), (0.5, ["b"]))


class Deploy(unittest.TestCase):
    def test_split_statements(self):
        sql = """-- header
CREATE VIEW a AS SELECT 'x;y' AS s;
CREATE OR REPLACE VIEW m WITH METRICS LANGUAGE YAML AS $$
measures:
  - expr: "a;b"
$$;
-- only a comment;
SELECT `odd;name` FROM t;"""
        st = split_statements(sql)
        self.assertEqual(len(st), 3)
        self.assertIn("$$\nmeasures", st[1])
        self.assertTrue(st[2].startswith("-- only a comment;") or st[2].startswith("SELECT"))

    def test_catalog_substitution(self):
        self.assertEqual(for_catalog("SELECT * FROM fin_dev.gold.t JOIN fin_dev_x.y", "fin_prd"),
                         "SELECT * FROM fin_prd.gold.t JOIN fin_dev_x.y")
        with self.assertRaises(ValueError):
            for_catalog("x", "fin; DROP")

    def test_render_env(self):
        doc = {"command": ["x"], "env": [{"name": "AGENT_CATALOG", "value": "fin_dev"}, {"name": "KEEP", "value": "1"}]}
        out = merge_env(doc, ["AGENT_CATALOG=fin_prd", "DATABRICKS_WAREHOUSE_ID=@sql_warehouse"])
        env = {e["name"]: e for e in out["env"]}
        self.assertEqual(env["AGENT_CATALOG"]["value"], "fin_prd")
        self.assertEqual(env["DATABRICKS_WAREHOUSE_ID"]["valueFrom"], "sql_warehouse")
        self.assertEqual(env["KEEP"]["value"], "1")
        with self.assertRaises(ValueError):
            merge_env(doc, ["PGHOST=<stg-lakebase-host>"])              # an unset placeholder fails the deploy


class Scale(unittest.TestCase):
    def test_batch_selection_and_limit(self):
        rows = [("a", 10, "NA"), ("b", 20, "NA"), ("c", 30, "NA"), ("d", 40, "NA")]
        self.assertEqual(select_new(rows, {"b": (20, "pending")}, 2), ["a", "c"])      # b already has a live proposal
        self.assertEqual(select_new(rows, {}, 10, units={"EMEA"}), [])                  # agent cannot read NA: never sent

    def test_changed_invoice_is_triaged_again_only_while_pending(self):
        rows = [("a", 120.00, "NA"), ("b", 99.00, "NA")]
        live = {"a": (100.00, "pending"), "b": (90.00, "approved")}
        self.assertEqual(select_new(rows, live, 10), ["a"])             # pending on old facts: re-triage
        self.assertEqual(changed_after_decision(rows, live), ["b"])     # decided, then changed: a person looks
        self.assertEqual(select_new([("a", 100.0, "NA")], {"a": (100.00, "pending")}, 10), [])
        self.assertEqual(batch_summary([{"status": "queued"}, {"status": "queued"}, {"status": "error"}]),
                         {"total": 3, "queued": 2, "error": 1})

    def test_backoff_grows_and_caps(self):
        self.assertLessEqual(backoff(10), 30 * 1.25)
        self.assertGreater(backoff(3, jitter=0), backoff(1, jitter=0))

    def test_load_stats_and_knee(self):
        self.assertEqual(percentile([1, 2, 3, 4, 5], 0.5), 3)
        st = step_stats([1.0] * 95 + [9.0] * 5, 1, 10.0)
        self.assertEqual(st["requests"], 101)
        steps = [{"concurrency": 4, "p95_s": 12, "error_rate": 0}, {"concurrency": 8, "p95_s": 31, "error_rate": 0}]
        self.assertEqual(knee(steps, 30), 8)
        self.assertIsNone(knee(steps[:1], 30))

    def test_vendored_pg_matches(self):
        with open(os.path.join(ROOT, "app", "pg.py")) as a, open(os.path.join(ROOT, "src", "common", "pg.py")) as b:
            self.assertEqual(a.read().split("\n", 1)[1], b.read())


if __name__ == "__main__":
    unittest.main(verbosity=2)
