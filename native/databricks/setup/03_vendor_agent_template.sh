#!/usr/bin/env bash
# Step 14. Vendor the vendor's agent app template into agent/, once, at a pinned commit.
# Why vendor instead of cloning in CI: the template's handler must be edited to call triage(), and a
# production build must not change because someone pushed to a template repository you do not own.
# Upgrading the template is then a merge request you review, like any other dependency upgrade.
set -euo pipefail
REF="${1:?usage: 03_vendor_agent_template.sh <commit-sha-of-databricks/app-templates>}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git clone -q https://github.com/databricks/app-templates.git "$TMP/tpl"
git -C "$TMP/tpl" checkout -q "$REF"
rsync -a --delete --exclude 'src/' --exclude 'README.md' "$TMP/tpl/agent-openai-agents-sdk/" agent/
echo "$REF" > agent/TEMPLATE_REF
echo "Vendored template at $REF into agent/."
echo "Now edit the template's invoke/stream handlers to call src/agent/spend_agent.triage(exception_id, dry_run)"
echo "and return its dict as custom_outputs. Commit agent/ in one merge request titled 'vendor agent template $REF'."
