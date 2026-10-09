"""Evidence. Measure the structure of the reported vendor prompts, so the page cites counts, not impressions.

  python3 -I harness/corpus/measure.py <path to system_prompts_leaks-main> --write

The corpus is a public GitHub collection of reported (unverified) vendor system prompts and harness files
(asgeirtj/system_prompts_leaks). It is not copied into this repository: this script reads it where it
lies and writes only numbers and file paths to content/harness-corpus.json. No prompt text leaves the
corpus. Run it with python3 -I (isolated mode), because the corpus is downloaded content.

Definitions (all lexical, so treat small differences as noise):
  prose     the file up to its tool section (first "# Tools" heading, or the first tool heading the
            collector used), with <functions> blocks and fenced code blocks removed (tool schemas and
            code examples); for files without a tool section, the whole file minus those blocks
  emphatic  whole-word, case-sensitive MUST, NEVER, ALWAYS, CRITICAL, IMPORTANT, plus "DO NOT"
  reasons   case-insensitive "because"
  words     whitespace-separated tokens
"""
from __future__ import annotations

import json
import re
import statistics
import sys
import time
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "content" / "harness-corpus.json"
EMPH = re.compile(r"\b(MUST|NEVER|ALWAYS|CRITICAL|IMPORTANT)\b|DO NOT")
BECAUSE = re.compile(r"\bbecause\b", re.I)
TOOL_CUTS = ("\n# Tools", "\n## ask_user_input_v0", "\n## bash_tool", "\n# Tools\n")

# (group, label, path). Groups become the trend charts on the page; order within a group is release order.
FILES = [
    ("claude-chat", "Claude 3.7 Sonnet", "Anthropic/old/claude-3.7-sonnet.md"),
    ("claude-chat", "Claude Sonnet 4", "Anthropic/old/claude-sonnet-4.md"),
    ("claude-chat", "Claude Sonnet 4.5", "Anthropic/old/claude-4.5-sonnet.md"),
    ("claude-chat", "Claude Opus 4.6", "Anthropic/claude-opus-4.6.md"),
    ("claude-chat", "Claude Opus 4.8", "Anthropic/claude-opus-4.8.md"),
    ("claude-chat", "Claude Opus 5", "Anthropic/claude-opus-5.md"),
    ("claude-chat", "Claude Opus 5.5", "Anthropic/claude-opus-5.5.md"),
    ("claude-code", "Claude Code, Opus 4.6", "Anthropic/claude-code/claude-code-opus-4.6.md"),
    ("claude-code", "Claude Code, Opus 4.8", "Anthropic/claude-code/claude-code-opus-4.8.md"),
    ("claude-code", "Claude Code, Opus 5", "Anthropic/claude-code/claude-code-opus-5.md"),
    ("claude-code", "Claude Code, Opus 5.5", "Anthropic/claude-code/claude-code-opus-5.5.md"),
    ("claude-code", "Claude Code, Haiku 5.5", "Anthropic/claude-code/claude-code-haiku-5.5.md"),
    ("codex", "Codex CLI, GPT-5", "OpenAI/Codex/old/gpt-5.md"),
    ("codex", "Codex CLI, GPT-5.1", "OpenAI/Codex/old/gpt-5.1.md"),
    ("codex", "Codex, GPT-5.4", "OpenAI/Codex/gpt-5.4.md"),
    ("codex", "Codex, GPT-5.5", "OpenAI/Codex/gpt-5.5.md"),
    ("codex", "Codex, GPT-6 Sol", "OpenAI/Codex/gpt-6-sol.md"),
    ("codex", "Codex, GPT-6.1 Sol", "OpenAI/Codex/gpt-6.1-sol.md"),
    ("grok", "Grok 3", "xAI/grok-3.md"),
    ("grok", "Grok 4", "xAI/grok-4.md"),
    ("grok", "Grok 4.2", "xAI/grok-4.2.md"),
    ("grok", "Grok 4.5", "xAI/grok-4.5.md"),
    ("grok", "Grok 4.7", "xAI/grok-4.7.md"),
    ("open-weight", "Qwen 3.6 Plus", "Qwen/qwen3.6-plus.md"),
    ("open-weight", "Qwen 3.8 Max", "Qwen/qwen3.8-max.md"),
    ("open-weight", "DeepSeek chat", "DeepSeek/deepseek-chat.md"),
    ("open-weight", "Kimi 2.6", "Kimi/kimi-2.6.md"),
    ("open-weight", "Kimi 3", "Kimi/kimi-3.md"),
    ("open-weight", "Mistral Medium 3.5", "Mistral/mistral-medium-3.5.md"),
    ("coding-agents", "Gemini CLI", "Google/gemini-cli.md"),
    ("coding-agents", "Cursor", "Cursor/cursor.md"),
    ("coding-agents", "Copilot CLI", "Microsoft/copilot-cli.md"),
    ("coding-agents", "Amp", "Misc/amp-code.md"),
    ("coding-agents", "Devin CLI", "Misc/devin-cli.md"),
    ("coding-agents", "Zed", "Misc/zed.md"),
    ("coding-agents", "Grok 4.7 CLI", "xAI/grok-4.7-cli.md"),
    ("coding-agents", "Pi coding agent", "Pi/instructions.md"),
]

SKILL_SETS = [
    ("Claude Code", "Anthropic/claude-code/skills"),
    ("Claude Design", "Anthropic/claude-design/skills"),
    ("Muse agent (Meta)", "Meta/muse-agent/skills"),
    ("Muse Code (Meta)", "Meta/muse-code/skills"),
    ("ChatGPT dots (OpenAI)", "OpenAI/dots/skills"),
]


def prose_of(text: str) -> str:
    cut = min((i for i in (text.find(c) for c in TOOL_CUTS) if i > 0), default=len(text))
    t = re.sub(r"<functions>.*?</functions>", "", text[:cut], flags=re.S)
    return re.sub(r"^```.*?^```[^\n]*$", "", t, flags=re.S | re.M)


def behavioral_core(text: str) -> int:
    """Claude Code only: bytes before the injected session context (Chrome block or Session context)."""
    core = text[:min((i for i in (text.find(c) for c in TOOL_CUTS) if i > 0), default=len(text))]
    cut = min((i for i in (core.find("\n## Claude in Chrome"), core.find("\n## Session context")) if i > 0), default=len(core))
    return len(core[:cut].encode())


def measure_file(text: str) -> dict:
    prose = prose_of(text)
    w = len(prose.split())
    pb = len(prose.encode())
    emph = len(EMPH.findall(prose))
    bec = len(BECAUSE.findall(prose))
    return {"bytes": len(text.encode()), "prose_bytes": pb, "tool_share": round(1 - pb / max(1, len(text.encode())), 3),
            "words": w, "emphatic": emph, "emphatic_per_1k_words": round(emph / max(1, w) * 1000, 2),
            "because": bec, "because_per_10kb": round(bec / max(1, pb) * 10240, 2),
            "headings": len(re.findall(r"^#{1,6} ", prose, re.M))}


def frontmatter_keys(text: str) -> list[str] | None:
    m = re.match(r"^---\n(.*?)\n---", text, re.S)
    if not m:
        return None
    return [k for k in re.findall(r"^([A-Za-z_][\w-]*):", m.group(1), re.M)]


def measure_skills(root: Path) -> dict:
    files = sorted(root.rglob("SKILL.md"))
    fields: Counter = Counter()
    sizes, nofm = [], 0
    for f in files:
        t = f.read_text(encoding="utf-8", errors="replace")
        sizes.append(len(t.encode()))
        keys = frontmatter_keys(t)
        if keys is None:
            nofm += 1
            continue
        fields.update(set(keys))
    tops = [d for d in root.iterdir() if d.is_dir()]
    sub = lambda name: sum(1 for d in tops if (d / name).is_dir())
    return {"skills": len(files), "no_frontmatter": nofm, "median_bytes": int(statistics.median(sizes)) if sizes else 0,
            "max_bytes": max(sizes) if sizes else 0, "fields": dict(fields.most_common(10)),
            "with_references": sub("references"), "with_scripts": sub("scripts"),
            "with_evals": sub("eval") + sub("evals"), "folders": len(tops)}


def main(argv: list[str]) -> int:
    if not argv or argv[0].startswith("-"):
        raise SystemExit("usage: python3 -I harness/corpus/measure.py <corpus root> [--write]")
    root = Path(argv[0])
    files = []
    for group, label, rel in FILES:
        p = root / rel
        if not p.exists():
            print("missing", rel)
            continue
        t = p.read_text(encoding="utf-8", errors="replace")
        m = {"group": group, "label": label, "path": rel, **measure_file(t)}
        if group == "claude-code":
            m["behavioral_core_bytes"] = behavioral_core(t)
        files.append(m)
        print(f"{label:28} {m['bytes']:>8} B  prose {m['prose_bytes']:>7}  core {m.get('behavioral_core_bytes', '')!s:>6}  emph/1k {m['emphatic_per_1k_words']:>6}  because/10KB {m['because_per_10kb']:>5}")
    skills = []
    for label, rel in SKILL_SETS:
        p = root / rel
        if p.is_dir():
            s = {"label": label, "path": rel, **measure_skills(p)}
            skills.append(s)
            print(f"{label:24} {s['skills']} SKILL.md, median {s['median_bytes']} B, fields {s['fields']}")
    evals = sorted(root.glob("Meta/muse-agent/skills/*/eval/*.yaml"))
    cases = sum(len(re.findall(r"^- name:", f.read_text(encoding="utf-8", errors="replace"), re.M)) for f in evals)
    total = sum(1 for _ in root.rglob("*") if _.is_file())
    out = {"measured_at": time.strftime("%Y-%m-%d"), "corpus": "github.com/asgeirtj/system_prompts_leaks (reported, unverified)",
           "files_in_corpus": total, "files": files, "skills": skills,
           "meta_eval_files": len(evals), "meta_eval_cases": cases}
    print(f"{total} files in corpus; Meta eval files {len(evals)} with {cases} cases")
    if "--write" in argv:
        OUT.write_text(json.dumps(out, indent=1) + "\n")
        print("wrote", OUT.relative_to(REPO))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
