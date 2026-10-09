#!/usr/bin/env bash
# Step 18. Deploy your own dev copy, from your own login, the way CI deploys stg and prd.
# CI copies src/ and contract.yml into both apps and writes per-environment values into their app.yaml
# files; a plain `bundle deploy -t dev` without that ships apps that cannot import their code.
# This script does the same steps, with your dev values, so dev and CI cannot drift.
#
#   databricks auth login --host https://<dev-workspace-host>
#   export LAKEBASE_ENDPOINT=projects/spend-exceptions/branches/dev/endpoints/primary LAKEBASE_HOST=<host>
#   export GENIE_SPACE_ID=<dev-genie-space-id>
#   ./setup/04_dev_deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${LAKEBASE_ENDPOINT:?}" "${LAKEBASE_HOST:?}" "${GENIE_SPACE_ID:?}"
CATALOG="${CATALOG:-fin_dev}"
WAREHOUSE_ID="${WAREHOUSE_ID:?set WAREHOUSE_ID to your dev warehouse}"
[ -f agent/app.yaml ] || { echo "agent/ is not vendored yet: run setup/03_vendor_agent_template.sh"; exit 1; }

python3 src/common/contract.py
rm -rf agent/src && cp -r src agent/src && cp contract.yml agent/ && cp contract.yml app/
# render_env.py edits app.yaml in place; keep the committed files clean for git
cp app/app.yaml app/app.yaml.orig && cp agent/app.yaml agent/app.yaml.orig
trap 'mv app/app.yaml.orig app/app.yaml; mv agent/app.yaml.orig agent/app.yaml' EXIT
python3 src/common/render_env.py app/app.yaml AGENT_CATALOG="$CATALOG" ENDPOINT_NAME="$LAKEBASE_ENDPOINT" \
  PGHOST="$LAKEBASE_HOST" DATABRICKS_WAREHOUSE_ID=@sql_warehouse
python3 src/common/render_env.py agent/app.yaml AGENT_CATALOG="$CATALOG" GENIE_SPACE_ID="$GENIE_SPACE_ID" \
  ENDPOINT_NAME="$LAKEBASE_ENDPOINT" PGHOST="$LAKEBASE_HOST" DATABRICKS_WAREHOUSE_ID=@sql_warehouse

databricks bundle validate -t dev
databricks bundle deploy -t dev
databricks bundle run spend_pipeline -t dev
python3 src/common/apply_sql.py --file src/tools/functions.sql   --catalog "$CATALOG" --warehouse-id "$WAREHOUSE_ID"
python3 src/common/apply_sql.py --file semantics/metric_view.sql --catalog "$CATALOG" --warehouse-id "$WAREHOUSE_ID"
databricks bundle run agent -t dev
databricks bundle run reviewer -t dev
echo "dev deployed. Copies under agent/src, agent/contract.yml and app/contract.yml are build output; do not commit them."
