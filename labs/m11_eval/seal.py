"""Seal the test material before anything learns.

Two things are sealed:
  frozen/   human-written questions and gold sets, copied in and hashed
  heldout   a sample of chunk ids marked in the database, so a learner must skip them

The seal is a manifest of SHA-256 hashes. Every eval run verifies it first and
refuses to run if a sealed file changed. File permissions are set to read-only
too, but the hash check is what holds on every operating system and for every user.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import sqlite3
from pathlib import Path

HERE = Path(__file__).parent


# region: seal
def seal(db: sqlite3.Connection, eval_dir: Path, heldout_every: int = 4) -> dict:
    frozen = eval_dir / "frozen"
    if (eval_dir / "SEAL.json").exists():
        raise RuntimeError("already sealed. Sealing happens once. Make a new versioned set instead of resealing.")
    frozen.mkdir(parents=True)
    hashes = {}
    for name in ("frozen_questions.json", "gold_v1.json"):
        dest = frozen / name
        shutil.copy2(HERE / name, dest)
        hashes[name] = hashlib.sha256(dest.read_bytes()).hexdigest()
        os.chmod(dest, 0o444)
    ids = [r[0] for r in db.execute("SELECT chunk_id FROM kb_chunks ORDER BY chunk_id")]
    # Deterministic sample: the same chunks are held out on every machine.
    held = [c for c in ids if int(hashlib.md5(c.encode()).hexdigest(), 16) % heldout_every == 0]
    db.executemany("UPDATE kb_chunks SET heldout=1 WHERE chunk_id=?", [(c,) for c in held])
    db.commit()
    manifest = {"files": hashes, "heldout_chunks": held}
    (eval_dir / "SEAL.json").write_text(json.dumps(manifest, indent=1))
    os.chmod(eval_dir / "SEAL.json", 0o444)
    return manifest


def assert_sealed(eval_dir: Path) -> dict:
    """Call at the top of every eval. Raises if any sealed file differs from its recorded hash."""
    manifest = json.loads((eval_dir / "SEAL.json").read_text())
    for name, digest in manifest["files"].items():
        if hashlib.sha256((eval_dir / "frozen" / name).read_bytes()).hexdigest() != digest:
            raise RuntimeError(f"SEAL BROKEN: {name} changed after sealing. Results from this set are void.")
    return manifest


def studiable(db: sqlite3.Connection) -> list:
    """The only chunks a learning job may read."""
    return [r[0] for r in db.execute("SELECT chunk_id FROM kb_chunks WHERE NOT heldout AND NOT retired ORDER BY 1")]
# endregion
