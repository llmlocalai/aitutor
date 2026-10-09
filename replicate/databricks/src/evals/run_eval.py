"""Step 19. Build the sealed dataset once, then evaluate the deployed agent, several times.

  python run_eval.py build  frozen_questions.json   # once: creates <catalog>.evals.frozen_questions + its digest
  python run_eval.py run    --repeats 5              # every change, and nightly

predict_fn calls the DEPLOYED app over HTTP with an OAuth token, so the eval measures what
users get, not a notebook copy of it. The app returns answer, tools and evidence in its
response's custom_outputs (agent.py returns them; the template's handler must pass them on).
If yours does not, read them from the trace instead.
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import Config  # noqa: E402
from evals.scorers import mlflow_scorers, seal_digest, to_records  # noqa: E402


def dataset_name(cfg: Config) -> str:
    return cfg.table(cfg.eval_schema, "frozen_questions")


def build(cfg: Config, path: str) -> None:  # pragma: no cover
    import mlflow
    from pyspark.sql import SparkSession

    records = to_records(json.load(open(path)))
    ds = mlflow.genai.datasets.create_dataset(uc_table_name=dataset_name(cfg))
    ds.merge_records(records)
    digest = seal_digest(records)
    spark = SparkSession.builder.getOrCreate()
    spark.sql(f"CREATE TABLE IF NOT EXISTS {cfg.table(cfg.eval_schema, 'seal')} (dataset STRING, digest STRING, n INT, sealed_at TIMESTAMP)")
    spark.sql(f"INSERT INTO {cfg.table(cfg.eval_schema, 'seal')} VALUES ('{dataset_name(cfg)}', '{digest}', {len(records)}, current_timestamp())")
    print(f"sealed {len(records)} records, digest {digest[:16]}")
    print("Now restrict MODIFY on the evals schema to the eval owner (01_catalog.sql).")


def verify_seal(cfg: Config, records: list) -> None:  # pragma: no cover
    from pyspark.sql import SparkSession

    spark = SparkSession.builder.getOrCreate()
    row = spark.sql(f"SELECT digest FROM {cfg.table(cfg.eval_schema, 'seal')} WHERE dataset = '{dataset_name(cfg)}' "
                    "ORDER BY sealed_at LIMIT 1").collect()
    if not row or row[0]["digest"] != seal_digest(records):
        raise SystemExit("SEAL BROKEN: the evaluation dataset changed after it was sealed. Refusing to score.")


def predict_fn_for(app_url: str):  # pragma: no cover
    import requests
    from databricks.sdk import WorkspaceClient

    w = WorkspaceClient()

    def predict(messages: list) -> dict:
        token = w.config.authenticate()["Authorization"]          # OAuth; the app rejects personal access tokens
        r = requests.post(f"{app_url.rstrip('/')}/responses", headers={"Authorization": token},
                          json={"input": messages}, timeout=120)
        r.raise_for_status()
        body = r.json()
        text = "".join(c.get("text", "") for item in body.get("output", []) for c in item.get("content", []) or [])
        meta = body.get("custom_outputs") or body.get("metadata") or {}   # where the handler put answer()'s extras
        return {"answer": text, "tools": meta.get("tools", []), "evidence": meta.get("evidence", [])}

    return predict


def run(cfg: Config, app_url: str, repeats: int, experiment_id: str = "") -> None:  # pragma: no cover
    import mlflow

    if experiment_id:
        mlflow.set_experiment(experiment_id=experiment_id)        # a job task has no notebook experiment

    ds = mlflow.genai.datasets.get_dataset(uc_table_name=dataset_name(cfg))
    records = ds.to_df()[["inputs", "expectations"]].to_dict("records")
    verify_seal(cfg, records)
    rates = {}
    for i in range(repeats):
        with mlflow.start_run(run_name=f"frozen-{i + 1}"):
            res = mlflow.genai.evaluate(data=ds, predict_fn=predict_fn_for(app_url), scorers=mlflow_scorers())
        for k, v in res.metrics.items():
            if k.endswith("/mean"):
                rates.setdefault(k, []).append(v)
    for k, vals in sorted(rates.items()):
        print(f"{k:40} mean {statistics.mean(vals):.3f}  spread ({min(vals):.3f}, {max(vals):.3f})  runs {len(vals)}")
    print("Report the spread. A change smaller than the spread is not a change.")


if __name__ == "__main__":  # pragma: no cover
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["build", "run"])
    ap.add_argument("path", nargs="?")
    ap.add_argument("--app-url", default=os.environ.get("AGENT_APP_URL", ""))
    ap.add_argument("--repeats", type=int, default=5)
    ap.add_argument("--experiment-id", default=os.environ.get("AGENT_EVAL_EXPERIMENT_ID", ""))
    a = ap.parse_args()
    c = Config()
    build(c, a.path) if a.cmd == "build" else run(c, a.app_url, a.repeats, a.experiment_id)
