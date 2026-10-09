"""Step 16. Build the evaluation set from decisions people already made, and evaluate the deployed agent.

  python run_eval.py build --catalog fin_stg               # once per quarter: a new versioned, sealed set
  python run_eval.py run   --catalog fin_stg --agent-url https://<agent> --repeats 3 --out current.json

The eval set is history: exceptions a reviewer resolved, with the action they took. Two traps, both
handled in build(): leakage (cases used as examples in the prompt must not be in the exam) and time
(the exam is the most recent quarter, so the agent is tested on the future relative to its prompt).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from evals.scorers import mlflow_scorers, summarize  # noqa: E402

BUILD_SQL = """
CREATE TABLE IF NOT EXISTS {c}.evals.triage_v{v}
COMMENT 'Sealed eval set v{v}: resolved exceptions from the last full quarter, excluding prompt examples.' AS
SELECT d.exception_id, d.action AS expected_action, d.decided_at
FROM {c}.ops.decisions_history d
WHERE d.decided_at >= add_months(date_trunc('QUARTER', current_date()), -3)
  AND d.decided_at <  date_trunc('QUARTER', current_date())
  AND d.exception_id NOT IN (SELECT exception_id FROM {c}.evals.prompt_examples)
  AND d.action IS NOT NULL
QUALIFY row_number() OVER (PARTITION BY d.exception_id ORDER BY d.decided_at DESC) = 1   -- the final word only
"""


def build(catalog: str, version: int) -> None:  # pragma: no cover
    from pyspark.sql import SparkSession
    spark = SparkSession.builder.getOrCreate()
    spark.sql(BUILD_SQL.format(c=catalog, v=version))
    n = spark.table(f"{catalog}.evals.triage_v{version}").count()
    print(f"eval set v{version}: {n} cases. Restrict MODIFY on {catalog}.evals to the eval owner.")


def run(catalog: str, agent_url: str, repeats: int, version: int, out: str) -> None:  # pragma: no cover
    import mlflow
    import requests
    from databricks.sdk import WorkspaceClient

    w = WorkspaceClient()
    wh = os.environ["DATABRICKS_WAREHOUSE_ID"]
    res = w.statement_execution.execute_statement(
        statement=f"SELECT exception_id, expected_action FROM {catalog}.evals.triage_v{version}",
        warehouse_id=wh, wait_timeout="50s")
    cases = [{"exception_id": r[0], "expected": r[1]} for r in (res.result.data_array or [])]

    def predict(exception_id: str) -> dict:
        t0 = time.time()
        r = requests.post(f"{agent_url.rstrip('/')}/responses", headers=w.config.authenticate(), timeout=180,
                          json={"input": [{"role": "user", "content": f"Triage exception {exception_id}."}],
                                "custom_inputs": {"dry_run": True}})       # evaluate without writing to the queue
        r.raise_for_status()
        o = r.json().get("custom_outputs") or {}
        o["latency_s"] = time.time() - t0
        return o

    summaries = []
    for i in range(repeats):
        rows = []
        for c in cases:
            o = predict(c["exception_id"])
            rows.append({"predicted": o.get("action", ""), "expected": c["expected"], "rationale": o.get("rationale", ""),
                         "evidence": o.get("evidence", []), "citations": o.get("citations", []),
                         "attempts": o.get("attempts", 1), "latency_s": o["latency_s"], "cost_usd": o.get("cost_usd", 0.0)})
        summaries.append(summarize(rows))
        print(f"run {i + 1}: {summaries[-1]}")
    data = [{"inputs": {"exception_id": c["exception_id"]}, "expectations": {"action": c["expected"]}} for c in cases]
    with mlflow.start_run(run_name=f"triage_v{version}"):
        mlflow.genai.evaluate(data=data, predict_fn=predict, scorers=mlflow_scorers())
    json.dump(summaries, open(out, "w"), indent=1)


if __name__ == "__main__":  # pragma: no cover
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["build", "run"])
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--version", type=int, default=1)
    ap.add_argument("--agent-url", default=os.environ.get("AGENT_URL", ""))
    ap.add_argument("--repeats", type=int, default=3)
    ap.add_argument("--out", default="current.json")
    ap.add_argument("--warehouse-id", default=os.environ.get("DATABRICKS_WAREHOUSE_ID", ""))
    a = ap.parse_args()
    if a.warehouse_id:
        os.environ["DATABRICKS_WAREHOUSE_ID"] = a.warehouse_id
    build(a.catalog, a.version) if a.cmd == "build" else run(a.catalog, a.agent_url, a.repeats, a.version, a.out)
