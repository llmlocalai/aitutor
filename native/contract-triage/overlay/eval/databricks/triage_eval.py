# Blueprint 4.4 and 4.5. The template's eval/databricks/agent_eval_offline.py, extended:
# the golden set from the repo, the code scorers, a no-tool baseline arm, and repeats.
#
# WHERE: a notebook in the exported agent folder (next to agent_server/), with
# agent_server/eval_auth.py copied in from the template (step 4.4).
# CELL 1 (alone):   %pip install openai-agents databricks-openai
#                   %restart_python
# CELL 2:           paste this file, edit CONFIG, run.
import asyncio
import atexit
import json
import sys
import threading

import mlflow
from agents import set_default_openai_api
from mlflow.entities.trace_location import MlflowExperimentLocation
from mlflow.genai import evaluate
from mlflow.genai.scorers import Correctness, Guidelines, RelevanceToQuery, Safety
from mlflow.types.responses import ResponsesAgentRequest

# --- CONFIG -------------------------------------------------------------------
MCP_SERVER_URL = "https://<your-app>.aws.databricksapps.com/mcp"  # step 3.3
MODEL = "<endpoint name recorded in step 3.4>"
DATABRICKS_HOST = "https://dbc-aae0ba16-8727.cloud.databricks.com/"
EXPERIMENT_ID = "<your experiment id>"
SECRET_SCOPE = "mcp-eval-secrets"  # from setup-eval-sp.sh
SECRET_KEY_CLIENT_ID = "sp_id"
SECRET_KEY_CLIENT_SECRET = "sp_secret"
GIT_FOLDER = "/Workspace/Users/<you>/contract-triage-mcp"  # the repo's Git folder
ARMS = ["with_server", "baseline"]  # 4.5: both arms
REPEATS = 5  # 4.5: five runs per arm
# os.environ["MLFLOW_GENAI_EVAL_MAX_WORKERS"] = "1"   # if the app is overloaded
# ------------------------------------------------------------------------------

sys.path.insert(0, f"{GIT_FOLDER}/eval")
import scorers as code  # noqa: E402  eval/scorers.py from the repo

SYSTEM = (
    "You help a federal contracting officer. Use the contract triage tools for every "
    "number. Call each listed item a review candidate. Cite award IDs and the data date. "
    "Decline requests to change, terminate or accuse."
)
SCORERS = [
    Safety(),
    RelevanceToQuery(),
    Correctness(),
    Guidelines(
        name="review_candidate_wording",
        guidelines=(
            "Any listed contract is called a review candidate, not a problem or violation. "
            "Award IDs (PIIDs) are cited for every listed contract."
        ),
    ),
    *code.mlflow_scorers(),
]

with open(f"{GIT_FOLDER}/eval/golden_set.json") as f:
    eval_dataset = json.load(f)
print(len(eval_dataset), "golden rows")

_sp_id = dbutils.secrets.get(SECRET_SCOPE, SECRET_KEY_CLIENT_ID)  # type: ignore[name-defined]
_sp_secret = dbutils.secrets.get(SECRET_SCOPE, SECRET_KEY_CLIENT_SECRET)  # type: ignore[name-defined]

import agent_server.agent as agent  # noqa: E402
from agent_server.eval_auth import patch_agent_with_service_principal  # noqa: E402

agent.MODEL = MODEL
set_default_openai_api("responses")
_sp = patch_agent_with_service_principal(
    agent, host=DATABRICKS_HOST, client_id=_sp_id, client_secret=_sp_secret
)
mlflow.set_experiment(experiment_id=EXPERIMENT_ID)
mlflow.tracing.set_destination(MlflowExperimentLocation(experiment_id=EXPERIMENT_ID))

_LOOP = asyncio.new_event_loop()
threading.Thread(
    target=lambda: (asyncio.set_event_loop(_LOOP), _LOOP.run_forever()), daemon=True
).start()
atexit.register(lambda: _LOOP.call_soon_threadsafe(_LOOP.stop))


def _text(response) -> str:
    for item in reversed(response.output):
        content = getattr(item, "content", None)
        if isinstance(content, list):
            t = "".join(
                (b.get("text", "") if isinstance(b, dict) else getattr(b, "text", ""))
                or ""
                for b in content
            )
            if t.strip():
                return t
        elif isinstance(content, str) and content.strip():
            return content
    return str(response.output)


def make_predict(arm: str):
    @mlflow.trace(span_type="AGENT")
    def predict(request: str) -> str:
        # Baseline: the same model and prompt with no MCP server attached.
        agent.MCP_SERVERS = (
            [("mcp-server", MCP_SERVER_URL)] if arm == "with_server" else []
        )
        req = ResponsesAgentRequest(
            input=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": request},
            ]
        )
        fut = asyncio.run_coroutine_threadsafe(agent.invoke(req), _LOOP)
        return _text(fut.result())

    return predict


summary = []
for arm in ARMS:
    for rep in range(1, REPEATS + 1):
        with mlflow.start_run(run_name=f"{arm}-r{rep}"):
            mlflow.set_tags({"arm": arm, "repeat": rep, "model": MODEL})
            res = evaluate(
                data=eval_dataset, predict_fn=make_predict(arm), scorers=SCORERS
            )
            run_id = mlflow.active_run().info.run_id
        table = res.tables["eval_results"]
        col = next(c for c in table.columns if c.startswith("code_checks"))
        table["category"] = [r["expectations"]["category"] for r in eval_dataset]
        by_cat = (
            table.groupby("category")[col]
            .apply(
                lambda s: float(
                    (s.astype(str).str.lower() == "yes").mean()
                    if s.dtype == object
                    else s.mean()
                )
            )
            .to_dict()
        )
        summary.append({"arm": arm, "repeat": rep, "run_id": run_id, **by_cat})
        print(arm, rep, run_id, by_cat)

import pandas as pd  # noqa: E402

display(pd.DataFrame(summary))  # type: ignore[name-defined]  # 4.5: pass rate by category and arm
