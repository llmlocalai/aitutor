"""The same agent on the Claude Agent SDK. It reuses the MCP server from lab 6 unchanged.

NOT EXECUTED in the lab test run: it needs an Anthropic API key and the Claude
Code runtime. The imports and option names were checked against the installed
package (claude-agent-sdk 0.2.x). Run it yourself to confirm behavior.

    pip install claude-agent-sdk
    export ANTHROPIC_API_KEY=...
    python3 -m labs.m14_sdk.claude_agent_sdk_agent
"""
from __future__ import annotations

# region: claude-sdk
import asyncio
import sys

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, ResultMessage, TextBlock, query

from labs.m07_harness.loop import BASE_PROMPT


def options() -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        system_prompt=BASE_PROMPT,
        mcp_servers={"policy-desk": {"command": sys.executable, "args": ["-m", "labs.m06_tools.mcp_server"]}},
        allowed_tools=["mcp__policy-desk__search_policy", "mcp__policy-desk__query_expenses"],
        max_turns=6,                        # the round budget
    )


async def ask(question: str) -> str:
    text = []
    async for message in query(prompt=question, options=options()):
        if isinstance(message, AssistantMessage):
            text += [b.text for b in message.content if isinstance(b, TextBlock)]
        elif isinstance(message, ResultMessage):
            break
    return "\n".join(text)
# endregion


if __name__ == "__main__":
    print(asyncio.run(ask("Did B. Chen's Boston lodging exceed the lodging cap?")))
