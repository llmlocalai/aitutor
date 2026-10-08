"""The same agent on the OpenAI Agents SDK, pointed at any OpenAI-compatible endpoint.

    pip install openai-agents
    python3 -m labs.m14_sdk.openai_agents_agent
"""
from __future__ import annotations

# region: agents-sdk
from agents import Agent, OpenAIChatCompletionsModel, Runner, function_tool, set_tracing_disabled
from openai import AsyncOpenAI

from labs.m05_rag.demo import build
from labs.m06_tools.tools import build_registry
from labs.m07_harness.loop import BASE_PROMPT


def make(base_url: str, api_key: str, model: str = "fake") -> Agent:
    set_tracing_disabled(True)                 # tracing uploads to the vendor by default
    db, _ = build(fresh=False)
    reg = build_registry(db)

    @function_tool
    def search_policy(query: str) -> str:
        """Search policy documents. Use for rules, limits, definitions and deadlines."""
        return reg.call_as_text("search_policy", {"query": query})

    @function_tool
    def query_expenses(category: str = "", city: str = "", cost_center: str = "", month: str = "") -> str:
        """Total and list expense records. Filters are optional: category, city, cost_center, month (YYYY-MM)."""
        return reg.call_as_text("query_expenses", {"category": category, "city": city, "cost_center": cost_center, "month": month})

    client = AsyncOpenAI(base_url=base_url, api_key=api_key)
    return Agent(name="policy-desk", instructions=BASE_PROMPT, tools=[search_policy, query_expenses],
                 model=OpenAIChatCompletionsModel(model=model, openai_client=client))


def ask(agent: Agent, question: str) -> dict:
    result = Runner.run_sync(agent, question, max_turns=6)
    return {"answer": result.final_output, "items": [type(i).__name__ for i in result.new_items]}
# endregion


if __name__ == "__main__":
    from labs.m14_sdk.serve_fake import start
    server, base, key = start()
    r = ask(make(base, key), "What does the policy say about the lodging cap?")
    print("openai-agents:", r["items"], "->", r["answer"][:110])
    server.shutdown()
