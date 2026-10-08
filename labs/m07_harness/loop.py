"""The agent loop, twice: a flat version to learn from, and the wave version to keep.

The wave version has plug points that later labs fill in:
  skills   lab 8   pick at most one instruction file for this request
  memory   lab 9   a briefing before, a record after
  guard    lab 10  check the draft against this request's evidence
  hooks    lab 10  allow or block each tool call
"""
from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path
from typing import Callable, Optional

from labs.common import llm
from labs.m04_state.store import append_log
from labs.m06_tools.registry import Registry
from labs.m07_harness.graph import run_graph

BASE_PROMPT = ("You answer questions about company travel policy and expenses. "
               "Use a tool before stating any rule, limit or amount. "
               "Report only what a tool returned. If a tool returns nothing, say what you searched.")


# region: flat
def flat_loop(messages: list, registry: Registry, max_rounds: int = 6, policy=None) -> Optional[str]:
    """Call the model, run the tools it asks for, repeat. Sequential and bounded."""
    messages = list(messages)
    for _ in range(max_rounds):
        msg = llm.chat(messages, tools=registry.schemas(), policy=policy)["choices"][0]["message"]
        messages.append(msg)
        calls = msg.get("tool_calls") or []
        if not calls:
            return msg["content"]
        for call in calls:
            args = json.loads(call["function"]["arguments"] or "{}")
            messages.append({"role": "tool", "tool_call_id": call["id"],
                             "content": registry.call_as_text(call["function"]["name"], args)})
    return None        # out of rounds; the wave version handles this properly
# endregion


class Agent:
    def __init__(self, registry: Registry, base_prompt: str = BASE_PROMPT, policy=None, max_rounds: int = 6,
                 log_dir: Optional[Path] = None, skills: Optional[Callable] = None, memory=None,
                 guard: Optional[Callable] = None, pre_tool_hooks: Optional[list] = None):
        self.registry, self.base_prompt, self.policy = registry, base_prompt, policy
        self.max_rounds, self.log_dir = max_rounds, log_dir
        self.skills, self.memory, self.guard = skills, memory, guard
        self.pre_tool_hooks = pre_tool_hooks or []

    def _log(self, name: str, record: dict) -> None:
        if self.log_dir:
            append_log(self.log_dir / f"{name}.jsonl", record)

    # region: compose
    def compose_system_prompt(self, user_text: str, partition: str) -> tuple:
        """Base instructions + at most one skill + this caller's memory. Returns (prompt, skill name)."""
        parts = [self.base_prompt]
        skill = self.skills(user_text) if self.skills else None
        if skill:
            parts.append(f"## Skill: {skill['name']}\n{skill['body']}")
        if self.memory:
            briefing = self.memory.briefing(partition)
            if briefing:
                parts.append("## What you know about this user\n" + briefing)
        return "\n\n".join(parts), (skill or {}).get("name")
    # endregion

    # region: nodes
    async def _planner(self, state: dict) -> tuple:
        offer_tools = not state.get("final_turn")
        resp = await asyncio.to_thread(llm.chat, state["messages"],
                                       self.registry.schemas() if offer_tools else None, None, 512, self.policy)
        msg = resp["choices"][0]["message"]
        update = {"messages_append": [msg], "model_calls": 1,
                  "prompt_tokens": resp["usage"]["prompt_tokens"],
                  "completion_tokens": resp["usage"]["completion_tokens"]}
        calls = msg.get("tool_calls") or []
        if not calls or not offer_tools:
            update["draft"] = msg.get("content") or ""
            return update, {}                                    # terminal: no next nodes
        update["rounds"] = state.get("rounds", 0) + 1
        if update["rounds"] > self.max_rounds:                   # budget spent: one last turn, no tools
            note = {"role": "user", "content": "[harness] You are out of tool rounds. Answer now from the evidence above. "
                                               "Say plainly what is still unknown."}
            return {"messages_append": [note], "final_turn": True, "budget_exhausted": True,
                    "model_calls": 1}, {"planner": self._planner}
        return update, {f"tool:{c['id']}": self._tool_node(c) for c in calls}   # fan-out

    def _tool_node(self, call: dict):
        async def node(state: dict) -> tuple:
            name = call["function"]["name"]
            args = json.loads(call["function"]["arguments"] or "{}")
            blocked = next((r for r in (h(name, args) for h in self.pre_tool_hooks) if r), None)
            content = (json.dumps({"error": "blocked by policy: " + blocked}) if blocked
                       else await asyncio.to_thread(self.registry.call_as_text, name, args))
            self._log("tool_calls", {"request_id": state["request_id"], "tool": name, "arguments": args,
                                     "blocked": blocked, "chars": len(content),
                                     "empty": '"count": 0' in content or '"results": []' in content})
            return ({"messages_append": [{"role": "tool", "tool_call_id": call["id"], "name": name, "content": content}],
                     "tools_used_append": [name]},
                    {"planner": self._planner})                  # every tool node names the same successor
        return node
    # endregion

    # region: run
    async def run(self, messages: list, partition: str = "anon", thread: str = "t1") -> dict:
        user_text = llm.last_user(messages)
        system, skill = self.compose_system_prompt(user_text, partition)
        state = await run_graph("planner", self._planner, {
            "request_id": uuid.uuid4().hex[:8],
            "messages": [{"role": "system", "content": system}] + list(messages)})
        answer, verdict = state.get("draft", ""), None
        if self.guard:
            verdict = self.guard(state["messages"], answer, skill)
            if not verdict["ok"]:                                # one corrective retry, then a safe fallback
                state["messages"] += [{"role": "user", "content": "[harness] " + verdict["corrective"]}]
                state = await run_graph("planner", self._planner, {**state, "draft": "", "final_turn": True})
                retry = self.guard(state["messages"], state.get("draft", ""), skill)
                answer = state.get("draft", "") if retry["ok"] else verdict["fallback"]
                verdict = {**retry, "retried": True, "used_fallback": not retry["ok"]}
        self._log("requests", {"request_id": state["request_id"], "partition": partition, "skill": skill,
                               "question": user_text, "answer": answer, "tools": state.get("tools_used", []),
                               "model_calls": state.get("model_calls"), "guard": verdict and verdict["ok"],
                               "budget_exhausted": bool(state.get("budget_exhausted"))})
        if self.memory:                                          # after the answer exists, never before
            self.memory.record_async(partition, thread, user_text, answer)
        return {"answer": answer, "skill": skill, "waves": state["trace"], "tools": state.get("tools_used", []),
                "model_calls": state.get("model_calls", 0), "guard": verdict,
                "budget_exhausted": bool(state.get("budget_exhausted")), "messages": state["messages"]}
    # endregion
