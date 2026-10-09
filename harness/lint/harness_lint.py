"""Steps 4, 7 and 8. Lint harness files and say, case by case, what is wrong, why it matters and how to fix it.

  python3 harness/lint/harness_lint.py harness/template --family qwen     # a whole harness folder
  python3 harness/lint/harness_lint.py my_prompt.md --kind system --family claude
  python3 harness/lint/harness_lint.py path --json                        # machine-readable findings

Rules live in lint/rules.json, which the page's in-browser checker also reads, so the CLI and the page
give the same findings. For a folder, the system prompt is rendered for the family with
runtime/assemble.py and the rendered text is linted (a template's {{placeholders}} are not findings).
Exit code 1 when any finding is an error.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
RULES = json.loads((HERE / "rules.json").read_text())


def _re(pattern: str, flags: str) -> re.Pattern:
    f = (re.I if "i" in flags else 0) | (re.M if "m" in flags else 0)
    return re.compile(pattern, f)


def frontmatter(text: str) -> tuple[dict | None, str]:
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if not m:
        return None, text
    meta = {}
    for line in m.group(1).splitlines():
        k, sep, v = line.partition(":")
        if sep and not line.startswith((" ", "#")):
            meta[k.strip()] = v.strip()
    return meta, m.group(2)


def _tools(text: str) -> list[dict] | None:
    try:
        data = json.loads(text)
    except ValueError:
        return None
    items = data.get("tools", []) if isinstance(data, dict) else data
    out = []
    for t in items if isinstance(items, list) else []:
        if not isinstance(t, dict) or t.get("x_eval_only"):
            continue
        f = t.get("function", t)
        out.append({"name": str(f.get("name", "")), "description": str(f.get("description", "")),
                    "schema": f.get("parameters", f.get("input_schema"))})
    return out


def _first_line(m: re.Match, text: str) -> str:
    start = text.rfind("\n", 0, m.start()) + 1
    end = text.find("\n", m.end())
    return text[start:end if end != -1 else len(text)].strip()[:100]


def check(rule: dict, text: str, family: str) -> str | None:
    """None when the rule is satisfied, else a short piece of evidence."""
    t, flags = rule["type"], rule.get("flags", "")
    meta, body = frontmatter(text)
    words = len(text.split())
    if t == "regex_absent":
        m = _re(rule["pattern"], flags).search(text)
        return f"found: {_first_line(m, text)}" if m else None
    if t == "regex_present":
        return None if _re(rule["pattern"], flags).search(text) else "not found"
    if t == "regex_present_head":
        return None if _re(rule["pattern"], flags).search(text[: rule["head_chars"]]) else f"not in the first {rule['head_chars']} characters"
    if t == "density_max":
        n = len(_re(rule["pattern"], flags).findall(text))
        if words and n >= 3 and n / words * rule["per_words"] > rule["max"]:
            return f"{n} in {words} words ({n / words * rule['per_words']:.1f} per {rule['per_words']}, limit {rule['max']})"
        return None
    if t == "ratio_min":
        num = len(_re(rule["numerator"], flags).findall(text))
        den = len(_re(rule["denominator"], flags).findall(text))
        if den >= rule["min_denominator"] and num / den < rule["min"]:
            return f"{num} reasons for {den} rules ({num / den:.2f}, want at least {rule['min']})"
        return None
    if t == "both_present":
        a, b = len(_re(rule["a"], flags).findall(text)), len(_re(rule["b"], flags).findall(text))
        return f"{a} XML section tags and {b} Markdown headings" if a >= rule["min_each"] and b >= rule["min_each"] else None
    if t in ("max_tokens", "max_tokens_family"):
        limit = rule["max"] if t == "max_tokens" else RULES["budgets"].get(family, RULES["budgets"]["generic"])
        n = math.ceil(len(text) / 4)
        return f"about {n} tokens, budget {limit} for {family if t == 'max_tokens_family' else 'this file'}" if n > limit else None
    if t == "max_lines":
        n = len(body.splitlines())
        return f"{n} lines" if n > rule["max"] else None
    if t.startswith("frontmatter_"):
        if meta is None:
            return "no frontmatter block" if t == "frontmatter_required" else None
        if t == "frontmatter_required":
            miss = [f for f in rule["fields"] if not meta.get(f)]
            return f"missing: {', '.join(miss)}" if miss else None
        v = meta.get(rule["field"], "")
        if not v:
            return None
        if t == "frontmatter_pattern":
            ok = _re(rule["pattern"], flags).search(v) and len(v) <= rule.get("max", 10 ** 9)
            return None if ok else f"{rule['field']}: {v[:60]}"
        if t == "frontmatter_max_len":
            return f"{len(v)} characters" if len(v) > rule["max"] else None
        if t == "frontmatter_min_len":
            return f"{len(v)} characters" if len(v) < rule["min"] else None
        if t == "frontmatter_regex_present":
            return None if _re(rule["pattern"], flags).search(v) else f"{rule['field']}: {v[:80]}"
        if t == "frontmatter_regex_absent":
            m = _re(rule["pattern"], flags).search(v)
            return f"{rule['field']}: {v[:80]}" if m else None
    if t.startswith("tools_"):
        tl = _tools(text)
        if tl is None:
            return "not valid JSON" if t == "tools_object_schema" else None
        if t == "tools_min_description":
            short = [x["name"] for x in tl if len(x["description"]) < rule["min"]]
            return f"short: {', '.join(short)}" if short else None
        if t == "tools_object_schema":
            bad = [x["name"] for x in tl if not (isinstance(x["schema"], dict) and x["schema"].get("type") == "object")]
            return f"not an object: {', '.join(bad)}" if bad else None
        if t == "tools_max_count":
            return f"{len(tl)} tools" if len(tl) > rule["max"] else None
        if t == "tools_name_pattern":
            p = _re(rule["pattern"], flags)
            bad = [x["name"] for x in tl if not p.match(x["name"])]
            names = [x["name"] for x in tl]
            dup = sorted({n for n in names if names.count(n) > 1})
            return f"bad: {', '.join(bad + dup)}" if bad or dup else None
    raise ValueError(f"unknown rule type {t}")


def lint_text(text: str, kind: str, family: str = "generic") -> list[dict]:
    out = []
    for r in RULES["rules"]:
        if kind not in r["kinds"] or (r.get("families") and family not in r["families"]):
            continue
        ev = check(r, text, family)
        if ev is not None:
            out.append({"rule": r["id"], "severity": r["severity"], "evidence": ev,
                        "message": r["message"], "why": r["why"], "fix": r["fix"]})
    order = {"error": 0, "warn": 1, "info": 2}
    return sorted(out, key=lambda f: (order[f["severity"]], f["rule"]))


def kind_of(path: Path) -> str | None:
    if path.name == "SKILL.md":
        return "skill"
    if path.name == "AGENTS.md":
        return "agents"
    if path.parent.name == "tools" and path.suffix == ".json":
        return "tools"
    if path.parent.name == "agents" and path.suffix == ".md":
        return "subagent"
    if path.name == "MEMORY.md":
        return "memory"
    return None


def lint_folder(root: Path, family: str) -> dict[str, list[dict]]:
    results: dict[str, list[dict]] = {}
    core = root / "prompts" / "core.md"
    if core.exists():
        sys.path.insert(0, str(HERE.parent / "runtime"))
        import assemble
        results[f"system prompt rendered for {family}"] = lint_text(assemble.build(family)["system"], "system", family)
    for p in sorted(root.rglob("*")):
        k = kind_of(p) if p.is_file() else None
        if k:
            results[str(p.relative_to(root))] = lint_text(p.read_text(encoding="utf-8"), k, family)
    return results


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--kind", choices=RULES["kinds"])
    ap.add_argument("--family", default="generic", choices=sorted(RULES["budgets"]))
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--lang", choices=["en", "zh"], default="en")
    a = ap.parse_args(argv)
    p = Path(a.path)
    if p.is_dir():
        res = lint_folder(p, a.family)
    else:
        k = a.kind or kind_of(p)
        if not k:
            raise SystemExit("cannot tell the file kind; pass --kind")
        res = {str(p): lint_text(p.read_text(encoding="utf-8"), k, a.family)}
    if a.json:
        print(json.dumps(res, indent=1, ensure_ascii=False))
    else:
        for f, fs in res.items():
            print(f"{f}: {'no findings' if not fs else f'{len(fs)} findings'}")
            for x in fs:
                print(f"  {x['severity'].upper():5} {x['rule']}: {x['message'][a.lang]} ({x['evidence']})")
                print(f"        fix: {x['fix'][a.lang]}")
    return 1 if any(x["severity"] == "error" for fs in res.values() for x in fs) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
