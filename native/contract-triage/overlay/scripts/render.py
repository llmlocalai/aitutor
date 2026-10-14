"""Fill ${NAME} placeholders from the environment, and refuse to leave any unfilled.

  set -a; source ~/.contract-triage.env; set +a
  python3 scripts/render.py pipelines/job.template.json > /tmp/job.json
  python3 scripts/render.py sql/grants.template.sql

Used for the job definition (Blueprint 1.7) and the grants (3.2), which name your
catalog, your Git folder and your app's service principal. Stdlib only.
"""

from __future__ import annotations

import os
import re
import sys

text = open(sys.argv[1]).read()
names = sorted(set(re.findall(r"\$\{([A-Z_][A-Z0-9_]*)\}", text)))
missing = [n for n in names if not os.environ.get(n)]
if missing:
    sys.exit(f"set these first: {', '.join(missing)}")
print(
    re.sub(r"\$\{([A-Z_][A-Z0-9_]*)\}", lambda m: os.environ[m.group(1)], text), end=""
)
