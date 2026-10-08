"""A wave executor: fan-out, fan-in, merge rules, a wave budget and a trace. About 40 lines.

A node is  async def node(state) -> (update, next_nodes)
  update      a dict merged into shared state by merge_state
  next_nodes  {name: node_fn} to run in the next wave; {} means this path ends
"""
from __future__ import annotations

import asyncio

from labs.m04_state.store import merge_state

# region: run_graph
async def run_graph(entry_name: str, entry_fn, initial_state: dict, max_waves: int = 12) -> dict:
    state = dict(initial_state)
    wave = {entry_name: entry_fn}
    trace = []
    for wave_idx in range(1, max_waves + 1):
        if not wave:
            break
        trace.append({"wave": wave_idx, "nodes": list(wave)})
        results = await asyncio.gather(*[fn(state) for fn in wave.values()])   # fan-out
        for update, _ in results:              # merge every update first ...
            if update:
                merge_state(state, update)
        next_wave = {}
        for _, edges in results:               # ... then route
            next_wave.update(edges)            # same name twice = one entry = fan-in
        wave = next_wave
    else:
        state["budget_exhausted"] = True
    state["trace"] = trace
    return state
# endregion
