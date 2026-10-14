# Design rules (from the template's mcp-builder and mcp-eval skills)

Each rule names where this repo follows it. Step 0.4 fills the right column as you read.

| Rule (skill file) | Where this repo follows it |
|---|---|
| Tool names: service prefix, verb, object (mcp_best_practices.md) | contracts_find_office, contracts_list_* |
| Tools built around user goals, not one REST call each (SKILL.md) | five tools, each joining sources |
| Pydantic inputs with bounds and enums (python_mcp_server.md) | models.py |
| Structured output with consistent keys (mcp_best_practices.md) | every tool returns dicts + evidence |
| Pagination: has_more, next_offset (mcp_best_practices.md) | tools/_common.py page() |
| Actionable errors with a hint (mcp_best_practices.md) | {error, hint} in every tool |
| Annotations: readOnlyHint etc. (python_mcp_server.md) | READ_ONLY in tools/_common.py |
| 10-question evaluation.xml (evaluation.md) | eval/build_golden.py writes it |
