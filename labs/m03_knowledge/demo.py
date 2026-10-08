"""python3 -m labs.m03_knowledge.demo"""
from __future__ import annotations

import shutil

from labs.common.paths import DATA, work
from labs.m03_knowledge.ledger import Ledger, process_inbox, scan_bank


def build(fresh: bool = True):
    """Used by later labs too: a private copy of the sample bank plus its ledger."""
    w = work("m03", fresh=fresh)
    bank, inbox = w / "bank", w / "inbox"
    if not bank.exists():
        shutil.copytree(DATA / "bank", bank)
        shutil.copytree(DATA / "inbox", inbox)
    ledger = Ledger(w / "ledger.db")
    return w, bank, inbox, ledger


def main():
    w, bank, inbox, ledger = build()
    print("first scan :", scan_bank(ledger, "POLICY", bank))
    print("second scan:", scan_bank(ledger, "POLICY", bank), "(nothing re-read as new)")
    print("inbox:")
    for name, verdict, detail in process_inbox(ledger, "POLICY", inbox, bank,
                                               {"remote-work-policy.md": "policy", "vendor-rates.pdf": "guides"}):
        print(f"  {name:26s} {verdict:9s} {detail}")
    ledger.retire("POLICY", "guides/vendor-rates.pdf", "placeholder file, superseded")
    print("ledger:")
    for source, tier, kind, status, note in ledger.rows("POLICY"):
        print(f"  tier {tier} {kind:11s} {status:9s} {source}{'  <- ' + note if note else ''}")


if __name__ == "__main__":
    main()
