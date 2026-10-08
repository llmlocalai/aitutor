"""Redaction for anything that leaves the build machine.

Two passes:
  scrub(text)   replaces known sensitive strings and patterns
  leaks(text)   reports anything sensitive that is still present

An item is published only when leaks() returns nothing after scrub().
Python 3.9 compatible, standard library only.
"""
from __future__ import annotations

import re

# --- patterns that are always treated as secrets or identifiers -------------
_SECRET_ASSIGN = re.compile(
    r"(?i)\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PASSPHRASE|CREDENTIAL)[A-Z0-9_]*)"
    r"(\s*[=:]\s*)([\"']?)([^\s\"',;]{6,})\3"
)
_PATTERNS = [
    (re.compile(r"\bsk-[A-Za-z0-9_\-]{12,}"), "<key>"),
    (re.compile(r"\b(?:ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{20,}"), "<key>"),
    (re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._\-]{12,}"), "Bearer <key>"),
    (re.compile(r"\b[0-9a-fA-F]{32,}\b"), "<hex>"),
    (re.compile(r"\b[A-Za-z0-9+/]{40,}={0,2}"), "<blob>"),
    (re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"), "<email>"),
    (re.compile(r"\b[\w-]+\.ts\.net\b"), "tailnet-host"),
    (re.compile(r"/Users/[^/\s\"']+"), "~"),
    (re.compile(r"\b(?!127\.0\.0\.1\b)(?!0\.0\.0\.0\b)(?:\d{1,3}\.){3}\d{1,3}\b"), "<ip>"),
]

# --- what must never survive -------------------------------------------------
_LEAK_PATTERNS = [
    ("volume path", re.compile(r"/Volumes/")),
    ("home path", re.compile(r"/Users/")),
    ("tailnet host", re.compile(r"\.ts\.net\b")),
    ("email", re.compile(r"\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b")),
    ("api key", re.compile(r"\bsk-[A-Za-z0-9_\-]{12,}")),
    ("long hex", re.compile(r"\b[0-9a-fA-F]{32,}\b")),
    ("ip address", re.compile(r"\b(?!127\.0\.0\.1\b)(?!0\.0\.0\.0\b)(?:\d{1,3}\.){3}\d{1,3}\b")),
]


def _term_re(term: str) -> "re.Pattern[str]":
    # Whole-token match so "DoD" does not fire inside another word.
    return re.compile(r"(?<![A-Za-z0-9])" + re.escape(term) + r"(?![A-Za-z0-9])")


class Scrubber:
    def __init__(self, config: dict):
        self.replace = [(a, b) for a, b in config.get("replace", [])]
        terms = sorted(config.get("domain_terms", []), key=lambda t: -len(t[0]))
        self.terms = [(_term_re(a), b) for a, b in terms]
        self.term_checks = [(a, _term_re(a)) for a, _ in terms]
        self.literal_checks = [a for a, _ in self.replace if not a.startswith(":")]
        self.count = 0

    def scrub(self, text: str) -> str:
        if not text:
            return text
        out = text
        for a, b in self.replace:
            if a in out:
                self.count += out.count(a)
                out = out.replace(a, b)
        out, n = _SECRET_ASSIGN.subn(lambda m: f"{m.group(1)}{m.group(2)}<redacted>", out)
        self.count += n
        for pat, rep in _PATTERNS:
            out, n = pat.subn(rep, out)
            self.count += n
        for pat, rep in self.terms:
            out, n = pat.subn(rep, out)
            self.count += n
        return out

    def leaks(self, text: str) -> list:
        found = []
        for name, pat in _LEAK_PATTERNS:
            if pat.search(text):
                found.append(name)
        low = text.lower()
        for lit in self.literal_checks:
            if lit.lower() in low:
                found.append("literal:" + lit)
        for term, pat in self.term_checks:
            if pat.search(text):
                found.append("term:" + term)
        return found
