# Labs

A small, complete agent stack that you build one module at a time. Each lesson on the site walks through the matching folder here.

- Standard library only for labs 1 to 13 and 15. Lab 6 (MCP) needs `pip install mcp`. Lab 14 needs the SDK it demonstrates.
- Every lab runs offline against a deterministic fake model, so output is the same on every machine.
- To use a real model, set `LAB_BASE_URL` (any OpenAI-compatible `/v1` endpoint) and `LAB_MODEL`. No code changes.

```bash
python3 -m labs.run_all          # run everything, about 20 seconds
python3 -m labs.m07_harness.demo # run one lab
```

The fake model is a test double. It shows the plumbing. It does not show model quality, and a rule that
"works" against it proves only that the wiring is right. Lab 13 says where this matters.

Everything the labs write goes under `labs/_work/`, which is safe to delete.
