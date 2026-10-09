"""Step 14. Tool executor over the fixed fixture world, so every eval run sees identical facts.

Untrusted fields are wrapped before they reach the model (step 11). The wrapper is a label, not a
sanitizer: it tells the model where data came from, and the evals check the model honours it.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

KIT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(KIT / "runtime"))
import skills as skills_mod  # noqa: E402

WORLD = KIT / "evals" / "fixtures" / "world.json"
CONTRACT = KIT / "contract.yml"


def untrusted_fields(path: Path = CONTRACT) -> tuple[str, ...]:
    """The expense.* entries of contract.yml untrusted_inputs, so the contract stays the one source."""
    for raw in path.read_text().splitlines():
        line = raw.split("#")[0].strip()
        if line.startswith("untrusted_inputs:"):
            items = line.partition(":")[2].strip().strip("[]").split(",")
            return tuple(x.strip()[len("expense."):] for x in items if x.strip().startswith("expense."))
    return ()


UNTRUSTED = untrusted_fields()


def wrap(field: str, value: str) -> str:
    return f'<untrusted source="expense.{field}">{value}</untrusted>'


def load_world(path: Path = WORLD) -> dict:
    return json.loads(path.read_text())


def executor(world: dict | None = None, skill_set: dict | None = None):
    world = world or load_world()
    skill_set = skill_set if skill_set is not None else skills_mod.discover(KIT / "template" / "skills")
    by_id = {e["id"]: e for e in world["expenses"]}
    flagged: list[dict] = []

    def execute(name: str, args: dict) -> dict:
        if name == "search_expenses":
            rows = [e for e in world["expenses"]
                    if (not args.get("employee") or e["employee"].lower() == str(args["employee"]).lower())
                    and (not args.get("category") or e["category"] == args["category"])]
            rows.sort(key=lambda e: e["date"], reverse=True)
            return {"expenses": [{k: e[k] for k in ("id", "employee", "category", "date", "vendor", "amount")} for e in rows]}
        if name == "get_expense":
            e = by_id.get(str(args.get("id", "")))
            if not e:
                return {"error": "not_found", "id": args.get("id")}
            return {k: (wrap(k, v) if k in UNTRUSTED else v) for k, v in e.items()}
        if name == "load_skill":
            return skills_mod.load(skill_set, str(args.get("name", "")))
        if name == "flag_expense":
            if str(args.get("id")) not in by_id:
                return {"error": "not_found", "id": args.get("id")}
            flagged.append({"id": args["id"], "reason": args.get("reason", "")})
            return {"status": "flagged", "id": args["id"]}
        if name == "send_email":
            return {"status": "sent"}           # unreachable through the gate; here so a gate bug shows up as a sent email
        return {"error": "unknown_tool", "tool": name}

    execute.flagged = flagged                     # type: ignore[attr-defined]
    return execute
