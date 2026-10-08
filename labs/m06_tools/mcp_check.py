"""Start the MCP server as a subprocess, list its tools, call one. This is what a client does.

    python3 -m labs.m06_tools.mcp_check
"""
from __future__ import annotations

import asyncio
import json
import sys

# region: client
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main() -> None:
    params = StdioServerParameters(command=sys.executable, args=["-m", "labs.m06_tools.mcp_server"])
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            print("tools over MCP:", [t.name for t in tools.tools])
            result = await session.call_tool("query_expenses", {"category": "lodging", "city": "Boston"})
            payload = json.loads(result.content[0].text)
            print("query_expenses(lodging, Boston):", payload["count"], "row, total", payload["total_usd"])
# endregion


if __name__ == "__main__":
    asyncio.run(main())
