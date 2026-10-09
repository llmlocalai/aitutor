#!/usr/bin/env bash
# Step 6. Copy the knowledge bank into the volume, keeping the folder taxonomy.
# The denylist is the same idea as sync/config.json in this repository: what never leaves the machine.
#   bash setup/03_upload_knowledge.sh /path/to/knowledge-bank
set -euo pipefail
SRC="${1:?usage: 03_upload_knowledge.sh <local knowledge-bank folder>}"
PROFILE="${DATABRICKS_PROFILE:-agent}"
DEST="dbfs:/Volumes/${AGENT_CATALOG:-agentlab}/${AGENT_KB_SCHEMA:-kb}/${AGENT_VOLUME:-raw}"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
# Copy to a staging folder without the denylisted paths, then upload the staging folder.
rsync -a \
  --exclude '_inbox/' --exclude '_rejected/' --exclude '.DS_Store' \
  --exclude '*.env' --exclude 'private/' --exclude 'personal/' \
  "$SRC"/ "$STAGE"/

echo "files to upload: $(find "$STAGE" -type f | wc -l)"
databricks fs cp -r --overwrite "$STAGE" "$DEST" --profile "$PROFILE"
# Authority rules travel with the files: ingest.py reads source_authority.json from the volume root.
databricks fs ls "$DEST" --profile "$PROFILE"
