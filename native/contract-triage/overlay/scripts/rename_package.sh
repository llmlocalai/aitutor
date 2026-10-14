#!/usr/bin/env bash
# Blueprint 1.1: rename the template package example_server -> contract_triage.
#
#   bash scripts/rename_package.sh          # from the repo root, on a clean git tree
#
# Does what the template README's "Rename the package" asks, in one pass:
#   1. git mv src/example_server src/contract_triage
#   2. replace example_server / example-server in every tracked text file
#      (pyproject, main.py, Dockerfile, manifest.yaml, deploy/, tests/, docs)
#   3. uv lock, so the lock file carries the new project name
# Then `git grep -i example_server -- ':!uv.lock' ':!scripts/rename_package.sh'` must print
# nothing (this script names the old package on purpose). A plain `grep -r` also finds
# .venv/, where uv wrote an editable-install file under the old name; that is not source.
set -euo pipefail

[[ -f pyproject.toml && -d .git ]] || { echo "run from the repo root" >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "commit or stash your changes first" >&2; exit 1; }

if [[ -d src/example_server ]]; then
  git mv src/example_server src/contract_triage
fi

# Every tracked text file except the lock file (regenerated below) and the GSA skills.
git ls-files | grep -v -e '^uv.lock$' -e '^\.agents/' -e '^scripts/rename_package.sh$' | while IFS= read -r f; do
  if grep -Iq . "$f" && grep -q -e 'example_server' -e 'example-server' "$f"; then
    # BSD sed (macOS) and GNU sed differ on -i; perl -pi works on both.
    perl -pi -e 's/example_server/contract_triage/g; s/example-server/contract-triage/g' "$f"
    echo "  edited $f"
  fi
done

uv lock --quiet
echo "left over (should be empty):"
git grep -n -i -e example_server -e example-server -- ':!uv.lock' ':!scripts/rename_package.sh' || true
