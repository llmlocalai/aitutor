"""Memory budget: which models can stay loaded together, and what a swap costs."""
from __future__ import annotations

from itertools import combinations

# region: budget
def plan(usable_gb: float, models: dict, load_gb_per_s: float = 1.5) -> dict:
    """models maps name -> resident size in GB (weights plus context headroom)."""
    fits_alone = {m: size <= usable_gb for m, size in models.items()}
    pairs = {}
    for a, b in combinations(models, 2):
        total = models[a] + models[b]
        pairs[(a, b)] = {"total_gb": round(total, 1), "fits": total <= usable_gb}
    cold_load_s = {m: round(size / load_gb_per_s) for m, size in models.items()}
    return {"fits_alone": fits_alone, "pairs": pairs, "cold_load_s": cold_load_s}
# endregion


if __name__ == "__main__":
    lineup = {"workhorse-35b": 22.3, "vision-27b": 29.0, "reasoner-120b": 60.9, "embedder": 0.3}
    p = plan(usable_gb=77.8, models=lineup)
    print("usable 77.8 GB")
    for (a, b), v in p["pairs"].items():
        print(f"  {a:14s} + {b:14s} = {v['total_gb']:5.1f} GB  {'fits' if v['fits'] else 'DOES NOT FIT'}")
    print("cold load estimate (s):", p["cold_load_s"])
