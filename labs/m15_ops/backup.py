"""Back up what cannot be reproduced, and prove the backup restores."""
from __future__ import annotations

import sqlite3
import time
from pathlib import Path


# region: backup
def backup(db_path: Path, dest_dir: Path, keep: int = 7) -> Path:
    """Online backup: consistent even while the database is being written."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{db_path.stem}-{time.strftime('%Y%m%d-%H%M%S')}.db"
    src, out = sqlite3.connect(str(db_path)), sqlite3.connect(str(dest))
    with out:
        src.backup(out)
    src.close()
    out.close()
    for old in sorted(dest_dir.glob(f"{db_path.stem}-*.db"))[:-keep]:      # keep the newest N
        old.unlink()
    return dest


def restore_test(live: Path, backup_file: Path, tables: list) -> dict:
    """A backup that was never restored is a hope. Open it, check integrity, compare row counts."""
    a, b = sqlite3.connect(str(live)), sqlite3.connect(str(backup_file))
    ok = b.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    counts = {t: (a.execute(f"SELECT count(*) FROM {t}").fetchone()[0],
                  b.execute(f"SELECT count(*) FROM {t}").fetchone()[0]) for t in tables}
    a.close()
    b.close()
    return {"integrity": ok, "counts": counts, "match": ok and all(x == y for x, y in counts.values())}
# endregion
