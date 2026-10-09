"""Step 21. The self-observation job, in report mode. Runs nightly as a Lakeflow job.

Local build (module 13): self_observe.py reads new log lines past a cursor, finds failures that
return success codes, proves them by re-running, and writes a report. Nothing changes itself.
Here the log is the MLflow traces of the deployed agent, and the cursor is a row in a Delta table.

  python nightly.py --experiment-id <id> [--catalog agentlab]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import Config  # noqa: E402


KEEP = {"query_expenses": {"employee_id"}}      # identity arguments: never relaxed, or every finding is noise


def findings_from_tool_call(name: str, args, output: str, rerun) -> list:
    """Pure rule, tested here. An empty result that has rows once one filter is dropped is a
    parameter problem, provable by the re-run. rerun(name, args) -> output string.
    Only arguments with a default in the tool can be dropped; identity arguments are kept."""
    if isinstance(args, str):                    # span inputs may arrive as a JSON string
        try:
            args = json.loads(args)
        except ValueError:
            return []
    if not isinstance(args, dict):
        return []
    try:
        out = json.loads(output)
    except (TypeError, ValueError):
        return []
    if out.get("count") or out.get("results"):
        return []
    for drop in [a for a in args if a not in KEEP.get(name, set())]:
        relaxed = {k: v for k, v in args.items() if k != drop}
        if not relaxed:
            continue
        try:
            again = json.loads(rerun(name, relaxed))
        except Exception:                                   # noqa: BLE001 - a failed re-run proves nothing
            continue
        n = again.get("count") or len(again.get("results", []))
        if n:
            return [{"signal": "recoverable_empty", "key": f"{name}.relax_{drop}",
                     "proof": f"{args} -> 0 rows; without {drop} -> {n} rows"}]
    return []


def main(argv: list) -> None:  # pragma: no cover
    import mlflow
    from mlflow.entities import SpanType
    from pyspark.sql import SparkSession

    ap = argparse.ArgumentParser()
    ap.add_argument("--experiment-id", required=True)
    ap.add_argument("--catalog", default=None)
    a = ap.parse_args(argv)
    if a.catalog:
        os.environ["AGENT_CATALOG"] = a.catalog
    cfg = Config()
    spark = SparkSession.builder.getOrCreate()
    cur_t = cfg.table(cfg.ops_schema, "cursors")
    spark.sql(f"CREATE TABLE IF NOT EXISTS {cur_t} (name STRING, value BIGINT)")
    row = spark.sql(f"SELECT max(value) v FROM {cur_t} WHERE name = 'observe:traces'").collect()
    since = int(row[0]["v"] or 0)

    traces = mlflow.search_traces(experiment_ids=[a.experiment_id], filter_string=f"timestamp_ms > {since}",
                                  return_type="list", max_results=5000)
    from unitycatalog.ai.core.databricks import DatabricksFunctionClient
    uc = DatabricksFunctionClient()

    def rerun(name, args):
        return str(getattr(uc.execute_function(f"{cfg.catalog}.tools.{name}", args), "value", ""))

    findings, newest, budget_hits = [], since, 0
    for tr in traces:
        newest = max(newest, int(tr.info.timestamp_ms))
        for span in tr.search_spans(span_type=SpanType.TOOL):
            name = span.name.split(".")[-1]
            if name != "query_expenses":
                continue                                   # only re-run tools that are safe to re-run
            findings += findings_from_tool_call(name, span.inputs or {}, str(span.outputs or ""), rerun)
        if "max_turns" in str(getattr(tr.info, "state", "")) or "MaxTurnsExceeded" in str(tr.data.response or ""):
            budget_hits += 1
    day = time.strftime("%Y-%m-%d")
    rows = [(day, f["signal"], f["key"], f["proof"]) for f in findings]
    if budget_hits:
        rows.append((day, "budget_exhaustion", "rounds", f"{budget_hits} traces hit the turn budget"))
    if rows:
        spark.createDataFrame(rows, "day string, signal string, key string, proof string") \
            .selectExpr("*", "current_timestamp() AS created_at").write.mode("append").saveAsTable(cfg.table(cfg.ops_schema, "findings"))
    # Move the cursor only after the findings are written: a crash re-reads, it never skips.
    spark.sql(f"INSERT INTO {cur_t} VALUES ('observe:traces', {newest})")
    print(f"traces read {len(traces)}, findings {len(rows)}, cursor {since} -> {newest}")
    print("REPORT MODE: nothing was changed. A person reads agentlab.ops.findings and opens a pull request.")


if __name__ == "__main__":  # pragma: no cover
    main(sys.argv[1:])
