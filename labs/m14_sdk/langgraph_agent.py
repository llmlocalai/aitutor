"""The same agent on LangGraph. The framework owns the loop; you bring tools and a model.

    pip install langgraph langchain-openai
    python3 -m labs.m14_sdk.langgraph_agent
"""
from __future__ import annotations

# region: langgraph
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

from labs.m05_rag.demo import build
from labs.m06_tools.tools import build_registry
from labs.m07_harness.loop import BASE_PROMPT


def make(base_url: str, api_key: str, model: str = "fake"):
    db, _ = build(fresh=False)
    reg = build_registry(db)

    def search_policy(query: str) -> dict:
        """Search policy documents. Use for rules, limits, definitions and deadlines."""
        return reg.call("search_policy", {"query": query})

    def query_expenses(category: str = "", city: str = "", cost_center: str = "", month: str = "") -> dict:
        """Total and list expense records. Filters are optional: category, city, cost_center, month (YYYY-MM)."""
        return reg.call("query_expenses", {"category": category, "city": city, "cost_center": cost_center, "month": month})

    llm = ChatOpenAI(base_url=base_url, api_key=api_key, model=model, temperature=0)
    return create_react_agent(llm, [search_policy, query_expenses], prompt=BASE_PROMPT)


def ask(agent, question: str) -> dict:
    out = agent.invoke({"messages": [{"role": "user", "content": question}]}, {"recursion_limit": 12})
    kinds = [m.type for m in out["messages"]]
    return {"answer": out["messages"][-1].content, "message_types": kinds}
# endregion


if __name__ == "__main__":
    from labs.m14_sdk.serve_fake import start
    server, base, key = start()
    r = ask(make(base, key), "What does the policy say about the lodging cap?")
    print("langgraph:", r["message_types"], "->", r["answer"][:110])
    server.shutdown()
