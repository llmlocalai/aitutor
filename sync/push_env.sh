#!/bin/bash
# Copy the model-chain settings from datamatter into this project's Vercel environment.
# Values are read from .env.local and piped to the Vercel CLI; nothing is printed or committed.
#   bash sync/push_env.sh            (run from the aitutor folder, after `vercel link`)
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.local ] || { echo "no .env.local here"; exit 1; }
command -v vercel >/dev/null || { echo "install the Vercel CLI: npm i -g vercel"; exit 1; }
[ -f .vercel/project.json ] || vercel link
while IFS='=' read -r key value; do
  case "$key" in LOCAL_LLM_*|CLOUD_LLM_*) ;; *) continue ;; esac
  value="${value%\"}"; value="${value#\"}"; value="${value%\'}"; value="${value#\'}"   # drop surrounding quotes
  vercel env rm "$key" production -y >/dev/null 2>&1 || true
  printf '%s' "$value" | vercel env add "$key" production >/dev/null
  echo "set $key"
done < .env.local
echo "done. Redeploy: vercel --prod   (or push a commit)"
