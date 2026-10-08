"""Skills: instruction files loaded on demand. At most one per request."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional

from labs.common import llm

HERE = Path(__file__).parent
MARGIN = 0.05          # the best skill must beat '_none' by this much, or nothing loads


# region: load
def load_skills(folder: Path = HERE / "skills") -> dict:
    """Parse every *.md: a frontmatter block with `description:`, then the body."""
    skills = {}
    for p in sorted(folder.glob("*.md")):
        m = re.match(r"^---\n(.*?)\n---\n(.*)$", p.read_text(), re.S)
        if not m:
            continue
        desc = re.search(r"^description:\s*(.+)$", m.group(1), re.M)
        skills[p.stem] = {"name": p.stem, "description": desc.group(1).strip() if desc else "", "body": m.group(2).strip()}
    return skills
# endregion


# region: match
class Router:
    def __init__(self, skills: Optional[dict] = None, routing_path: Path = HERE / "routing.json"):
        self.skills = skills if skills is not None else load_skills()
        routing = json.loads(routing_path.read_text())
        self.exemplars = {name: [llm.embed(x) for x in lines]            # embedded once, at start
                          for name, lines in routing.items() if not name.startswith("_note")}

    def scores(self, text: str) -> dict:
        v = llm.embed(text)
        return {name: max((llm.cosine(v, e) for e in vecs), default=0.0) for name, vecs in self.exemplars.items()}

    def match(self, text: str) -> Optional[dict]:
        """The skill whose examples look most like this request, or None.

        '_none' holds requests that need no skill. It competes like any skill, so
        small talk routes to nothing instead of to the least-bad instruction file.
        """
        s = self.scores(text)
        none = s.pop("_none", 0.0)
        if not s:
            return None
        best = max(s, key=s.get)
        if s[best] < none + MARGIN or s[best] < 0.2 or best not in self.skills:
            return None
        return self.skills[best]
# endregion
