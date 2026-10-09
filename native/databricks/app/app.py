"""Step 15. The reviewer app: a Databricks App where people approve or reject the agent's proposals.

Two identities, on purpose:
  the user (on-behalf-of, x-forwarded-access-token): reads Unity Catalog data AS THE REVIEWER, so the
      business-unit row filter and the bank-account mask from step 4 apply to what they see
  the app's service principal: reads and writes the Lakebase review queue, which has no UC policies,
      so this code filters the queue to the units the user's own UC query returned
Enable user authorization with the `sql` scope on the app (UI: User authorization > Add scope).
"""
from __future__ import annotations

import json
import os

import yaml

from databricks import sql
from databricks.sdk import WorkspaceClient
from databricks.sdk.core import Config
from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from review_logic import decide, row_html, same_origin
from pg import pool

CATALOG = os.environ["AGENT_CATALOG"]                  # rendered per environment by CI; no dev default
WAREHOUSE_ID = os.environ["DATABRICKS_WAREHOUSE_ID"]
# The two-person threshold comes from the contract CI copies next to this file, so the app, the agent
# and the database trigger (checked by a test) use one number.
_here = os.path.dirname(os.path.abspath(__file__))
_contract = next((p for p in (os.path.join(_here, "contract.yml"), os.path.join(_here, "..", "contract.yml"))
                 if os.path.exists(p)), os.path.join(_here, "contract.yml"))   # deployed copy, else repo root
with open(_contract) as _f:
    TWO_PERSON = float(yaml.safe_load(_f)["human_in_the_loop"]["second_approver_above"])
cfg = Config()
app = FastAPI()


def user_token(req: Request) -> str:
    tok = req.headers.get("x-forwarded-access-token")
    if not tok:
        raise HTTPException(401, "user authorization is not enabled for this app")
    return tok


def whoami(tok: str) -> str:
    return WorkspaceClient(host=cfg.host, token=tok, auth_type="pat").current_user.me().user_name


def my_units(tok: str) -> set:
    """Business units the reviewer decides, asked AS the reviewer. Only members of fin-reviewers who are not
    auditors decide: auditors see everything by policy, and seeing is not deciding (segregation of duties)."""
    with sql.connect(server_hostname=cfg.host.replace("https://", ""), http_path=f"/sql/1.0/warehouses/{WAREHOUSE_ID}",
                     access_token=tok) as conn, conn.cursor() as cur:
        cur.execute("SELECT is_account_group_member('fin-reviewers') AND NOT is_account_group_member('fin-auditors')")
        if not cur.fetchone()[0]:
            return set()
        cur.execute(f"SELECT business_unit FROM {CATALOG}.gold.reviewer_scope WHERE reviewer = current_user()")
        return {r[0] for r in cur.fetchall()}


def origin_ok(req: Request) -> bool:
    h = req.headers
    return same_origin(h.get("origin"), h.get("referer"), h.get("host"), h.get("x-forwarded-host"),
                       os.environ.get("APP_HOSTS", ""))


@app.get("/", response_class=HTMLResponse)
def queue(req: Request):
    tok = user_token(req)
    units = my_units(tok)
    with pool().connection() as conn:
        cur = conn.execute(
            """SELECT proposal_id, exception_type, business_unit, invoice_amount, action, rationale, citations,
                      confidence, status FROM proposals
               WHERE status IN ('pending', 'needs_second') AND business_unit = ANY(%s)
               ORDER BY invoice_amount DESC LIMIT 200""", (list(units),))
        cols = [d.name for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    body = "".join(row_html(r) for r in rows) or "<tr><td colspan=7>Nothing to review in your business units.</td></tr>"
    return f"""<!doctype html><meta charset=utf-8><title>Spend exceptions review</title>
<style>body{{font:14px system-ui;margin:24px}}table{{border-collapse:collapse;width:100%}}td,th{{border-bottom:1px solid #ddd;
padding:8px;vertical-align:top;text-align:left}}.num{{text-align:right}}.why{{color:#444;max-width:60ch}}.cite{{font:12px monospace;color:#777}}</style>
<h1>Proposals to review</h1><p>{len(rows)} open in {len(units)} business units.</p>
<table><tr><th>Type</th><th>Unit</th><th>Amount</th><th>Proposal</th><th>Conf.</th><th>Status</th><th></th></tr>{body}</table>"""


@app.post("/decide/{proposal_id}")
def decide_route(proposal_id: str, req: Request, verdict: str = Form(...), correct_action: str = Form("")):
    if not origin_ok(req):
        raise HTTPException(403, "cross-site request refused")
    tok = user_token(req)
    reviewer, units = whoami(tok), my_units(tok)
    with pool().connection() as conn:
        row = conn.execute("SELECT proposal_id, business_unit, invoice_amount, status, action FROM proposals "
                           "WHERE proposal_id = %s FOR UPDATE", (proposal_id,)).fetchone()   # lock: two reviewers, one decision
        if not row:
            raise HTTPException(404, "no such proposal")
        p = dict(zip(("proposal_id", "business_unit", "invoice_amount", "status", "action"), row))
        prior = [r[0] for r in conn.execute("SELECT reviewer FROM decisions WHERE proposal_id = %s AND verdict LIKE '%%approve'",
                                            (proposal_id,)).fetchall()]
        try:
            status, dverdict = decide(p, reviewer, verdict, units, prior, TWO_PERSON, correct_action or None)
        except PermissionError as e:
            raise HTTPException(403, str(e))
        except ValueError as e:
            raise HTTPException(409, str(e))
        conn.execute("INSERT INTO decisions (proposal_id, reviewer, verdict, correct_action) VALUES (%s, %s, %s, %s)",
                     (proposal_id, reviewer, dverdict, correct_action or None))
        conn.execute("UPDATE proposals SET status = %s WHERE proposal_id = %s", (status, proposal_id))
    print(json.dumps({"event": "decision", "proposal_id": proposal_id, "reviewer": reviewer, "status": status}))
    return RedirectResponse("/", status_code=303)
