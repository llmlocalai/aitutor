#!/usr/bin/env bash
# Step 3. Secrets and identities.
# On the local machine the keys sit in .env files with chmod 600. On Databricks they sit in a
# secret scope, and code reads them by name. A secret never goes in a notebook, a bundle or git.
set -euo pipefail
PROFILE="${DATABRICKS_PROFILE:-agent}"
SCOPE="${AGENT_SECRET_SCOPE:-agent}"

databricks secrets create-scope "$SCOPE" --profile "$PROFILE" || echo "scope $SCOPE exists"

# Only needed for things that live outside Databricks, for example the public tutor on Vercel
# calling back into the workspace, or an external MCP server. Models hosted by Databricks need no key.
put() {  # put <key>  (reads the value from stdin so it never appears in shell history)
  databricks secrets put-secret "$SCOPE" "$1" --profile "$PROFILE"
}
# printf '%s' "$EXTERNAL_TOOL_TOKEN" | put external-tool-token

databricks secrets list-secrets "$SCOPE" --profile "$PROFILE"

# Service principal for jobs and the app. Create it in the account or workspace admin UI,
# add it to the group `agent-jobs-sp` used in 01_catalog.sql, then give it an OAuth secret
# (machine-to-machine). The app gets its own service principal automatically when it is created.
echo "Next: create a service principal for jobs and add it to agent-jobs-sp (admin UI)."
