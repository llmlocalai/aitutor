"""The same two tools, served over the Model Context Protocol.

    python3 -m labs.m06_tools.mcp_server          # speaks MCP over stdio

Any MCP client can start this file from a config entry: a coding agent, an
editor, a managed platform, or the harness in lab 7. Needs: pip install mcp
"""
from __future__ import annotations

# region: mcp
try:                                    # mcp 2.x renamed FastMCP to MCPServer
    from mcp.server.mcpserver import MCPServer as FastMCP
except ImportError:                     # mcp 1.x
    from mcp.server.fastmcp import FastMCP

from labs.m05_rag.demo import build
from labs.m06_tools.tools import build_registry

mcp = FastMCP("policy-desk")
_db, _ = build(fresh=False)
_reg = build_registry(_db)


@mcp.tool()
def search_policy(query: str) -> dict:
    """Search policy documents. Use for rules, limits, definitions and deadlines."""
    return _reg.call("search_policy", {"query": query})


@mcp.tool()
def query_expenses(category: str = "", city: str = "", cost_center: str = "", month: str = "") -> dict:
    """Total and list expense records. Filters are optional: category, city, cost_center, month (YYYY-MM)."""
    return _reg.call("query_expenses", {"category": category, "city": city, "cost_center": cost_center, "month": month})


if __name__ == "__main__":
    mcp.run()
# endregion
