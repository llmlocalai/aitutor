"""python3 -m labs.m04_state.demo"""
from __future__ import annotations

import threading

from labs.common.paths import work
from labs.m04_state.store import append_log, connect, ensure_schema, merge_state, read_new_lines


def main():
    w = work("m04", fresh=True)
    db = connect(w / "agent.db")
    ensure_schema(db)
    ensure_schema(db)
    tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'kb_fts_%' ORDER BY 1")]
    print("1 schema, applied twice :", ", ".join(tables))

    state = {"messages": [{"role": "user", "content": "q"}]}
    for update in ({"messages_append": [{"role": "tool", "content": "A"}], "model_calls": 1, "last_node": "tool:a"},
                   {"messages_append": [{"role": "tool", "content": "B"}], "model_calls": 1, "last_node": "tool:b"}):
        merge_state(state, update)
    print("2 two nodes merged      :", [m["content"] for m in state["messages"]],
          "model_calls =", state["model_calls"], "last_node =", state["last_node"])

    def writer(name):
        c = connect(w / "agent.db")
        for i in range(200):
            c.execute("INSERT INTO conv_turns (partition, thread, role, content, ts) VALUES (?,?,?,?,0)",
                      (name, "t1", "user", f"{name}-{i}"))
            c.commit()
        c.close()

    threads = [threading.Thread(target=writer, args=(n,)) for n in ("chat", "nightly-job", "eval-job")]
    [t.start() for t in threads]
    [t.join() for t in threads]
    print("3 three writers at once :", db.execute("SELECT count(*) FROM conv_turns").fetchone()[0], "rows, none lost")

    log = w / "tool_calls.jsonl"
    for i in range(3):
        append_log(log, {"tool": "search", "n": i})
    first = read_new_lines(db, "self_observe", log)
    append_log(log, {"tool": "search", "n": 3})
    second = read_new_lines(db, "self_observe", log)
    third = read_new_lines(db, "self_observe", log)
    print("4 cursor                :", len(first), "lines, then", len(second), "new, then", len(third))

    db.executescript("DROP TABLE brain_evidence; DROP TABLE brain_claims;")
    left = db.execute("SELECT count(*) FROM sqlite_master WHERE name IN ('kb_chunks','kb_edges','kb_fts')").fetchone()[0]
    print("5 dropped brain_* tables:", left, "of 3 kb_* tables still there")


if __name__ == "__main__":
    main()
