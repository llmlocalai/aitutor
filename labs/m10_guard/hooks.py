"""Pre-tool hooks: policy enforced in code, before a tool runs."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

WRITE_TOOLS = {"write_file", "save_note"}


# region: hook
def write_path_guard(allowed_root: Path):
    """Build a hook that limits file writes to one folder. Return a reason to block, or None."""
    root = allowed_root.resolve()

    def hook(name: str, args: dict) -> Optional[str]:
        if name not in WRITE_TOOLS:
            return None
        target = (root / str(args.get("path", ""))).resolve()      # resolves ../ tricks and symlinks
        if root != target and root not in target.parents:
            return f"writes are limited to {root.name}/"
        return None
    return hook
# endregion
