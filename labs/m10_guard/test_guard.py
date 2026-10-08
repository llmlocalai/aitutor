"""Regression tests for the answer guard. One must-catch and one must-allow case per rule.

    python3 -m unittest labs.m10_guard.test_guard -v
"""
from __future__ import annotations

import os
import unittest

from labs.m10_guard.guard import check, review

EV = [{"role": "user", "content": "Did Chen exceed the cap?"},
      {"role": "tool", "content": '{"rows": [{"amount_usd": 219.0}, {"amount_usd": 236.0}], "total_usd": 455.0, "cap": 220}'}]


class Grounding(unittest.TestCase):
    def test_catch_invented_figure(self):
        self.assertFalse(check("Chen paid 312.40 dollars.", EV)["ok"])

    def test_allow_figure_from_tool(self):
        self.assertTrue(check("Chen paid 219.00 dollars, under the 220 dollar cap.", EV)["ok"])

    def test_allow_sum_and_difference(self):
        self.assertTrue(check("The stays total $455.00 and differ by $17.00.", EV)["ok"])


class RetryRule(unittest.TestCase):
    def test_catch_one_wrong_figure_on_first_draft(self):
        self.assertFalse(check("$219.00, $236.00 and $999.00.", EV, strict=True)["ok"])

    def test_allow_one_stubborn_figure_on_retry(self):
        self.assertTrue(check("$219.00, $236.00 and $999.00.", EV, strict=False)["ok"])


class Exemptions(unittest.TestCase):
    def test_allow_requested_example(self):
        msgs = [{"role": "user", "content": "Give me a made-up example with numbers."}] + EV[1:]
        self.assertTrue(review(msgs, "Say a trip costs 3,100 dollars.", "policy-citation")["ok"])

    def test_catch_same_text_when_no_example_was_asked(self):
        self.assertFalse(review(EV, "Say a trip costs 3,100 dollars.", "policy-citation")["ok"])

    def test_allow_general_talk_without_tools(self):
        self.assertTrue(review([{"role": "user", "content": "hi"}], "A typical cap might be $200.", None)["ok"])

    def test_catch_data_turn_without_tools(self):
        msgs = [{"role": "user", "content": "Who spent the most?"}]
        self.assertFalse(review(msgs, "Chen spent $4,410.00.", "expense-investigation")["ok"])


class Modes(unittest.TestCase):
    def tearDown(self):
        os.environ.pop("GUARD_MODE", None)

    def test_observe_records_but_does_not_block(self):
        os.environ["GUARD_MODE"] = "observe"
        v = review(EV, "Chen paid 312.40 dollars.", "expense-investigation")
        self.assertTrue(v["ok"])
        self.assertTrue(v["would_block"])

    def test_enforce_blocks(self):
        os.environ["GUARD_MODE"] = "enforce"
        self.assertFalse(review(EV, "Chen paid 312.40 dollars.", "expense-investigation")["ok"])


if __name__ == "__main__":
    unittest.main()
