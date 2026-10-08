#!/usr/bin/env python3
"""sync.py -- publish a sanitized snapshot of the local build to the tutor site.

Runs ON THE BUILD MACHINE. It reads the build folder, never writes to it.

What it collects
  commits   subject lines from the build's git history (they are written as lessons)
  docs      title and section headings of design notes (.md)
  files     path, size and the opening description of source files
  evals     the latest numeric line from each eval history file

What it never reads
  databases, keys, env files, logs, model weights, backups, the knowledge bank,
  sealed eval material, other repositories. See config.json for the full list.

Every string is scrubbed, then checked for leaks. An item that still trips a
leak check is dropped and counted. The manifest is written to
content/live/manifest.json in this repository.

  python3 sync/sync.py --dry-run        show what would be published
  python3 sync/sync.py                  write the manifest
  python3 sync/sync.py --push           write, commit and push (Vercel redeploys)
  python3 sync/sync.py --digest --push  also ask the local model for a short digest

Python 3.9+, standard library only.
"""
from __future__ import annotations

import argparse
import ast
import datetime as dt
import fnmatch
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
sys.path.insert(0, str(HERE))
from scrub import Scrubber  # noqa: E402

# Excluded in code. config.json cannot turn these back on.
HARD_DENY_SUFFIX = (".env", ".db", ".db-shm", ".db-wal", ".db-journal", ".sqlite", ".pem",
                    ".key", ".p12", ".jsonl", ".json", ".plist", ".log", ".csv", ".zip")
HARD_DENY_NAME = re.compile(r"(?i)(secret|passphrase|password|credential|\.env|id_rsa|keys\.db|litellm\.env)")


def log(*a):
    print(*a, file=sys.stderr)


def load_json(p: Path, default):
    try:
        return json.loads(p.read_text())
    except Exception:
        return default


# --- eligibility -------------------------------------------------------------
class Rules:
    def __init__(self, root: Path, cfg: dict):
        self.root = root
        self.ext = tuple(cfg["extensions"])
        self.max_bytes = cfg["max_file_bytes"]
        self.deny_dirs = [d.strip("/") for d in cfg["deny_dirs"]]
        self.deny_dir_names = set(cfg["deny_dir_names"])
        self.deny_files = cfg["deny_files"]

    def dir_ok(self, rel: str) -> bool:
        parts = rel.split("/")
        if any(p in self.deny_dir_names or p.startswith(".") for p in parts):
            return False
        if (self.root / rel / "pyvenv.cfg").exists():   # any virtual environment
            return False
        return not any(rel == d or rel.startswith(d + "/") for d in self.deny_dirs)

    def file_ok(self, rel: str, size: int) -> bool:
        name = rel.rsplit("/", 1)[-1]
        if name.startswith(".") or not name.endswith(self.ext):
            return False
        if name.endswith(HARD_DENY_SUFFIX) or HARD_DENY_NAME.search(name):
            return False
        if any(fnmatch.fnmatch(name, pat) for pat in self.deny_files):
            return False
        return 0 < size <= self.max_bytes

    def walk(self):
        for cur, dirs, files in os.walk(self.root):
            rel_dir = os.path.relpath(cur, self.root).replace(os.sep, "/")
            rel_dir = "" if rel_dir == "." else rel_dir
            dirs[:] = sorted(d for d in dirs if self.dir_ok((rel_dir + "/" + d).strip("/")))
            for f in sorted(files):
                rel = (rel_dir + "/" + f).strip("/")
                p = Path(cur) / f
                try:
                    st = p.stat()
                except OSError:
                    continue
                if self.file_ok(rel, st.st_size):
                    yield rel, p, st


# --- classification ----------------------------------------------------------
class Classifier:
    def __init__(self, topics: dict):
        self.topics = {k: [w.lower() for w in v] for k, v in topics.items() if not k.startswith("_")}

    def modules(self, text: str, top: int = 2) -> list:
        low = text.lower()
        scores = []
        for mod, words in self.topics.items():
            s = sum(low.count(w) for w in words)
            if s:
                scores.append((s, mod))
        scores.sort(reverse=True)
        if not scores:
            return []
        best = scores[0][0]
        return [m for s, m in scores[:top] if s * 2 >= best]


# --- extraction --------------------------------------------------------------
def day(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%d")


def git_commits(root: Path, n: int) -> list:
    try:
        out = subprocess.run(
            ["git", "-C", str(root), "log", "-n", str(n), "--date=short", "--pretty=%h%x09%ad%x09%s"],
            capture_output=True, text=True, timeout=30, check=True).stdout
    except Exception as e:
        log("git log failed:", e)
        return []
    rows = []
    for line in out.splitlines():
        parts = line.split("\t", 2)
        if len(parts) == 3:
            rows.append({"hash": parts[0], "date": parts[1], "subject": parts[2]})
    return rows


def md_outline(text: str):
    title, heads = "", []
    in_code = False
    for line in text.splitlines():
        if line.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        m = re.match(r"^(#{1,2})\s+(.+?)\s*#*$", line)
        if not m:
            continue
        txt = re.sub(r"[*_`]", "", m.group(2)).strip()
        if m.group(1) == "#" and not title:
            title = txt
        elif len(heads) < 8:
            heads.append(txt[:90])
    return title, heads


def first_sentences(block: str, limit: int = 280) -> str:
    text = " ".join(block.split())
    text = re.sub(r"^[\w./-]+\.(py|sh|sql|command)\s*(--|—|-|:)\s*", "", text)
    if len(text) <= limit:
        return text
    cut = text[:limit]
    stop = max(cut.rfind(". "), cut.rfind("? "))
    return (cut[: stop + 1] if stop > 80 else cut.rsplit(" ", 1)[0] + " ...").strip()


def source_summary(text: str, ext: str) -> str:
    if ext == ".py":
        try:
            doc = ast.get_docstring(ast.parse(text))
        except (SyntaxError, ValueError, RecursionError):
            doc = None
        if doc:
            return first_sentences(doc)
    lines = []
    marker = "--" if ext == ".sql" else "#"
    for line in text.splitlines()[:60]:
        s = line.strip()
        if s.startswith("#!") or (not s and not lines):
            continue
        if not s.startswith(marker):
            break
        body = s.lstrip(marker).strip()
        if body and not set(body) <= set("-=*#"):
            lines.append(body)
    return first_sentences(" ".join(lines))


def eval_rows(root: Path, cfg: dict) -> list:
    keep = set(cfg["eval_metric_keys"])
    out = []
    for rel in cfg["eval_history"]:
        p = root / rel
        if not p.is_file():
            continue
        latest = {}
        try:
            for line in p.read_text().splitlines()[-400:]:
                try:
                    r = json.loads(line)
                except ValueError:
                    continue
                key = "/".join(str(r.get(k, "")) for k in ("collection", "gold", "variant"))
                latest[key] = r
        except OSError:
            continue
        kind = rel.split("/")[1]
        for key, r in latest.items():
            metrics = {k: v for k, v in r.items() if k in keep and isinstance(v, (int, float))}
            if metrics:
                label = " ".join(x for x in key.split("/") if x)
                out.append({"name": (kind + " " + label).strip(), "ts": str(r.get("ts", ""))[:19], "metrics": metrics})
    out.sort(key=lambda e: e["ts"], reverse=True)
    return out[:12]


# --- optional digest from the local model -----------------------------------
def digest(subjects: list) -> str:
    url = os.environ.get("SYNC_ENGINE_URL", "http://127.0.0.1:11434/v1/chat/completions")
    model = os.environ.get("SYNC_DIGEST_MODEL", "")
    if not model or not subjects:
        return ""
    prompt = ("These are recent change notes from an agent system, already anonymized. In four plain "
              "sentences, say what kind of work was done and what a learner should take from it. "
              "Do not add names, numbers or details that are not in the notes.\n\n- " + "\n- ".join(subjects[:25]))
    body = json.dumps({"model": model, "max_tokens": 260, "temperature": 0.2, "stream": False,
                       "messages": [{"role": "user", "content": prompt}]}).encode()
    try:
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read())["choices"][0]["message"]["content"].strip()
    except Exception as e:
        log("digest skipped:", e)
        return ""


# --- main --------------------------------------------------------------------
def build(root: Path, cfg: dict, topics: dict, want_digest: bool):
    rules, sc, cl = Rules(root, cfg), Scrubber(cfg), Classifier(topics)
    dropped = []

    def safe(kind: str, ident: str, *fields: str):
        """Scrub fields. Return them, or None when anything still leaks."""
        cleaned = [sc.scrub(f) for f in fields]
        bad = sc.leaks(" \n ".join(cleaned))
        if bad:
            dropped.append({"kind": kind, "item": ident, "reasons": sorted(set(bad))})
            return None
        return cleaned

    commits = []
    for c in git_commits(root, cfg["limits"]["commits"]):
        got = safe("commit", c["hash"], c["subject"])
        if got:
            commits.append({"hash": c["hash"], "date": c["date"], "subject": got[0],
                            "modules": cl.modules(c["subject"])})

    docs, files = [], []
    for rel, path, st in rules.walk():
        try:
            text = path.read_text(errors="replace")
        except OSError:
            continue
        ext = path.suffix
        if ext == ".md":
            title, heads = md_outline(text)
            if not title:
                continue
            got = safe("doc", rel, rel, title, "\x1f".join(heads))
            if got:
                hs = [h for h in got[2].split("\x1f") if h]
                docs.append({"path": got[0], "title": got[1], "updated": day(st.st_mtime), "headings": hs,
                             "modules": cl.modules(rel + " " + title + " " + " ".join(heads) + " " + text[:4000]),
                             "_m": st.st_mtime})
        else:
            summary = source_summary(text, ext)
            if not summary:
                continue
            got = safe("file", rel, rel, summary)
            if got:
                files.append({"path": got[0], "lines": text.count("\n") + 1, "updated": day(st.st_mtime),
                              "summary": got[1], "modules": cl.modules(rel + " " + summary + " " + text[:3000]),
                              "_m": st.st_mtime})

    for group, lim in ((docs, cfg["limits"]["docs"]), (files, cfg["limits"]["files"])):
        group.sort(key=lambda x: x["_m"], reverse=True)
        del group[lim:]
        for g in group:
            g.pop("_m")

    evals = []
    for e in eval_rows(root, cfg):
        got = safe("eval", e["name"], e["name"])
        if got:
            evals.append({"name": got[0], "ts": e["ts"], "metrics": e["metrics"]})

    manifest = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "sync.py",
        "stats": {"commits": len(commits), "docs": len(docs), "files": len(files), "redactions": sc.count},
        "commits": commits, "docs": docs, "files": files, "evals": evals,
    }
    if want_digest:
        d = digest([c["subject"] for c in commits])
        got = safe("digest", "digest", d) if d else None
        if got:
            manifest["digest"] = got[0]

    # Last line of defense: the whole file, as it will be published.
    final = sc.leaks(json.dumps(manifest))
    if final:
        raise SystemExit("ABORT: leak check failed on the finished manifest: " + ", ".join(sorted(set(final))))
    return manifest, dropped


def fingerprint(manifest: dict) -> str:
    m = {k: v for k, v in manifest.items() if k != "generatedAt"}
    return hashlib.sha256(json.dumps(m, sort_keys=True).encode()).hexdigest()


def git(repo: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, timeout=120)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=os.environ.get("AI_DATA_ROOT", "/Volumes/AI_DATA"))
    ap.add_argument("--repo", default=str(REPO))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--digest", action="store_true")
    a = ap.parse_args()

    root, repo = Path(a.root), Path(a.repo)
    if not root.is_dir():
        log("root not found:", root)
        return 2
    cfg = load_json(HERE / "config.json", None)
    topics = load_json(repo / "content" / "topics.json", None)
    if not cfg or not topics:
        log("config.json or content/topics.json is missing or invalid")
        return 2

    manifest, dropped = build(root, cfg, topics, a.digest)
    s = manifest["stats"]
    log(f"commits {s['commits']}  docs {s['docs']}  files {s['files']}  evals {len(manifest['evals'])}  "
        f"redactions {s['redactions']}  dropped {len(dropped)}")
    for d in dropped[:40]:
        log("  dropped", d["kind"], d["item"], "->", ", ".join(d["reasons"]))

    out = repo / "content" / "live" / "manifest.json"
    if a.dry_run:
        print(json.dumps(manifest, indent=1)[:6000])
        return 0

    old = load_json(out, {})
    if old and fingerprint(old) == fingerprint(manifest):
        log("no change since last snapshot")
        return 0
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(manifest, indent=1) + "\n")
    log("wrote", out)

    if a.push:
        git(repo, "add", "content/live/manifest.json")
        c = git(repo, "commit", "-m", "Live snapshot " + manifest["generatedAt"][:16].replace("T", " ") + " UTC")
        if c.returncode != 0:
            log(c.stdout.strip() or c.stderr.strip())
            return 0
        p = git(repo, "push")
        log("pushed" if p.returncode == 0 else "push failed: " + p.stderr.strip())
        return 0 if p.returncode == 0 else 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
