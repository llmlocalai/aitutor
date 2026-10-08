"""Run: python3 sync/test_scrub.py"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scrub import Scrubber  # noqa: E402

cfg = json.loads((Path(__file__).parent / "config.json").read_text())

MUST_CLEAN = [
    "PY=/Volumes/AI_DATA/apps/agent-server/venv/bin/python3",
    "open http://llmpowerhouse.local:8080 or https://llmpowerhouse.tail1234.ts.net:8443",
    "launchd label com.llmpowerhouse.agent-server on port :8788",
    "BRAINBANK_PARTITION_KEY=abc123def456 and API_TOKEN: 'zzzzzzzzzzzz'",
    "Authorization: Bearer abcdefghijklmnop1234",
    "key sk-proj-ABCDEFGHIJKLMNOP1234 and hash 0123456789abcdef0123456789abcdef",
    "mail someone@example.com from /Users/somebody/Desktop at 192.168.1.44",
    "DOD-FM search works again; DoD FM regulations per the FMR and DODIG",
    "Claim judges: Department of War and Department of Defense are one name",
    "USAspending collector: fiscal-year scope",
    "skills/dod-fm-citation.md and kb_dodfm chunks, K12 FCPS TJHSST Fairfax",
    "asked about lobster purchases",
]
MUST_KEEP = [
    "Search returns one copy of a paragraph that is in several files",
    "curl http://127.0.0.1:11434/v1/chat/completions",
    "hit@10 0.85 mrr 0.642 at 72 tok/s",
    "the task-list and risk-adjusted keys_admin.py module",
]

fails = 0
s = Scrubber(cfg)
for t in MUST_CLEAN:
    out = s.scrub(t)
    left = s.leaks(out)
    if left or out == t:
        fails += 1
        print("FAIL clean:", t, "->", out, left)
for t in MUST_KEEP:
    out = s.scrub(t)
    if out != t or s.leaks(out):
        fails += 1
        print("FAIL keep :", t, "->", out, s.leaks(out))
# an unscrubbed leak must be detected
for t in ["see /Volumes/Other/x", "host box.ts.net", "DoD budget", "a@b.co"]:
    if not s.leaks(t):
        fails += 1
        print("FAIL detect:", t)
print("scrub tests:", "ok" if not fails else f"{fails} failed")
sys.exit(1 if fails else 0)
