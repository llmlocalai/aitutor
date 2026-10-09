# agent/

The deployed agent app. Populated once by `setup/03_vendor_agent_template.sh <sha>` with the vendor's
OpenAI Agents SDK app template at a pinned commit (recorded in `TEMPLATE_REF`). CI copies `src/` and
`contract.yml` in before each deploy. The template's handlers call `src/agent/spend_agent.triage()`.
