"""Measure the two numbers that explain latency: time to first token and tokens per second.

    python3 -m labs.m01_inference.bench                 # fake numbers, offline
    LAB_BASE_URL=http://127.0.0.1:11434/v1 LAB_MODEL=<tag> python3 -m labs.m01_inference.bench
"""
from __future__ import annotations

import json
import os
import time
import urllib.request

# region: bench
def bench_stream(base_url: str, model: str, prompt: str, max_tokens: int = 200) -> dict:
    """Stream one completion and time it. Works against any OpenAI-compatible server."""
    body = json.dumps({"model": model, "stream": True, "max_tokens": max_tokens,
                       "messages": [{"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request(base_url.rstrip("/") + "/chat/completions", data=body,
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + os.environ.get("LAB_API_KEY", "none")})
    t0 = time.time()
    first = None
    pieces = 0
    with urllib.request.urlopen(req, timeout=600) as resp:
        for raw in resp:
            line = raw.decode().strip()
            if not line.startswith("data:") or line.endswith("[DONE]"):
                continue
            delta = json.loads(line[5:])["choices"][0].get("delta", {})
            if delta.get("content"):
                first = first or time.time()
                pieces += 1                      # one streamed piece is roughly one token
    end = time.time()
    gen = max(end - (first or end), 1e-6)
    return {"ttft_s": round((first or end) - t0, 2), "total_s": round(end - t0, 2),
            "tokens": pieces, "tok_per_s": round(pieces / gen, 1)}
# endregion


def explain(r: dict) -> str:
    return (f"first token after {r['ttft_s']} s, {r['tokens']} tokens at {r['tok_per_s']} tok/s, "
            f"total {r['total_s']} s. Predicted total = ttft + tokens / rate = "
            f"{round(r['ttft_s'] + r['tokens'] / max(r['tok_per_s'], 1e-6), 2)} s")


if __name__ == "__main__":
    base = os.environ.get("LAB_BASE_URL")
    if base:
        cold = bench_stream(base, os.environ.get("LAB_MODEL", ""), "Count from 1 to 40.")
        warm = bench_stream(base, os.environ.get("LAB_MODEL", ""), "Count from 1 to 40.")
        print("first call :", explain(cold))
        print("second call:", explain(warm))
    else:
        print("no LAB_BASE_URL set, showing a worked example with fixed numbers")
        print("cold :", explain({"ttft_s": 41.2, "total_s": 43.98, "tokens": 200, "tok_per_s": 72.0}))
        print("warm :", explain({"ttft_s": 0.6, "total_s": 3.38, "tokens": 200, "tok_per_s": 72.0}))
        print("same model, same rate. The 40 s difference is the cold load.")
