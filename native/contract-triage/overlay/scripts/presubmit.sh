#!/usr/bin/env bash
# Blueprint 6.6 submission checklist, as commands. Run from the repo root on the v1.0 tag.
set -u
fail=0
check() { if eval "$2" >/dev/null 2>&1; then echo "ok    $1"; else echo "FAIL  $1"; fail=1; fi; }
check "on tag v1.0"                       "git describe --exact-match --tags HEAD | grep -qx v1.0"
check "working tree clean"                "test -z \"\$(git status --porcelain)\""
check "LICENSE present"                   "test -s LICENSE"
check "docs/evaluation.md present"        "test -s docs/evaluation.md"
check "SECURITY.md links from README"     "grep -q SECURITY.md README.md"
check "clearance noted in decisions"      "grep -qi clearance docs/decisions.md"
check "CI green on the tag"               "gh run list --commit \"\$(git rev-parse HEAD)\" --json conclusion -q '.[0].conclusion' | grep -qx success"
check "no .env ever committed"            "! git log --all --name-only --format= | grep -E '(^|/)\\.env$'"
# Values of every key in .env must not appear anywhere in history.
if [[ -f .env ]]; then
  while IFS='=' read -r n v; do
    [[ "$n" =~ _KEY$ && ${#v} -ge 8 ]] || continue
    if git log --all -p | grep -qF -- "$v"; then echo "FAIL  value of $n found in git history"; fail=1
    else echo "ok    value of $n not in history"; fi
  done < <(grep -E '^[A-Z_]+=' .env)
fi
check "repo is public (links work logged out)" "gh repo view --json visibility -q .visibility | grep -qx PUBLIC"
[[ $fail == 0 ]] && echo "READY TO SUBMIT" || echo "NOT READY"
exit $fail
