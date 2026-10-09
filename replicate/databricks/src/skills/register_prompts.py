"""Step 15. The base prompt and the skills, as versioned prompts in Unity Catalog.

Local build (module 8): AGENT.md is the base prompt; each skill is a folder with SKILL.md,
matched to a request and injected into the prompt. Here each of those files becomes a
registered prompt with versions and an alias. The agent loads "@production"; a change is a
new version, evaluated, then the alias moves. Rolling back is moving the alias back.

  python register_prompts.py /path/to/agent-server     # reads AGENT.md and skills/*/SKILL.md
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import Config  # noqa: E402


def to_double_brace(text: str) -> str:
    """MLflow prompt templates use {{name}}. Turn single-brace {name} placeholders into double braces,
    leaving braces that are already doubled, and JSON-looking braces, alone."""
    return re.sub(r"(?<!\{)\{([a-z_][a-z0-9_]*)\}(?!\})", r"{{\1}}", text)


def collect(root: Path) -> dict:
    found = {}
    base = root / "AGENT.md"
    if base.exists():
        found["agent_base"] = base.read_text()
    for skill in sorted((root / "skills").glob("*/SKILL.md")):
        found["skill_" + re.sub(r"[^a-z0-9_]", "_", skill.parent.name.lower())] = skill.read_text()
    return found


def main(argv: list) -> None:  # pragma: no cover
    import mlflow

    cfg = Config()
    root = Path(argv[0] if argv else ".")
    prompts = collect(root)
    if not prompts:
        raise SystemExit(f"no AGENT.md or skills/*/SKILL.md under {root}")
    for name, text in prompts.items():
        full = f"{cfg.catalog}.skills.{name}"
        p = mlflow.genai.register_prompt(name=full, template=to_double_brace(text),
                                         commit_message=f"import from local build ({len(text)} chars)")
        print(f"{full} -> version {p.version}")
    print("Evaluate, then: mlflow.genai.set_prompt_alias(name=..., alias='production', version=N)")


if __name__ == "__main__":  # pragma: no cover
    main(sys.argv[1:])
