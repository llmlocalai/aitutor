"""Step 15 and 16. Copy decisions from the Lakebase queue to Delta, for audit and for the next eval set.

Runs after each batch (resources/jobs.yml). Incremental by decision_id, idempotent by MERGE, so a
rerun after a failure neither skips nor duplicates. The label for each case is the action a person
confirmed: the proposed action when approved, the reviewer's correct_action when rejected.

  python export_decisions.py --catalog fin_prd
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


LOOKBACK = 1000   # ids from a bigserial can commit out of order under concurrent writers; re-read a window


def label(proposed_action: str, verdict: str, correct_action: str | None, proposal_status: str) -> str | None:
    """The confirmed action, or None while the proposal is not final. A first approval of a two-person
    proposal is not a label: the second approver may still reject it."""
    if verdict == "reject":
        return correct_action
    if verdict in ("approve", "second_approve") and proposal_status == "approved":
        return proposed_action
    return None


def main(argv: list) -> None:  # pragma: no cover
    from pyspark.sql import SparkSession

    from common.pg import pool

    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", required=True)
    from common.pg import add_args, apply_args
    add_args(ap)
    a = ap.parse_args(argv)
    apply_args(a)
    spark = SparkSession.builder.getOrCreate()
    target = f"{a.catalog}.ops.decisions_history"
    spark.sql(f"""CREATE TABLE IF NOT EXISTS {target} (decision_id BIGINT, proposal_id STRING, exception_id STRING,
                  exception_type STRING, business_unit STRING, proposed_action STRING, verdict STRING, action STRING,
                  reviewer STRING, model STRING, prompt_version STRING, trace_id STRING, decided_at TIMESTAMP)""")
    last = spark.sql(f"SELECT coalesce(max(decision_id), 0) AS m FROM {target}").collect()[0]["m"]
    # First approvals of two-person proposals were exported without a label. Re-read them however old they
    # are, or a second approval that lands after the look-back window never reaches the eval set.
    unlabelled = [r["decision_id"] for r in spark.sql(
        f"SELECT decision_id FROM {target} WHERE action IS NULL AND decided_at > current_timestamp() - INTERVAL 90 DAYS"
    ).collect()]
    with pool().connection() as conn:
        rows = conn.execute(
            """SELECT d.decision_id, p.proposal_id::text, p.exception_id, p.exception_type, p.business_unit, p.action,
                      d.verdict, d.correct_action, d.reviewer, p.model, p.prompt_version, p.trace_id, d.decided_at, p.status
               FROM decisions d JOIN proposals p USING (proposal_id)
               WHERE d.decision_id > %s OR d.decision_id = ANY(%s) ORDER BY d.decision_id""",
            (max(0, last - LOOKBACK), unlabelled)).fetchall()
    out = [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], label(r[5], r[6], r[7], r[13]), r[8], r[9], r[10], r[11], r[12])
           for r in rows]
    if not out:
        print("no new decisions")
        return
    df = spark.createDataFrame(out, spark.table(target).schema)
    df.createOrReplaceTempView("new_decisions")
    # Matched rows are updated too: a first approval's label fills in once the second approver decides.
    spark.sql(f"""MERGE INTO {target} t USING new_decisions s ON t.decision_id = s.decision_id
                  WHEN MATCHED AND t.action IS NULL AND s.action IS NOT NULL THEN UPDATE SET t.action = s.action
                  WHEN NOT MATCHED THEN INSERT *""")
    print(f"exported {len(out)} decisions after id {last}")


if __name__ == "__main__":  # pragma: no cover
    main(sys.argv[1:])
