"""python3 -m labs.m10_guard.run_tests   (run before every change to the guard)"""
from __future__ import annotations

import sys
import unittest

from labs.m10_guard import test_guard


def main() -> int:
    suite = unittest.defaultTestLoader.loadTestsFromModule(test_guard)
    ids = [t.id() for s in suite for t in s]          # read before running: a run empties the suite
    result = unittest.TextTestRunner(stream=open("/dev/null", "w"), verbosity=0).run(suite)
    failed = {t.id() for t, _ in result.failures + result.errors}
    for i in ids:
        print(("FAIL " if i in failed else "ok   ") + i.split(".", 3)[-1])
    print(f"{result.testsRun} tests, {len(failed)} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
