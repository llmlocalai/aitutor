"""Step 4. Render the one-source system prompt for a model family or an experiment variant.

  python3 harness/runtime/assemble.py --family qwen                 # print the prompt and its budget
  python3 harness/runtime/assemble.py --family claude --tools-wire  # also print tools in the family's wire format

The content (template/prompts/core.md) never forks per model. What changes per model is rendering:
section markup, rule style, date placement, whether skill bodies are inline, and the tool wire format.
Keeping one source is what makes the structure experiment in step 16 a fair test: every variant says
the same things, so a difference in scores comes from structure, not from content.

Token counts are estimates (characters / 4, rounded up). Use the server's own tokenizer, or the
prompt_tokens it reports, before trusting a number near the budget.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
KIT = HERE.parent
sys.path.insert(0, str(HERE))
import skills as skills_mod  # noqa: E402

CORE = KIT / "template" / "prompts" / "core.md"
FAMILIES = KIT / "template" / "prompts" / "families.yml"
TOOLS = KIT / "template" / "tools" / "tools.json"
SKILLS = KIT / "template" / "skills"
CONTRACT = KIT / "contract.yml"
RULE = re.compile(r"^- (?P<rule>.+?) \| why: (?P<why>.+?) \| caps: (?P<caps>.+)$")


def parse_core(text: str) -> list[tuple[str, list]]:
    """[(section id, [str | {rule, why, caps}])]. The frontmatter block is dropped."""
    text = re.sub(r"^---\n.*?\n---\n", "", text, count=1, flags=re.S)
    out: list[tuple[str, list]] = []
    for line in text.splitlines():
        if line.startswith("## "):
            out.append((line[3:].strip(), []))
        elif line.strip() and out:
            m = RULE.match(line.strip())
            out[-1][1].append(m.groupdict() if m else line.rstrip())
        elif line.strip():
            raise ValueError(f"text before the first section: {line!r}")
    return out


def load_families(path: Path = FAMILIES) -> dict:
    """families.yml without PyYAML: two-level mapping, scalars, [a, b] lists and {k: v} maps."""
    fams: dict[str, dict] = {}
    cur = None
    for raw in path.read_text().splitlines():
        line = raw.split(" #")[0].rstrip() if not raw.lstrip().startswith("#") else ""
        if not line.strip() or line.strip() == "families:":
            continue
        indent = len(line) - len(line.lstrip())
        key, _, val = line.strip().partition(":")
        if indent == 2:
            cur = fams.setdefault(key, {})
        elif indent == 4 and cur is not None:
            cur[key] = _scalar(val.strip())
    return fams


def _scalar(v: str):
    if v.startswith("[") and v.endswith("]"):
        return [x.strip() for x in v[1:-1].split(",") if x.strip()]
    if v.startswith("{") and v.endswith("}"):
        return {k.strip(): _scalar(x.strip()) for k, _, x in (p.partition(":") for p in v[1:-1].split(",")) if k.strip()}
    try:
        return int(v)
    except ValueError:
        try:
            return float(v)
        except ValueError:
            return v


def render(sections: list, *, markup: str = "markdown", rules: str = "reasons", date: str = "top",
           skills: str = "on_demand", only: list[str] | None = None, skill_set: dict | None = None,
           today: str = "2026-09-30") -> str:   # build() passes the real date or the eval world's
    """The system prompt text. `only` keeps a subset of sections (the minimal variant)."""
    skill_set = skill_set if skill_set is not None else skills_mod.discover(SKILLS)
    index = skills_mod.index(skill_set) if skills == "on_demand" else ""
    inline = "\n\n".join(f"### {s.name}\n{s.body}" for s in skill_set.values()) if skills == "inline" else ""
    if skills == "inline":
        index = "Every skill is below in full; you do not need load_skill."

    def item(x) -> str:
        if isinstance(x, str):
            return x.replace("{{date}}", today).replace("{{skills_index}}", index).replace("{{skills_inline}}", inline)
        if rules == "reasons":
            return f"- {x['rule']} Because {x['why'][0].lower()}{x['why'][1:]}"
        if rules == "caps":
            return f"- {x['caps']}"
        return f"- {x['rule']}"          # bare: the rule without its reason

    blocks = []
    for sid, items in sections:
        if only and sid not in only:
            continue
        body = "\n".join(t for t in (item(x) for x in items) if t.strip())
        if not body.strip():
            continue
        blocks.append((sid, f"<{sid}>\n{body}\n</{sid}>" if markup == "xml" else f"## {sid.capitalize()}\n{body}"))
    env = [b for s, b in blocks if s == "environment"]
    rest = [b for s, b in blocks if s != "environment"]
    ordered = (env + rest) if date == "top" else (rest + env)
    return "\n\n".join(ordered).strip() + "\n"


def tools(path: Path = TOOLS, *, production: bool = True, wire: str = "openai") -> list[dict]:
    """Tool schemas in the wire format the family's API expects. Production drops eval-only honeypots."""
    spec = [t for t in json.loads(path.read_text())["tools"] if not (production and t.get("x_eval_only"))]
    fns = [t["function"] for t in spec]
    if wire == "openai":
        return [{"type": "function", "function": f} for f in fns]
    if wire == "anthropic":
        return [{"name": f["name"], "description": f["description"], "input_schema": f["parameters"]} for f in fns]
    if wire == "gemini":
        return [{"name": f["name"], "description": f["description"], "parameters": f["parameters"]} for f in fns]
    raise ValueError(f"unknown wire format {wire!r}")


def estimate_tokens(text: str) -> int:
    return math.ceil(len(text) / 4)


def contract_budget(path: Path = CONTRACT) -> int | None:
    """budgets.max_prompt_tokens from contract.yml: the agent's own limit, whatever the model allows."""
    for raw in path.read_text().splitlines():
        k, _, v = raw.split("#")[0].strip().partition(":")
        if k == "max_prompt_tokens":
            return int(v)
    return None


def build(family: str, *, variant: dict | None = None, production: bool = True, today: str | None = None) -> dict:
    """System prompt, tools and a budget check for one family, optionally overridden by a variant.
    `today` defaults to the real date; evals pass the fixture world's date so every run sees the same one.
    The budget is the smaller of the family's (what the model handles well) and the contract's (what this
    agent may spend on every call)."""
    today = today or dt.date.today().isoformat()
    fam = load_families()[family]
    v = {"markup": fam["sections"], "rules": fam["rules"], "date": fam["date"], "skills": fam["skills"], "only": None}
    v.update({k: x for k, x in (variant or {}).items() if k in v})
    system = render(parse_core(CORE.read_text()), today=today, **v)
    tl = tools(production=production, wire=fam["wire"] if production else "openai")
    tokens = estimate_tokens(system) + estimate_tokens(json.dumps(tl))
    budget = min(x for x in (fam["budget"], contract_budget()) if x)
    return {"family": family, "settings": v, "system": system, "tools": tl, "tokens": tokens,
            "budget": budget, "family_budget": fam["budget"], "over_budget": tokens > budget}


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--family", default="generic")
    ap.add_argument("--tools-wire", action="store_true")
    a = ap.parse_args(argv)
    b = build(a.family)
    print(b["system"])
    if a.tools_wire:
        print(json.dumps(b["tools"], indent=1))
    print(f"-- {a.family}: about {b['tokens']} tokens of prompt and tools, budget {b['budget']}"
          f"{' (OVER BUDGET)' if b['over_budget'] else ''}", file=sys.stderr)
    return 1 if b["over_budget"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
