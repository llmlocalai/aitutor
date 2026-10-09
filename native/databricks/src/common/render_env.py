"""Write per-environment values into an app's app.yaml before deploy (CI runs it; the repo keeps dev values).

  python render_env.py app/app.yaml AGENT_CATALOG=fin_stg PGHOST=$LAKEBASE_HOST DATABRICKS_WAREHOUSE_ID=@sql_warehouse

KEY=value sets a literal; KEY=@name sets valueFrom: name (an app resource). Existing entries with the same
name are replaced, others are kept. merge_env() is pure and tested. The rewritten file loses comments,
which is fine: it is a build output in the CI workspace, never committed.
"""
from __future__ import annotations

import sys


def merge_env(doc: dict, pairs: list) -> dict:
    env = list(doc.get("env") or [])
    for pair in pairs:
        if "=" not in pair:
            raise ValueError(f"expected KEY=value or KEY=@resource, got {pair!r}")
        key, val = pair.split("=", 1)
        if not val or val.startswith("<"):
            raise ValueError(f"{key} has no value (placeholder {val!r}); set the CI variable for this environment")
        entry = {"name": key, "valueFrom": val[1:]} if val.startswith("@") else {"name": key, "value": val}
        env = [e for e in env if e.get("name") != key] + [entry]
    return {**doc, "env": env}


if __name__ == "__main__":  # pragma: no cover
    import yaml
    path, pairs = sys.argv[1], sys.argv[2:]
    doc = yaml.safe_load(open(path)) or {}
    out = merge_env(doc, pairs)
    yaml.safe_dump(out, open(path, "w"), sort_keys=False)
    print(f"{path}: " + ", ".join(e["name"] for e in out["env"]))
