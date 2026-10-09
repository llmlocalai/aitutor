"""Step 17. The agent, written for the vendor's OpenAI Agents SDK app template.

How to use this file:
  git clone https://github.com/databricks/app-templates.git
  cd app-templates/agent-openai-agents-sdk && uv run quickstart
  copy this repository's src/ folder next to the template's agent code, then make the template's
  invoke/stream handlers call `answer()` below (the template's own agent file shows where).
  uv run start-app          # local, then open http://localhost:8000

What maps to what (local build -> here):
  agent_loop.py planner + tools        -> Agent(...) + Runner.run(max_turns=...)
  model_router.py                      -> the model name per task; the gateway handles availability
  tools/knowledge_base.py              -> search_kb (retrieval/search_tool.py)
  query_expenses in the registry       -> Unity Catalog function, called through unitycatalog-ai
  answer_guard.py                      -> guard/answer_guard.py inside harness.guarded()
  memory_store.py + conversation recall -> memory/store.py on Lakebase
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents import Agent, Runner, function_tool, set_default_openai_api, set_default_openai_client  # noqa: E402
from databricks_openai import AsyncDatabricksOpenAI  # noqa: E402

from agent.harness import compose, guarded, match_skill, triage  # noqa: E402
from common.config import Config  # noqa: E402
from guard.answer_guard import FALLBACK, check  # noqa: E402

set_default_openai_client(AsyncDatabricksOpenAI(use_ai_gateway=True))
set_default_openai_api("chat_completions")

CFG = Config()
MAX_TURNS = 6                     # the round budget from module 7: a loop that cannot finish stops, and says so
SKILLS = {                        # trigger words per skill; the text comes from the prompt registry
    "skill_expense": ["expense", "expenses", "claim", "claims", "reimbursement", "total", "spent"],
    "skill_policy": ["policy", "allowed", "cap", "limit", "rule", "approval", "approving"],
}


@function_tool
def search_kb(query: str, collection: str = "policy") -> str:
    """Search the knowledge base. Returns passages with source, tier and a trace. If nothing matches,
    the result has a 'diagnostic' field: read it and adjust the query instead of answering from memory."""
    from retrieval.search_tool import search_kb as _search
    return json.dumps(_search(query, collection), default=str)[:12000]


@function_tool
def query_expenses(employee_id: str, claim_month: str) -> str:
    """Approved expenses for one employee (E-1234) in one month (YYYY-MM). Returns JSON with rows, count,
    total, and a 'diagnostic' when a filter emptied the result."""
    from unitycatalog.ai.core.databricks import DatabricksFunctionClient
    res = DatabricksFunctionClient().execute_function(f"{CFG.catalog}.tools.query_expenses",
                                                      {"employee_id": employee_id, "claim_month": claim_month})
    return str(getattr(res, "value", res))


def load_prompt(name: str, default: str = "") -> str:
    """The production alias of a registered prompt. Falls back to `default` so a registry outage is visible
    in the logs, not fatal to every request."""
    try:
        import mlflow
        return mlflow.genai.load_prompt(name_or_uri=f"prompts:/{CFG.catalog}.skills.{name}@production").template
    except Exception as e:                                          # noqa: BLE001
        print("prompt load failed:", name, type(e).__name__)
        return default


async def answer(messages: list, user_id: str, memory=None) -> dict:
    """messages: OpenAI-style chat history. user_id: the signed-in identity from the app's request headers."""
    text = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")
    if triage(text) == "chat":
        agent = Agent(name="chat", instructions="Reply briefly and warmly.", model=CFG.chat_fast)
        r = await Runner.run(agent, messages, max_turns=1)
        return {"answer": r.final_output, "route": "chat"}

    skill = match_skill(text, SKILLS)
    instructions = compose(load_prompt("agent_base", "You answer from tool results only."),
                           memory.briefing(user_id) if memory else "",
                           load_prompt(skill) if skill else "")
    tools = [search_kb, query_expenses]
    if memory:
        @function_tool
        def recall_conversations(query: str) -> str:
            """Search this user's own past conversations. Returns at most 3 turns above a similarity floor;
            an empty list means nothing relevant was said before."""
            return json.dumps(memory.recall(user_id, query))          # user_id is bound here, never a model argument
        tools.append(recall_conversations)
    agent = Agent(name="powerhouse", instructions=instructions, model=CFG.chat_default, tools=tools)
    used, evidence = [], []

    async def run(msgs: list) -> tuple:
        r = await Runner.run(agent, msgs, max_turns=MAX_TURNS)
        for i in r.new_items:
            kind = getattr(i, "type", "")
            if kind == "tool_call_item":
                used.append(getattr(getattr(i, "raw_item", None), "name", "") or "")
            elif kind == "tool_call_output_item":
                evidence.append(str(getattr(i, "output", "")))
        outs = [{"role": "tool", "content": e} for e in evidence]
        return str(r.final_output), outs

    out = await guarded(run, messages, check, FALLBACK)
    # tools and evidence go back to the caller (put them in the response's custom_outputs in the template's
    # handler) so the eval in step 19 can score tool use and grounding on the deployed app.
    out.update({"route": "work", "skill": skill, "tools": used, "evidence": evidence[-20:]})
    if memory:
        memory.after_answer(user_id, text, out["answer"], extract=lambda _t: [])   # plug your extractor in here
    return out
