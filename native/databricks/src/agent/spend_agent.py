"""Step 14. The spend-exceptions agent. One entry point: triage(exception_id, dry_run).

Production path (what the bundle deploys): the vendor's OpenAI Agents SDK app template, vendored into
agent/ at a pinned commit (setup/03_vendor_agent_template.sh). Its invoke and stream handlers call
triage() and return the dict as custom_outputs.
Alternative path, Beta in October 2026: the Agent Bricks CLI (`agentbricks init --framework openai`,
`agentbricks tools add mcp`, `agentbricks deploy`), which runs the same code on Agent Runtime. Keep a
Beta tool out of the critical path until it is GA, or keep the template path as the fallback.

Division of labour, the core design decision of this file:
  the model   reads evidence through tools and proposes ONE structured resolution
  this code   checks the proposal (policy.review), retries once with the reasons, then writes it to
              the review queue, or escalates. The model never holds a write tool.
"""
from __future__ import annotations

import json
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pydantic import BaseModel, Field  # noqa: E402

from agent.policy import ALLOWED, Proposal, review  # noqa: E402
from common.contract import load as load_contract  # noqa: E402

# The allowed actions come from contract.yml (CI copies it next to src/), so the contract and the agent
# cannot disagree about what may be proposed.
CONTRACT_ACTIONS = list(load_contract()["actions"])

CATALOG = os.environ.get("AGENT_CATALOG", "fin_dev")
MODEL = os.environ.get("AGENT_MODEL", "databricks-claude-sonnet-5-5")
GENIE_SPACE = os.environ.get("GENIE_SPACE_ID", "")
MAX_TURNS = 8
PROMPT_NAME = f"{CATALOG}.ai.spend_agent_instructions"

FALLBACK_INSTRUCTIONS = """You triage one accounts-payable exception at a time.
1. Call get_exception with the exception id. If found is false, propose escalate and say why.
2. Call vendor_history for the vendor.
3. Search the payment policy for the rule that governs this exception type and spend category.
4. Propose exactly one action. Allowed actions per type: {allowed}.
Rules: every number in your rationale must come from a tool result. Cite the policy chunk ids you
relied on. If the evidence conflicts or is missing, propose escalate with confidence below 0.6.
You never pay, hold or change anything yourself; a person approves every proposal."""


class Resolution(BaseModel):
    action: str = Field(description="One of the allowed actions for this exception type")
    rationale: str = Field(description="Two to five sentences. Every figure must come from a tool result.")
    citations: list[str] = Field(default_factory=list, description="Policy chunk ids relied on")
    confidence: float = Field(ge=0, le=1)


def instructions() -> tuple:
    """(text, version). The production alias of the registered prompt; the fallback is visible in traces."""
    try:
        import mlflow
        p = mlflow.genai.load_prompt(name_or_uri=f"prompts:/{PROMPT_NAME}@production")
        return p.template, f"{PROMPT_NAME}/v{p.version}"
    except Exception:                                    # noqa: BLE001
        return FALLBACK_INSTRUCTIONS.format(allowed=json.dumps({k: sorted(v) for k, v in ALLOWED.items()})), "fallback"


def mcp_servers(host: str, headers: dict) -> list:  # pragma: no cover
    """Managed MCP endpoints. Every call runs as the agent's identity, under Unity Catalog permissions."""
    from agents.mcp import MCPServerStreamableHttp

    urls = {
        "uc_tools": f"{host}/api/2.0/mcp/functions/{CATALOG}/tools",
        "policy_search": f"{host}/api/2.0/mcp/ai-search/{CATALOG}/ai/policy_index",
    }
    if GENIE_SPACE:
        urls["genie"] = f"{host}/api/2.0/mcp/genie/{GENIE_SPACE}"
    return [MCPServerStreamableHttp(name=n, params={"url": u, "headers": headers}, cache_tools_list=True)
            for n, u in urls.items()]


def load_fact(w, exception_id: str) -> dict:  # pragma: no cover
    """The facts that route the proposal (business unit, amount, type) come from code, not from whatever
    tool output the model happened to produce. Same function the model calls, same permissions."""
    from databricks.sdk.service.sql import StatementParameterListItem

    r = w.statement_execution.execute_statement(
        statement=f"SELECT {CATALOG}.tools.get_exception(:id)", warehouse_id=os.environ["DATABRICKS_WAREHOUSE_ID"],
        parameters=[StatementParameterListItem(name="id", value=exception_id)], wait_timeout="30s")
    rows = (r.result.data_array or []) if r.result else []
    fact = json.loads(rows[0][0]) if rows and rows[0][0] else {"found": False}
    if fact.get("found") and fact.get("exception_id") != exception_id:
        raise RuntimeError("get_exception returned a different exception id")      # never route on the wrong facts
    return fact


def write_proposal(fact: dict, r: Resolution, evidence: list, version: str, trace_id: str | None) -> str:  # pragma: no cover
    from common.pg import pool

    pid = str(uuid.uuid4())
    with pool().connection() as conn:
        # supersede any live proposal for this exception, then insert: one transaction, one live row
        conn.execute("UPDATE proposals SET status = 'superseded' WHERE exception_id = %s AND status IN ('pending', 'needs_second')",
                     (fact["exception_id"],))
        conn.execute(
            """INSERT INTO proposals (proposal_id, exception_id, exception_type, business_unit, invoice_amount, action,
                                      rationale, citations, evidence, confidence, model, prompt_version, trace_id)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s)""",
            (pid, fact["exception_id"], fact["exception_type"], fact["business_unit"], fact["invoice_amount"],
             r.action, r.rationale, json.dumps(r.citations), json.dumps(evidence[-20:]), r.confidence,
             MODEL, version, trace_id))
    return pid


async def triage(exception_id: str, dry_run: bool = False) -> dict:  # pragma: no cover
    """dry_run: evaluate without writing to the queue (the eval in step 16 sets it). The handler returns
    this dict as the response's custom_outputs, so batch jobs and evals read the same fields."""
    import mlflow
    from agents import Agent, Runner, set_default_openai_api, set_default_openai_client
    from databricks.sdk import WorkspaceClient
    from databricks_openai import AsyncDatabricksOpenAI

    set_default_openai_client(AsyncDatabricksOpenAI(use_ai_gateway=True))
    set_default_openai_api("chat_completions")
    w = WorkspaceClient()
    headers = w.config.authenticate()                      # fresh OAuth header for this run
    text, version = instructions()
    fact = load_fact(w, exception_id)
    if not fact.get("found"):
        return {"exception_id": exception_id, "status": "escalated", "action": "escalate",
                "reasons": [fact.get("diagnostic", "exception not found")]}
    servers = mcp_servers(w.config.host.rstrip("/"), headers)
    for s in servers:
        await s.connect()
    try:
        agent = Agent(name="spend-exceptions", instructions=text, model=MODEL, mcp_servers=servers,
                      output_type=Resolution)
        evidence = [json.dumps(fact)]                       # the routed facts are evidence too
        prompt = [{"role": "user", "content": f"Triage exception {exception_id}. Facts from get_exception: {json.dumps(fact)}"}]
        for attempt in (1, 2):
            run = await Runner.run(agent, prompt, max_turns=MAX_TURNS)
            for item in run.new_items:
                if getattr(item, "type", "") == "tool_call_output_item":
                    evidence.append(str(getattr(item, "output", "")))
            res: Resolution = run.final_output
            reasons = review(Proposal(exception_id, fact["exception_type"], res.action, res.rationale,
                                      res.citations, res.confidence), evidence, CONTRACT_ACTIONS)
            out = {"exception_id": exception_id, "action": res.action, "rationale": res.rationale,
                   "citations": res.citations, "confidence": res.confidence, "evidence": evidence[-20:],
                   "attempts": attempt, "prompt_version": version}
            if not reasons:
                if dry_run:
                    return {**out, "status": "dry_run"}
                pid = write_proposal(fact, res, evidence, version, mlflow.get_last_active_trace_id())
                return {**out, "status": "queued", "proposal_id": pid}
            prompt = prompt + [{"role": "user", "content": "[harness] Your proposal was rejected: "
                                + "; ".join(reasons) + ". Fix it using only tool results, or propose escalate."}]
        esc = Resolution(action="escalate", rationale="The agent could not produce an admissible proposal: "
                         + "; ".join(reasons), citations=[], confidence=0.0)
        if dry_run:
            return {**out, "action": "escalate", "status": "dry_run", "reasons": reasons}
        pid = write_proposal(fact, esc, evidence, version, mlflow.get_last_active_trace_id())
        return {**out, "action": "escalate", "status": "escalated", "proposal_id": pid, "reasons": reasons}
    finally:
        for s in servers:
            await s.cleanup()
