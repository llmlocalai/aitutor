"""Step 16. Memory in Lakebase Postgres: facts per user (the briefing) and turns (recall).

Local build (module 9): memory_store.py with a partition argument on every read and write,
a short briefing in every prompt, recall as a tool, and extraction after the answer in the
background. Same here. The partition is the signed-in user's identity, taken from the request
headers the app receives, never from anything the model says.
"""
from __future__ import annotations

import os
import sys
import threading

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SCHEMA = """
CREATE TABLE IF NOT EXISTS mem_facts (
  partition  text NOT NULL,
  key        text NOT NULL,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (partition, key)
);
CREATE TABLE IF NOT EXISTS mem_turns (
  id         bigserial PRIMARY KEY,
  partition  text NOT NULL,
  role       text NOT NULL,
  content    text NOT NULL,
  embedding  vector(%(dim)s),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mem_turns_partition ON mem_turns (partition, created_at DESC);
"""
# Run init() as the role the app connects as (its service principal), so the app owns its tables.
# If an admin runs it instead: GRANT SELECT, INSERT, UPDATE ON mem_facts, mem_turns TO "<app client id>";
#                              GRANT USAGE ON SEQUENCE mem_turns_id_seq TO "<app client id>";
RECALL_FLOOR = 0.25          # below this similarity say nothing, rather than guess (same as module 9)


class Memory:
    def __init__(self, pool, embed=None, dim: int = 1024):
        self.pool, self.embed, self.dim = pool, embed, dim

    def init(self) -> None:
        with self.pool.connection() as c:
            c.execute("CREATE EXTENSION IF NOT EXISTS vector")
            c.execute(SCHEMA % {"dim": self.dim})

    def remember(self, partition: str, key: str, value: str) -> None:
        with self.pool.connection() as c:
            c.execute("INSERT INTO mem_facts (partition, key, value) VALUES (%s, %s, %s) "
                      "ON CONFLICT (partition, key) DO UPDATE SET value = excluded.value, updated_at = now()",
                      (partition, key, value))

    def briefing(self, partition: str, limit: int = 8) -> str:
        """A few lines for the system prompt. Short on purpose: it is paid for on every turn."""
        with self.pool.connection() as c:
            rows = c.execute("SELECT key, value FROM mem_facts WHERE partition = %s ORDER BY updated_at DESC LIMIT %s",
                             (partition, limit)).fetchall()
        return "\n".join(f"- {k}: {v}" for k, v in rows)

    def log_turn(self, partition: str, role: str, content: str) -> None:
        vec = self.embed(content) if self.embed else None
        with self.pool.connection() as c:
            c.execute("INSERT INTO mem_turns (partition, role, content, embedding) VALUES (%s, %s, %s, %s::vector)",
                      (partition, role, content, None if vec is None else "[" + ",".join(map(str, vec)) + "]"))

    def recall(self, partition: str, query: str, k: int = 3) -> list:
        """Past turns of THIS user only. The WHERE partition clause is the boundary; keep it first."""
        vec = "[" + ",".join(map(str, self.embed(query))) + "]"
        with self.pool.connection() as c:
            rows = c.execute("SELECT content, 1 - (embedding <=> %s::vector) AS sim FROM mem_turns "
                             "WHERE partition = %s AND embedding IS NOT NULL ORDER BY embedding <=> %s::vector LIMIT %s",
                             (vec, partition, vec, k)).fetchall()
        return [{"content": r[0], "similarity": round(float(r[1]), 3)} for r in rows if r[1] >= RECALL_FLOOR]

    def after_answer(self, partition: str, user_text: str, answer: str, extract) -> threading.Thread:
        """Runs after the response is sent. A failure here is logged and never reaches the user."""
        def job():
            try:
                self.log_turn(partition, "user", user_text)
                self.log_turn(partition, "assistant", answer)
                for key, value in extract(user_text):
                    self.remember(partition, key, value)
            except Exception as e:                     # noqa: BLE001
                print("memory pipeline failed:", type(e).__name__, str(e)[:200])
        t = threading.Thread(target=job, daemon=True)
        t.start()
        return t
