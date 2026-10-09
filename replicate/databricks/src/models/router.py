"""Step 5. The model router: pick a model per task, fall back only before the first token.

Local build (modules 1 and 2): model_router.py picks default, fast or vision; the gateway
falls back from the primary to the secondary local model and then to a cloud model, and it
only does so before any text has reached the user. The same rule holds here. Once a token has
been sent, a switch would splice two models' answers together.

The gateway can also do fallbacks and traffic splits on its own (configured in the Unity
Gateway UI). Use that for availability. Keep this router for choices that depend on the task.
"""
from __future__ import annotations

import os
import sys
import time
from typing import Iterator

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import Config  # noqa: E402

TASKS = {"default": "chat_default", "fast": "chat_fast", "fallback": "chat_fallback"}


def lineup(task: str, cfg: Config) -> list:
    first = getattr(cfg, TASKS.get(task, "chat_default"))
    order = [first, cfg.chat_default, cfg.chat_fast, cfg.chat_fallback]
    return list(dict.fromkeys(order))                     # keep order, drop repeats


def stream_with_fallback(client, messages: list, task: str = "default", cfg: Config | None = None,
                         first_token_s: float = 20.0) -> Iterator[tuple]:
    """Yields (model, text_delta). Tries the next model only if no text was produced yet."""
    cfg = cfg or Config()
    errors = []
    for model in lineup(task, cfg):
        sent = False
        t0 = time.monotonic()
        try:
            stream = client.chat.completions.create(model=model, messages=messages, stream=True,
                                                    timeout=first_token_s)
            for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    sent = True
                    yield model, delta
                elif not sent and time.monotonic() - t0 > first_token_s:
                    raise TimeoutError(f"no first token in {first_token_s}s")
            if sent:
                return
            errors.append(f"{model}: empty stream")
        except Exception as e:                            # noqa: BLE001
            if sent:
                raise                                     # mid-answer: never switch models
            errors.append(f"{model}: {type(e).__name__}: {str(e)[:120]}")
    raise RuntimeError("No model answered. " + " | ".join(errors))
