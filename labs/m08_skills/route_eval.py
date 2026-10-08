"""python3 -m labs.m08_skills.route_eval

Score the skill router with requests it never saw. The gold file is sealed:
copied read-only with its hash recorded, and checked before every run.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
from pathlib import Path

from labs.common.paths import work
from labs.m08_skills.loader import HERE, Router


# region: route-eval
def seal_gold(dest_dir: Path) -> Path:
    dest = dest_dir / "routing_gold.json"
    shutil.copy2(HERE / "routing_gold.json", dest)
    os.chmod(dest, 0o444)
    (dest_dir / "SEAL.json").write_text(json.dumps({"routing_gold.json": hashlib.sha256(dest.read_bytes()).hexdigest()}))
    return dest


def check_seal(dest_dir: Path) -> None:
    want = json.loads((dest_dir / "SEAL.json").read_text())["routing_gold.json"]
    if hashlib.sha256((dest_dir / "routing_gold.json").read_bytes()).hexdigest() != want:
        raise RuntimeError("SEAL BROKEN: routing gold changed after sealing")


def evaluate(router: Router, dest_dir: Path) -> dict:
    check_seal(dest_dir)
    items = json.loads((dest_dir / "routing_gold.json").read_text())["items"]
    exemplars = json.loads((HERE / "routing.json").read_text())
    leaked = [i["q"] for i in items if any(i["q"] in v for k, v in exemplars.items() if not k.startswith("_note"))]
    if leaked:
        raise RuntimeError(f"gold items copied into routing.json: {leaked}")
    misses = []
    for i in items:
        got = (router.match(i["q"]) or {}).get("name", "none")
        if got != i["skill"]:
            misses.append((i["q"], i["skill"], got))
    return {"n": len(items), "accuracy": round(1 - len(misses) / len(items), 3), "misrouted": misses}
# endregion


def main():
    d = work("m08e", fresh=True)
    seal_gold(d)
    r = evaluate(Router(), d)
    print(f"1 routing accuracy on {r['n']} unseen requests: {r['accuracy']}")
    for q, want, got in r["misrouted"]:
        print(f"  misrouted: {q!r}  wanted {want}, got {got}")
    print("2 exemplars and gold kept apart: no gold item found in routing.json")


if __name__ == "__main__":
    main()
