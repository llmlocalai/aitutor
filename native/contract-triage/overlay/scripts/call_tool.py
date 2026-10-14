"""Call the server from the command line, locally or on Databricks. The test command for most steps.

  uv run python scripts/call_tool.py --list
  uv run python scripts/call_tool.py contracts_find_office '{"query": "region 5"}'
  uv run python scripts/call_tool.py --resource contracts://freshness
  # the deployed app (token from: databricks auth token -p $PROFILE -o json | jq -r .access_token)
  uv run python scripts/call_tool.py --url "$APP_URL/mcp" --token "$TOKEN" --list

Locally it loads the server in-process (no subprocess, no network), which is the same
code path the stdio transport runs. Prints JSON. Exit code 1 if the tool returned an error.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))


async def run(a: argparse.Namespace) -> int:
    from fastmcp import Client

    if a.url:
        from fastmcp.client.transports import StreamableHttpTransport

        target = StreamableHttpTransport(
            a.url, headers={"Authorization": f"Bearer {a.token}"}
        )
    else:
        from contract_triage.app import mcp

        target = mcp
    async with Client(target) as c:
        if a.list:
            tools = await c.list_tools()
            res = await c.list_resources()
            prompts = await c.list_prompts()
            print(
                json.dumps(
                    {
                        "tools": [t.name for t in tools],
                        "resources": [str(r.uri) for r in res],
                        "prompts": [p.name for p in prompts],
                    },
                    indent=2,
                )
            )
            return 0
        if a.resource:
            out = await c.read_resource(a.resource)
            print(out[0].text)
            return 0
        result = await c.call_tool(
            a.tool, json.loads(a.args or "{}"), raise_on_error=False
        )
        data = result.structured_content or {
            "text": [getattr(x, "text", "") for x in result.content]
        }
        text = json.dumps(data, indent=2, default=str)
        print(
            text
            if not a.max or len(text) <= a.max
            else text[: a.max] + "\n... (truncated)"
        )
        return (
            1 if result.is_error or (isinstance(data, dict) and "error" in data) else 0
        )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("tool", nargs="?")
    ap.add_argument("args", nargs="?", help="JSON object of arguments")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--resource")
    ap.add_argument("--url")
    ap.add_argument("--token", default="")
    ap.add_argument(
        "--max", type=int, default=0, help="truncate output to N characters"
    )
    a = ap.parse_args()
    if not (a.list or a.resource or a.tool):
        ap.error("give a tool name, --list, or --resource")
    return asyncio.run(run(a))


if __name__ == "__main__":
    raise SystemExit(main())
