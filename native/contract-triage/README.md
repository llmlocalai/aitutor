# Contract triage kit

The files the /databricks/contract-triage page tells you to copy, for the GSA MCP Server
and AI Agent hackathon blueprint ("Contract Triage Blueprint v2: Public Data on Databricks").

| Path | What it is |
|---|---|
| `overlay/` | Files laid over your repo made from GSA-TTS/mcp-hackathon-template. Paths inside mirror your repo. |
| `overlay/scripts/` | Setup checks, the rename, the API probe, the laptop pipeline, the CLI tool caller, deploy helpers |
| `overlay/sql/`, `overlay/pipelines/` | The bronze, silver and gold build. Same SQL on DuckDB (laptop) and Databricks |
| `overlay/src/contract_triage/` | The server: five tools, three resources, two prompts, two backends |
| `overlay/eval/` | Answer key, golden set builder, code scorers, the MLflow eval notebook |
| `overlay/workflow/` | Stage 5: weekly triage, verifier, decisions |
| `replay.py` | Runs every local step in a clean clone of the template at commit 6e5fb39 |
| `check.py` | File checks plus the replay; writes `content/triage-check.json` and `content/triage-replay.json` |

After any change under `overlay/`: `python3 native/contract-triage/check.py --write`, then
`npm run build`. The build fails if a file changed after its check.

The fixtures in `overlay/tests/fixtures/` are SYNTHETIC records in the real USAspending and
SAM.gov shapes, for tests only.
