"""Background work that yields to live traffic.

A busy marker is a file. The server touches it for the whole length of a request
(including a streamed answer) and removes it after. The scheduler runs jobs in
small units and checks the marker between units.
"""
from __future__ import annotations

import time
from contextlib import contextmanager
from pathlib import Path
from typing import Callable, Iterable


# region: busy
@contextmanager
def busy(marker: Path):
    """Wrap every live request in this."""
    marker.write_text(str(time.time()))
    try:
        yield
    finally:
        marker.unlink(missing_ok=True)


def is_busy(marker: Path, stale_after: float = 600) -> bool:
    """A marker older than stale_after is from a crashed request and is ignored."""
    try:
        return time.time() - marker.stat().st_mtime < stale_after
    except FileNotFoundError:
        return False
# endregion


# region: scheduler
def run_window(jobs: Iterable, marker: Path, window_s: float, duty: float = 0.5,
               clock: Callable = time.time, sleep: Callable = time.sleep) -> list:
    """jobs yields (name, unit_fn). Each unit is small enough to finish in seconds.

    duty      share of the window background work may use; the rest stays idle
    preempt   before every unit, if a live request is in flight, wait
    """
    log, start, worked = [], clock(), 0.0
    for name, unit in jobs:
        while is_busy(marker):
            log.append((name, "waited: live request"))
            sleep(0.05)
        if clock() - start >= window_s:
            log.append((name, "skipped: window closed"))
            continue
        if worked >= duty * window_s:
            log.append((name, "skipped: duty budget spent"))
            continue
        t0 = clock()
        unit()
        worked += clock() - t0
        log.append((name, "ran"))
    return log
# endregion
