"""Step 4. Which models does this workspace have, and how fast are they from where the agent runs?

The local build measured time to first token and tokens per second on the Mac (module 1).
Here the same two numbers decide the lineup, because pay-per-token endpoints differ by
region, by load and by model, and the vendor's list is not a promise for your workspace.

  pip install -U databricks-sdk databricks-openai
  python bench.py                      # uses your CLI profile (DATABRICKS_CONFIG_PROFILE=agent)
"""
from __future__ import annotations

import os
import statistics
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import Config  # noqa: E402

PROMPT = [{"role": "user", "content": "List three reasons a travel claim can be rejected. One line each."}]


def available(names: list) -> dict:
    from databricks.sdk import WorkspaceClient

    have = {e.name for e in WorkspaceClient().serving_endpoints.list()}
    return {n: n in have for n in names}


def measure(client, model: str, runs: int = 3) -> dict:
    """Stream one answer `runs` times. First token time is what a user feels; tokens/s is what a long answer costs."""
    ttft, tps = [], []
    for _ in range(runs):
        t0 = time.perf_counter()
        first, chars = None, 0
        stream = client.chat.completions.create(model=model, messages=PROMPT, max_tokens=200, stream=True)
        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content or ""
            if delta and first is None:
                first = time.perf_counter() - t0
            chars += len(delta)
        total = time.perf_counter() - t0
        if first is None:
            raise RuntimeError("stream ended with no text")
        ttft.append(first)
        tps.append((chars / 4) / max(total - first, 1e-6))        # ~4 characters per token, same estimate as module 1
    return {"ttft_s": round(statistics.median(ttft), 2), "tok_s": round(statistics.median(tps), 1),
            "ttft_spread": (round(min(ttft), 2), round(max(ttft), 2))}


def main() -> None:
    from databricks_openai import DatabricksOpenAI

    cfg = Config()
    chat = [cfg.chat_default, cfg.chat_fast, cfg.chat_fallback]
    have = available(chat + [cfg.embedding])
    for name, ok in have.items():
        print(f"{'present' if ok else 'MISSING':8} {name}")
    client = DatabricksOpenAI()
    for model in chat:
        if not have[model]:
            continue
        try:
            print(f"{model:45} {measure(client, model)}")
        except Exception as e:                                      # noqa: BLE001 - report and keep going
            print(f"{model:45} FAILED {type(e).__name__}: {str(e)[:160]}")
    if have[cfg.embedding]:
        v = client.embeddings.create(model=cfg.embedding, input=["lodging cap for a city trip"]).data[0].embedding
        print(f"{cfg.embedding:45} dimension {len(v)} (config says {cfg.embedding_dim})")


if __name__ == "__main__":
    main()
