#!/usr/bin/env bash
# Stage 0 environment check. Prints each tool's version and fails on anything missing
# or too old. Run it after setup and whenever a step fails for no clear reason.
#   bash scripts/verify_env.sh          (from anywhere)
set -u
fail=0
need() {  # name, command, minimum (informational)
  if out=$(eval "$2" 2>/dev/null | head -1) && [[ -n "$out" ]]; then
    printf "%-12s ok   %s\n" "$1" "$out"
  else
    printf "%-12s MISSING  (%s)\n" "$1" "$3"; fail=1
  fi
}
need git        "git --version"                         "xcode-select --install or brew install git"
need gh         "gh --version"                          "brew install gh"
need uv         "uv --version"                          "brew install uv"
need python3.11 "uv python find 3.11"                   "uv python install 3.11"
need node       "node --version"                        "brew install node (for the MCP Inspector)"
need jq         "jq --version"                          "brew install jq"
need databricks "databricks --version"                  "brew tap databricks/tap && brew install databricks"
if command -v databricks >/dev/null; then
  v=$(databricks --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  if [[ "$(printf '%s\n' 0.205.0 "$v" | sort -V | head -1)" != "0.205.0" ]]; then
    echo "databricks   TOO OLD ($v; need 0.205 or later): brew upgrade databricks"; fail=1
  fi
fi
if gh auth status >/dev/null 2>&1; then echo "gh auth      ok"; else echo "gh auth      NOT LOGGED IN: gh auth login"; fail=1; fi
[[ -f "$HOME/.contract-triage.env" ]] && echo "session env  ok   ~/.contract-triage.env" \
  || { echo "session env  MISSING: copy scripts/session.env.template to ~/.contract-triage.env"; fail=1; }
[[ $fail == 0 ]] && echo "ENVIRONMENT OK" || echo "FIX THE LINES ABOVE"
exit $fail
