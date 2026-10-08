"""Memory: what the agent keeps about a user, and how it comes back.

Three parts:
  facts     small key/value notes per user          -> go into every prompt (the briefing)
  turns     the full conversation history           -> searched on demand (recall)
  pipeline  runs after the answer, in the background -> never delays or breaks a response

Every read and write takes a partition (the user). That argument is the boundary.
"""
from __future__ import annotations

import json
import re
import sqlite3
import threading
import time
from typing import Optional

from labs.common import llm

# What counts as worth keeping. A real system asks a model; rules keep the lab deterministic.
FACT_PATTERNS = [
    ("cost_center", re.compile(r"\bmy cost center is (CC-\d+)", re.I)),
    ("home_city", re.compile(r"\bi(?: am|'m) based in ([A-Z][a-z]+)", re.I)),
    ("name", re.compile(r"\bcall me ([A-Z][a-z]+)", re.I)),
    ("role", re.compile(r"\bi(?: am|'m) (?:a|an|the) ([a-z ]{3,30}?)(?:\.|,|$)", re.I)),
]
RECALL_FLOOR = 0.25      # below this similarity, say nothing rather than guess


class Memory:
    def __init__(self, db: sqlite3.Connection):
        self.db = db
        self.lock = threading.Lock()
        self.pending: list = []

    # region: facts
    def remember(self, partition: str, key: str, value: str) -> None:
        with self.lock:
            self.db.execute("INSERT INTO mem_facts VALUES (?,?,?,?) ON CONFLICT(partition, key) "
                            "DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
                            (partition, key, value, time.time()))
            self.db.commit()

    def briefing(self, partition: str, limit: int = 8) -> str:
        """A few lines for the system prompt. Short on purpose: it is charged on every turn."""
        with self.lock:
            rows = self.db.execute("SELECT key, value FROM mem_facts WHERE partition=? ORDER BY updated_at DESC LIMIT ?",
                                   (partition, limit)).fetchall()
        return "\n".join(f"- {k}: {v}" for k, v in rows)
    # endregion

    # region: pipeline
    def record(self, partition: str, thread: str, user_text: str, answer: str) -> None:
        """Store the exchange and extract durable facts from what the user said."""
        with self.lock:
            now = time.time()
            self.db.executemany("INSERT INTO conv_turns (partition, thread, role, content, ts) VALUES (?,?,?,?,?)",
                                [(partition, thread, "user", user_text, now), (partition, thread, "assistant", answer, now)])
            self.db.commit()
        for key, pattern in FACT_PATTERNS:
            m = pattern.search(user_text)
            if m:
                self.remember(partition, key, m.group(1).strip())

    def record_async(self, partition: str, thread: str, user_text: str, answer: str) -> None:
        """Fire and forget. A failure here is logged and swallowed: the user already has the answer."""
        def work():
            try:
                self.record(partition, thread, user_text, answer)
            except Exception as e:  # noqa: BLE001
                print("memory write failed (response unaffected):", e)
        t = threading.Thread(target=work, daemon=True)
        t.start()
        self.pending.append(t)

    def flush(self) -> None:
        for t in self.pending:
            t.join()
        self.pending.clear()
    # endregion

    # region: recall
    def recall(self, partition: str, query: str, exclude_thread: Optional[str] = None, top_k: int = 2) -> list:
        """Search this user's past turns. The current thread is skipped: it is already in context."""
        q = llm.embed(query)
        with self.lock:
            rows = self.db.execute("SELECT thread, role, content FROM conv_turns WHERE partition=?", (partition,)).fetchall()
        scored = [(llm.cosine(q, llm.embed(content)), thread, role, content)
                  for thread, role, content in rows if thread != exclude_thread]
        scored.sort(reverse=True)
        return [{"score": round(s, 2), "thread": t, "role": r, "content": c} for s, t, r, c in scored[:top_k] if s >= RECALL_FLOOR]
    # endregion


def recall_tool(memory: Memory, partition: str, thread: str):
    """Wrap recall as a tool bound to one user. The model cannot pass another user's id."""
    def recall_conversations(query: str) -> dict:
        hits = memory.recall(partition, query, exclude_thread=thread)
        return {"results": hits} if hits else {"results": [], "diagnostic": "nothing similar in earlier conversations"}
    return recall_conversations
