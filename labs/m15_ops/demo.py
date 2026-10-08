"""python3 -m labs.m15_ops.demo"""
from __future__ import annotations

import threading
import time

from labs.common.paths import work
from labs.m02_gateway.gateway import serve
from labs.m02_gateway.keys import KeyStore
from labs.m05_rag.demo import build
from labs.m15_ops.backup import backup, restore_test
from labs.m15_ops.scheduler import busy, run_window
from labs.m15_ops.status import report


def main():
    w = work("m15", fresh=True)
    server, base = serve(KeyStore(w / "keys.db"))
    print("1 status:")
    print("   " + report({"gateway": base + "/health", "engine": "http://127.0.0.1:9/none"}).replace("\n", "\n   "))
    server.shutdown()

    marker = w / "BUSY"
    done = []

    def unit(n):
        return lambda: (time.sleep(0.03), done.append(n))

    def live_request():
        time.sleep(0.04)
        with busy(marker):                    # a chat arrives while the learner is working
            time.sleep(0.15)

    t = threading.Thread(target=live_request)
    t.start()
    log = run_window([(f"study-{i}", unit(i)) for i in range(6)], marker, window_s=5, duty=1.0)
    t.join()
    waited = sum(1 for _, s in log if s.startswith("waited"))
    print("2 scheduler: units run", done, "| paused", "yes" if waited else "no", "while a live request held the marker")
    log = run_window([(f"study-{i}", unit(i)) for i in range(6)], marker, window_s=0.2, duty=0.5)
    print("3 duty 50% of a 0.2 s window:", [s.split(":")[0] for _, s in log])

    db, _ = build()
    db.commit()
    live = work("m05") / "agent.db"
    dest = backup(live, w / "backups")
    print("4 backup:", dest.name[:9] + "...db", "| restore test:", restore_test(live, dest, ["kb_chunks", "kb_edges"]))
    print("5 unit templates:", sorted(p.name for p in (work("m15").parent.parent / "m15_ops" / "units").iterdir()))


if __name__ == "__main__":
    main()
