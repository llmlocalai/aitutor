"""Step 17. Production monitoring: score a sample of live traces continuously, not just before release.

The eval set measures last quarter. Monitoring measures today: new vendors, new policy, a model
update behind the same endpoint name. Scorers run on sampled production traces and write their
feedback onto the traces in the experiment, where a dashboard and an alert can read them.

  python register_monitors.py --experiment-id <id> --sample-rate 0.2
"""
from __future__ import annotations

import argparse

GUIDELINES = [
    "The response proposes exactly one of: approve_payment, hold_payment, request_credit_memo, escalate.",
    "Every amount in the rationale appears in a tool result in the same trace.",
    "When evidence is missing or conflicting, the response proposes escalate.",
]


def main() -> None:  # pragma: no cover
    import mlflow
    from mlflow.genai.scorers import Guidelines, Safety, ScorerSamplingConfig

    ap = argparse.ArgumentParser()
    ap.add_argument("--experiment-id", required=True)
    ap.add_argument("--sample-rate", type=float, default=0.2)
    a = ap.parse_args()
    mlflow.set_experiment(experiment_id=a.experiment_id)

    safety = Safety().register(name="safety")
    safety.start(sampling_config=ScorerSamplingConfig(sample_rate=1.0))       # cheap and critical: every trace
    rules = Guidelines(name="triage_rules", guidelines=GUIDELINES).register(name="triage_rules")
    rules.start(sampling_config=ScorerSamplingConfig(sample_rate=a.sample_rate))
    print(f"monitoring on experiment {a.experiment_id}: safety 100%, triage_rules {a.sample_rate:.0%}")


if __name__ == "__main__":  # pragma: no cover
    main()
