"""Runs src/review/review_queue.sql on a real, throwaway Postgres and attacks the payment control.

Lakebase is Postgres, so the trigger, the column grants and the append-only rule can be tested here
exactly as written. Skipped when no Postgres server binaries are installed. In a root-only container
set PG_RUN_AS to an ordinary user (Postgres refuses to run as root).
"""
from __future__ import annotations

import glob
import os
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SQL = os.path.join(ROOT, "src", "review", "review_queue.sql")
BIN = (sorted(glob.glob("/usr/lib/postgresql/*/bin")) or [""])[-1]
INITDB = shutil.which("initdb") or (os.path.join(BIN, "initdb") if BIN else None)


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _as_owner(cmd: list) -> list:
    user = os.environ.get("PG_RUN_AS") or ("nobody" if os.geteuid() == 0 else None)
    return ["runuser", "-u", user, "--"] + cmd if user and os.geteuid() == 0 else cmd


HAVE_PG = bool(INITDB and os.path.exists(INITDB))


class RequirePostgres(unittest.TestCase):
    def test_postgres_available_when_required(self):
        """CI sets REQUIRE_PG=1, so a missing Postgres fails the pipeline instead of skipping the control tests."""
        if os.environ.get("REQUIRE_PG") == "1":
            self.assertTrue(HAVE_PG, "REQUIRE_PG=1 but no Postgres server binaries")


@unittest.skipUnless(HAVE_PG, "no Postgres server binaries")
class ReviewQueueOnPostgres(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import psycopg
        cls.psycopg = psycopg
        cls.dir = tempfile.mkdtemp(prefix="rq-pg-")
        os.chmod(cls.dir, 0o777)
        data = os.path.join(cls.dir, "data")
        cls.port = _free_port()
        bindir = os.path.dirname(INITDB)
        subprocess.run(_as_owner([INITDB, "-D", data, "-U", "admin", "-A", "trust", "--locale=C", "-E", "UTF8"]),
                       check=True, capture_output=True)
        subprocess.run(_as_owner([os.path.join(bindir, "pg_ctl"), "-D", data, "-l", os.path.join(cls.dir, "log"),
                                  "-o", f"-p {cls.port} -k {cls.dir} -c listen_addresses=''", "-w", "start"]),
                       check=True, capture_output=True)
        cls.bindir, cls.data = bindir, data
        admin = cls.conn("admin")
        for role in ("agent", "app", "jobs"):
            admin.execute(f'CREATE ROLE "{role}" LOGIN')
        sql = open(SQL).read().replace("<agent client id>", "agent").replace("<app client id>", "app") \
                             .replace("<jobs client id>", "jobs")
        admin.execute(sql)
        admin.close()

    @classmethod
    def tearDownClass(cls):
        subprocess.run(_as_owner([os.path.join(cls.bindir, "pg_ctl"), "-D", cls.data, "-m", "immediate", "stop"]),
                       capture_output=True)
        shutil.rmtree(cls.dir, ignore_errors=True)

    @classmethod
    def conn(cls, user: str):
        return cls.psycopg.connect(host=cls.dir, port=cls.port, dbname="postgres", user=user, autocommit=True)

    def proposal(self, amount: float) -> str:
        pid = str(uuid.uuid4())
        with self.conn("agent") as c:
            c.execute("""INSERT INTO proposals (proposal_id, exception_id, exception_type, business_unit, invoice_amount,
                         action, rationale, confidence, model, prompt_version)
                         VALUES (%s, %s, 'price_variance', 'BU-7', %s, 'approve_payment', 'r', 0.9, 'm', 'v')""",
                      (pid, "ex-" + pid, amount))
        return pid

    def decide(self, pid: str, reviewer: str, verdict: str, status: str):
        with self.conn("app") as c:
            with c.transaction():
                c.execute("INSERT INTO decisions (proposal_id, reviewer, verdict, correct_action) VALUES (%s, %s, %s, %s)",
                          (pid, reviewer, verdict, "escalate" if verdict == "reject" else None))
                c.execute("UPDATE proposals SET status = %s WHERE proposal_id = %s", (status, pid))

    def status(self, pid: str) -> str:
        with self.conn("admin") as c:
            return c.execute("SELECT status FROM proposals WHERE proposal_id = %s", (pid,)).fetchone()[0]

    def test_agent_cannot_insert_a_decided_proposal(self):
        with self.conn("agent") as c, self.assertRaises(self.psycopg.errors.RaiseException):
            c.execute("""INSERT INTO proposals (exception_id, exception_type, business_unit, invoice_amount, action,
                         rationale, confidence, model, prompt_version, status)
                         VALUES ('x1', 'price_variance', 'BU-7', 10, 'approve_payment', 'r', 0.9, 'm', 'v', 'approved')""")

    def test_agent_cannot_approve_without_a_decision(self):
        pid = self.proposal(100)
        with self.conn("agent") as c, self.assertRaises(self.psycopg.errors.RaiseException):
            c.execute("UPDATE proposals SET status = 'approved' WHERE proposal_id = %s", (pid,))
        self.assertEqual(self.status(pid), "pending")

    def test_temp_table_cannot_fake_approvals(self):
        """The attack: shadow decisions with a temporary table holding two fake approvals, then approve."""
        pid = self.proposal(30000)
        with self.conn("agent") as c:
            try:
                c.execute("CREATE TEMP TABLE decisions (proposal_id uuid, reviewer text, verdict text)")
                c.execute("INSERT INTO pg_temp.decisions VALUES (%s, 'x', 'approve'), (%s, 'y', 'approve')", (pid, pid))
            except self.psycopg.errors.InsufficientPrivilege:
                pass                                                   # TEMPORARY revoked: the attack stops here
            with self.assertRaises(self.psycopg.errors.RaiseException):
                c.execute("UPDATE proposals SET status = 'approved' WHERE proposal_id = %s", (pid,))
        self.assertEqual(self.status(pid), "pending")

    def test_agent_can_supersede_its_own_pending_proposal(self):
        pid = self.proposal(100)
        with self.conn("agent") as c:
            c.execute("UPDATE proposals SET status = 'superseded' WHERE proposal_id = %s", (pid,))
        self.assertEqual(self.status(pid), "superseded")

    def test_nobody_can_rewrite_the_amount(self):
        pid = self.proposal(30000)
        with self.conn("app") as c, self.assertRaises(self.psycopg.errors.InsufficientPrivilege):
            c.execute("UPDATE proposals SET invoice_amount = 100 WHERE proposal_id = %s", (pid,))

    def test_small_amount_one_approver(self):
        pid = self.proposal(900)
        self.decide(pid, "ann", "approve", "approved")
        self.assertEqual(self.status(pid), "approved")

    def test_large_amount_needs_two_different_approvers(self):
        pid = self.proposal(30000)
        with self.assertRaises(self.psycopg.errors.RaiseException):
            self.decide(pid, "ann", "approve", "approved")            # one approver, straight to approved
        self.decide(pid, "ann", "approve", "needs_second")
        with self.assertRaises(self.psycopg.errors.RaiseException):
            self.decide(pid, "ann", "second_approve", "approved")     # same person twice
        self.assertEqual(self.status(pid), "needs_second")            # the failed attempt rolled back
        self.decide(pid, "bob", "second_approve", "approved")
        self.assertEqual(self.status(pid), "approved")

    def test_closed_proposal_cannot_change(self):
        pid = self.proposal(900)
        self.decide(pid, "ann", "reject", "rejected")
        with self.assertRaises(self.psycopg.errors.RaiseException):
            self.decide(pid, "bob", "approve", "approved")

    def test_decisions_are_append_only(self):
        pid = self.proposal(900)
        self.decide(pid, "ann", "approve", "approved")
        with self.conn("app") as c, self.assertRaises(self.psycopg.errors.InsufficientPrivilege):
            c.execute("UPDATE decisions SET reviewer = 'someone else' WHERE proposal_id = %s", (pid,))

    def test_one_live_proposal_per_exception(self):
        pid = self.proposal(900)
        with self.conn("admin") as c:
            ex = c.execute("SELECT exception_id FROM proposals WHERE proposal_id = %s", (pid,)).fetchone()[0]
        with self.conn("agent") as c, self.assertRaises(self.psycopg.errors.UniqueViolation):
            c.execute("""INSERT INTO proposals (exception_id, exception_type, business_unit, invoice_amount, action,
                         rationale, confidence, model, prompt_version) VALUES (%s, 'price_variance', 'BU-7', 900,
                         'hold_payment', 'r', 0.9, 'm', 'v')""", (ex,))


if __name__ == "__main__":
    unittest.main(verbosity=2)
