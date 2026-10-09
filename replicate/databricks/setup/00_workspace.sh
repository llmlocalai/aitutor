#!/usr/bin/env bash
# Step 1. Connect the CLI to the workspace and prove what you can reach.
# Run on your laptop. Needs the Databricks CLI (a recent version that has `bundle` and `apps`).
#   brew tap databricks/tap && brew install databricks      # macOS
#   or: curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh
set -euo pipefail

HOST="${DATABRICKS_HOST:?set DATABRICKS_HOST=https://<workspace-host>}"
PROFILE="${DATABRICKS_PROFILE:-agent}"

databricks --version

# OAuth user login (U2M). Opens a browser once, then caches a refreshable token under the profile.
databricks auth login --host "$HOST" --profile "$PROFILE"

echo "== who am I"
databricks current-user me --profile "$PROFILE" -o json | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("userName"))'

echo "== a short-lived OAuth token can be minted (the deployed agent only accepts these)"
databricks auth token --profile "$PROFILE" >/dev/null && echo "token: ok"

echo "== Unity Catalog is reachable: catalogs I can see"
databricks catalogs list --profile "$PROFILE" -o json | python3 -c 'import json,sys; print([c["name"] for c in json.load(sys.stdin)][:20])'

echo "== serving endpoints this workspace exposes (look for databricks-qwen*, databricks-gemini*, *embedding*)"
databricks serving-endpoints list --profile "$PROFILE" -o json \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); d=d if isinstance(d,list) else d.get("endpoints",[]); print("\n".join(sorted(e["name"] for e in d)))'

echo "== SQL warehouses (needed to run setup/01_catalog.sql)"
databricks warehouses list --profile "$PROFILE" -o json | python3 -c 'import json,sys; d=json.load(sys.stdin); d=d if isinstance(d,list) else d.get("warehouses",[]); [print(w["id"], w["name"], w.get("state")) for w in d]'
