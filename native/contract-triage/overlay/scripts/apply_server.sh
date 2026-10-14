#!/usr/bin/env bash
# Blueprint stage 2: copy the contract triage server code from the kit into the renamed repo.
#   bash "$KIT/scripts/apply_server.sh"        (from the repo root, after step 1.1)
# Copies src/contract_triage/*, tests/, eval/, workflow/, docs templates; removes the
# template's example tool, resource and prompt; adds the runtime dependencies.
set -euo pipefail
: "${KIT:?source ~/.contract-triage.env first}"
[[ -d src/contract_triage ]] || { echo "run step 1.1 (rename) first" >&2; exit 1; }
git rm -q --ignore-unmatch src/contract_triage/tools/example_tool.py \
  src/contract_triage/resources/example.py src/contract_triage/prompts/example.py
mkdir -p src/contract_triage/backends src/contract_triage/data
cp -R "$KIT/src/contract_triage/." src/contract_triage/
cp -R "$KIT/tests/." tests/
mkdir -p eval workflow docs
cp -R "$KIT/eval/." eval/
cp -R "$KIT/workflow/." workflow/
for f in "$KIT"/docs/*.md; do [[ -e "docs/$(basename "$f")" ]] || cp "$f" docs/; done
uv add --quiet "duckdb>=1.1" "databricks-sql-connector>=3.4" "databricks-sdk>=0.30"
# Databricks Apps installs requirements.txt, not pyproject.toml: keep the two in step.
for d in "duckdb>=1.1" "databricks-sql-connector>=3.4" "databricks-sdk>=0.30"; do
  grep -qxF "$d" requirements.txt || echo "$d" >> requirements.txt
done
if ! grep -q 'per-file-ignores' pyproject.toml; then
  cat >> pyproject.toml <<'TOML'

[tool.ruff.lint.per-file-ignores]
# ruff format (checked in CI) owns line length. The long lines it leaves are tool
# docstrings and SQL text the model reads, which are worse wrapped.
"**/*.py" = ["E501"]
# Databricks notebooks: spark, dbutils and display are injected by the runtime.
"pipelines/0*.py" = ["F821", "E402", "E501"]
"workflow/0*.py" = ["F821", "E402", "E501"]
"eval/databricks/*.py" = ["F821", "E402", "E501"]
TOML
fi
echo "server code in place. Next: uv sync --group dev && uv run pytest -q"
