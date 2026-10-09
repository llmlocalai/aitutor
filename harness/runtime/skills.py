"""Step 7. Skills with progressive disclosure: the index is always in the prompt, a body loads on demand.

A skill is a folder with SKILL.md (frontmatter name and description, then a body) plus optional
references/, scripts/ and evals/. Only `name: description` lines enter the system prompt. The body
enters the conversation when the model calls load_skill, so ten skills cost ten lines, not ten pages.

No third-party imports: the frontmatter parser reads flat `key: value` lines, which is all a
SKILL.md needs. Nested YAML belongs in a manifest file, not in frontmatter.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

NAME = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


@dataclass
class Skill:
    name: str
    description: str
    body: str
    path: Path


def parse(text: str) -> tuple[dict, str]:
    """Split a SKILL.md into (frontmatter dict, body). Raises ValueError when frontmatter is missing."""
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if not m:
        raise ValueError("no frontmatter block (--- ... ---) at the top of the file")
    meta = {}
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        k, sep, v = line.partition(":")
        if not sep or line.startswith(" "):
            raise ValueError(f"frontmatter line is not flat key: value: {line!r}")
        meta[k.strip()] = v.strip()
    return meta, m.group(2).strip()


def problems(meta: dict, folder: str) -> list[str]:
    """Contract checks that the loader enforces (the linter adds style checks on top)."""
    out = []
    name, desc = meta.get("name", ""), meta.get("description", "")
    if not name:
        out.append("missing name")
    elif not NAME.match(name) or len(name) > 64:
        out.append(f"name {name!r} must be kebab-case, at most 64 characters")
    elif name != folder:
        out.append(f"name {name!r} differs from its folder {folder!r}")
    if not desc:
        out.append("missing description")
    elif len(desc) > 1024:
        out.append(f"description is {len(desc)} characters; the limit is 1024")
    if "<" in desc or ">" in desc:
        out.append("description contains angle brackets")
    return out


def discover(root: str | Path) -> dict[str, Skill]:
    """Every valid skill under root/<name>/SKILL.md. An invalid skill raises, so a broken file fails the build."""
    found: dict[str, Skill] = {}
    for p in sorted(Path(root).glob("*/SKILL.md")):
        meta, body = parse(p.read_text(encoding="utf-8"))
        bad = problems(meta, p.parent.name)
        if bad:
            raise ValueError(f"{p}: " + "; ".join(bad))
        found[meta["name"]] = Skill(meta["name"], meta["description"], body, p)
    return found


def index(skills: dict[str, Skill]) -> str:
    """The resident part: one line per skill. The description is the router, so it must say when."""
    lines = [f"- {s.name}: {s.description}" for s in skills.values()]
    return "Load a skill with load_skill before you answer anything it covers.\n" + "\n".join(lines)


def load(skills: dict[str, Skill], name: str) -> dict:
    """The tool result for load_skill. Unknown names return an error the model can act on."""
    s = skills.get(name)
    if not s:
        return {"error": "unknown_skill", "available": sorted(skills)}
    return {"skill": s.name, "instructions": s.body}
