# Security posture of the contract triage server (Blueprint 5.5)

Append this section to SECURITY.md. Each claim points at the code, grant or test that makes it true.

| Claim | Proof |
|---|---|
| Public data only | sources.json; no agency-internal source is read |
| The app can only read | sql/grants.template.sql grants USE and SELECT only; the INSERT test in step 3.2 fails |
| No secrets in source | SAM key via app.yaml `valueFrom: sam_api_key`; scripts/hooks/pre-commit; scripts/presubmit.sh history scan |
| Fixed API origins, no model-supplied URLs | src/contract_triage/upstream.py ORIGINS; tests/test_award_brief.py |
| Retrieved text is data | untrusted.py wrap(); tests/test_tools.py::test_injection_text_comes_back_wrapped |
| Errors and logs carry no URLs, bodies or keys | upstream.py sanitized errors; untrusted.LOG_ALLOWLIST; tests/test_award_brief.py |
| /mcp has no auth of its own | Databricks Apps puts workspace OAuth in front; unauthenticated calls get 302/401 (smoke test) |
| Every list is a set of review candidates | tool docstrings; Guidelines judge in eval/databricks/triage_eval.py |
