# Replicating the local build on Databricks

The step-by-step guide is the `/databricks` page of the tutor site. It explains why each step exists,
what it does, how to run it, how to read the result, and how to troubleshoot it. This folder holds the
scripts that page shows.

```
setup/        00 workspace and CLI, 01 catalog and grants, 02 secrets, 03 upload the knowledge bank
src/common/   config (every name, from environment variables), Lakebase connection pool
src/models/   bench (measure the lineup), router (fallback before the first token)
src/knowledge ingest job, chunking and validation rules
src/graph/    graph edges as a Delta table
src/retrieval Lakebase sync and search SQL, AI Search index, ranking, the search tool
src/tools/    query_expenses as a Unity Catalog SQL function, contract check
src/skills/   register AGENT.md and skills in the prompt registry
src/memory/   facts and recall in Lakebase, partitioned by user
src/guard/    answer guard (figures must be in the evidence)
src/agent/    harness rules, the agent for the OpenAI Agents SDK app template
src/evals/    scorers, sealed dataset, repeated evaluation of the deployed app
src/learner/  nightly self-observation in report mode
src/ops/      status and cost queries
databricks.yml, resources/   the bundle: jobs and the agent app
tests/        portable tests, run without a workspace
check.py      compiles, parses and tests everything here; --write records the result for the site audit
```

Nothing here was run against a Databricks workspace. `python3 replicate/databricks/check.py` runs
the parts that do not need one. After editing any file in this folder, run it with `--write`, or the
site build fails its audit.
