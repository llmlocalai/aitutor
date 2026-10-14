"""Code shared by the Databricks notebooks and the laptop pipeline (Blueprint 1.2 to 1.6).

Keeping the column list, the SQL order, the SAM.gov record parser and the data quality
checks in one plain Python file means the laptop run (DuckDB) and the Databricks job
(Spark) execute the same logic. Nothing here imports Spark or DuckDB.
"""

from __future__ import annotations

import datetime as dt
import re
from pathlib import Path
from typing import Any, Callable

HERE = Path(__file__).resolve().parent
SQL_DIR = HERE.parent / "sql"

# The 36 columns bronze keeps from the 297 in a USAspending contracts archive CSV.
# Names checked against the header of FY2026_097_Contracts_Full_20260907_1.csv.
BRONZE_COLUMNS = [
    "contract_transaction_unique_key",
    "contract_award_unique_key",
    "award_id_piid",
    "modification_number",
    "transaction_number",
    "parent_award_agency_id",
    "parent_award_id_piid",
    "federal_action_obligation",
    "total_dollars_obligated",
    "current_total_value_of_award",
    "potential_total_value_of_award",
    "action_date",
    "action_date_fiscal_year",
    "period_of_performance_start_date",
    "period_of_performance_current_end_date",
    "period_of_performance_potential_end_date",
    "awarding_agency_code",
    "awarding_sub_agency_code",
    "awarding_office_code",
    "awarding_office_name",
    "recipient_uei",
    "recipient_name",
    "recipient_parent_uei",
    "award_type_code",
    "type_of_contract_pricing_code",
    "transaction_description",
    "prime_award_base_transaction_description",
    "action_type_code",
    "action_type",
    "solicitation_identifier",
    "product_or_service_code",
    "naics_code",
    "extent_competed_code",
    "number_of_offers_received",
    "usaspending_permalink",
    "last_modified_date",
]

# Build order. Each file is CREATE OR REPLACE, so a rerun gives the same tables.
SQL_ORDER = [
    "silver_contract_tx.sql",
    "silver_awards.sql",
    "gold_offices.sql",
    "gold_contracts_ending.sql",
    "gold_closeout_candidates.sql",
    "gold_vendor_share.sql",
]
GOLD = [
    "gold_offices",
    "gold_contracts_ending",
    "gold_closeout_candidates",
    "gold_vendor_share",
]

ARCHIVE_NAME = re.compile(
    r"^FY(?P<fy>\d{4})_(?P<agency>\d{3})_Contracts_Full_(?P<vintage>\d{8})(?:_\d+)?\.(zip|csv)$"
)


def sql_file(name: str) -> list[str]:
    """The statements of one file in sql/."""
    return statements((SQL_DIR / name).read_text())


def statements(text: str) -> list[str]:
    """Split SQL text on semicolons at line ends, dropping comment lines."""
    out, buf = [], []
    for line in text.splitlines():
        if line.strip().startswith("--"):
            continue
        buf.append(line)
        if line.rstrip().endswith(";"):
            stmt = "\n".join(buf).strip().rstrip(";").strip()
            if stmt:
                out.append(stmt)
            buf = []
    tail = "\n".join(buf).strip()
    if tail:
        out.append(tail)
    return out


def parse_archive_name(name: str) -> dict[str, Any] | None:
    m = ARCHIVE_NAME.match(Path(name).name)
    if not m:
        return None
    v = m.group("vintage")
    return {
        "fy": int(m.group("fy")),
        "agency": m.group("agency"),
        "vintage": dt.date(int(v[:4]), int(v[4:6]), int(v[6:])),
    }


def latest_full_per_fy(
    names: list[str], agency: str, fy_from: int, fy_to: int
) -> list[str]:
    """From a monthly file list, keep the newest Full archive for each fiscal year."""
    best: dict[int, tuple[dt.date, str]] = {}
    for n in names:
        p = parse_archive_name(n)
        if not p or p["agency"] != agency or not (fy_from <= p["fy"] <= fy_to):
            continue
        if p["fy"] not in best or p["vintage"] > best[p["fy"]][0]:
            best[p["fy"]] = (p["vintage"], n)
    return [best[k][1] for k in sorted(best)]


# --- SAM.gov Contract Awards records -------------------------------------------------


def _dig(rec: dict, *path: str) -> Any:
    cur: Any = rec
    for p in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(p)
    return cur


def iso_date(v: Any) -> str:
    """SAM.gov dates arrive as YYYY-MM-DD, MM/DD/YYYY or with a time part."""
    if not v:
        return ""
    s = str(v).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})", s)
    if m:
        return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    return ""


def parse_sam_record(rec: dict) -> dict[str, str]:
    """One awardSummary[] record to one bronze_sam_awards row (paths from open.gsa.gov)."""
    office = _dig(rec, "coreData", "contractingOffice", "code") or _dig(
        rec, "awardDetails", "contractingOffice", "code"
    )
    return {
        "piid": str(_dig(rec, "contractId", "piid") or ""),
        "referenced_idv_piid": str(_dig(rec, "contractId", "referencedIDVPiid") or ""),
        "modification_number": str(_dig(rec, "contractId", "modificationNumber") or ""),
        "contracting_office_code": str(office or ""),
        "closed_status": str(
            _dig(rec, "awardDetails", "transactionData", "closedStatus") or ""
        ),
        "closed_date": iso_date(
            _dig(rec, "awardDetails", "transactionData", "closedDate")
        ),
        "current_completion_date": iso_date(
            _dig(rec, "awardDetails", "dates", "currentCompletionDate")
        ),
        "ultimate_completion_date": iso_date(
            _dig(rec, "awardDetails", "dates", "ultimateCompletionDate")
        ),
        "date_signed": iso_date(_dig(rec, "awardDetails", "dates", "dateSigned")),
    }


def sam_records(payload: Any) -> list[dict]:
    """Accept a search page ({awardSummary: [...]}), a bare list, or JSON lines."""
    if isinstance(payload, dict):
        return list(payload.get("awardSummary") or payload.get("data") or [])
    if isinstance(payload, list):
        return payload
    return []


# --- Data quality checks (Blueprint 1.6) ---------------------------------------------

# (name, SQL returning one number, threshold, comparator, what it means)
DQ_CHECKS: list[tuple[str, str, float, str, str]] = [
    (
        "awards_with_end_date",
        "SELECT AVG(CASE WHEN current_end IS NOT NULL THEN 1.0 ELSE 0.0 END) FROM silver_awards",
        0.95,
        ">=",
        "share of awards with a current end date",
    ),
    (
        "awards_with_office_code",
        "SELECT AVG(CASE WHEN awarding_office_code IS NOT NULL AND awarding_office_code <> '' "
        "THEN 1.0 ELSE 0.0 END) FROM silver_awards",
        0.95,
        ">=",
        "share of awards with an awarding office code",
    ),
    (
        "duplicate_award_keys",
        "SELECT COUNT(*) - COUNT(DISTINCT award_key) FROM silver_awards",
        0,
        "==",
        "silver_awards must have one row per award",
    ),
    (
        "duplicate_transaction_keys",
        "SELECT COUNT(*) - COUNT(DISTINCT tx_key) FROM silver_contract_tx",
        0,
        "==",
        "two vintages of one fiscal year were loaded together",
    ),
    (
        "sam_closed_matched_to_usaspending",
        "SELECT CASE WHEN (SELECT COUNT(*) FROM bronze_sam_awards) = 0 THEN NULL ELSE "
        "(SELECT COUNT(DISTINCT s.piid) FROM bronze_sam_awards s JOIN silver_awards a "
        "ON a.piid = s.piid) * 1.0 / (SELECT COUNT(DISTINCT piid) FROM bronze_sam_awards) END",
        0.95,
        ">=",
        "closed SAM.gov PIIDs found in USAspending",
    ),
    (
        "k_vs_sam_agreement_on_ended",
        "SELECT AVG(CASE WHEN has_k_closeout = sam_closed THEN 1.0 ELSE 0.0 END) FROM silver_awards "
        "WHERE current_end < (SELECT MAX(data_date) FROM meta_freshness)",
        0.0,
        "report",
        "ended awards where the two closeout signals agree (a finding, not a gate)",
    ),
]


def evaluate(value: float | None, threshold: float, comparator: str) -> str:
    if comparator == "report":
        return "info"
    if value is None:
        return "skipped"
    ok = {">=": value >= threshold, "<=": value <= threshold, "==": value == threshold}[
        comparator
    ]
    return "pass" if ok else "fail"


def run_checks(scalar: Callable[[str], float | None]) -> list[dict[str, Any]]:
    """scalar(sql) returns the first column of the first row. Works for Spark and DuckDB."""
    out = []
    for name, sql, threshold, comparator, detail in DQ_CHECKS:
        try:
            v = scalar(sql)
            value = None if v is None else float(v)
            result = evaluate(value, threshold, comparator)
        except Exception as e:  # noqa: BLE001 - a broken check is a failed check
            value, result, detail = None, "fail", f"{detail}; error {type(e).__name__}"
        out.append(
            {
                "check_name": name,
                "value": value,
                "threshold": float(threshold),
                "comparator": comparator,
                "result": result,
                "detail": detail,
            }
        )
    return out
