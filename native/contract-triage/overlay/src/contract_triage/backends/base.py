"""The data backend contract (Blueprint 2.1).

Tools never write SQL. They call one method per gold view. Both backends run the same
query text, so a parity test can compare them row for row. Values are bound as
parameters, never formatted into the SQL string.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import Any, Protocol

QUERIES = {
    "offices": "SELECT * FROM {t}gold_offices ORDER BY award_count DESC",
    "ending": "SELECT * FROM {t}gold_contracts_ending WHERE awarding_office_code = :office",
    "closeout": "SELECT * FROM {t}gold_closeout_candidates WHERE awarding_office_code = :office",
    "vendor": "SELECT * FROM {t}gold_vendor_share WHERE awarding_office_code = :office",
    "award": "SELECT * FROM {t}silver_awards WHERE award_key = :award OR piid = :award",
    "data_date": "SELECT MAX(data_date) AS data_date FROM {t}meta_freshness",
}


def plain(v: Any) -> Any:
    """Make a database value JSON-safe: dates to ISO text, decimals (money) to floats.
    Doubles such as shares and HHI pass through unrounded; tools round for display."""
    if isinstance(v, (dt.date, dt.datetime)):
        return v.isoformat()[:10]
    if isinstance(v, Decimal):
        # Counts can arrive as DECIMAL(38,0) from Parquet; money keeps its cents.
        return (
            int(v)
            if v == v.to_integral_value() and v.as_tuple().exponent >= 0
            else float(v)
        )
    return v


def rows_to_dicts(cols: list[str], rows: list[tuple]) -> list[dict[str, Any]]:
    return [{c: plain(v) for c, v in zip(cols, r)} for r in rows]


class Backend(Protocol):
    name: str

    def offices(self) -> list[dict[str, Any]]: ...
    def contracts_ending(self, office: str) -> list[dict[str, Any]]: ...
    def closeout_candidates(self, office: str) -> list[dict[str, Any]]: ...
    def vendor_share(self, office: str) -> list[dict[str, Any]]: ...
    def award(self, award: str) -> list[dict[str, Any]]: ...
    def data_date(self) -> str: ...


class SqlBackend:
    """Shared method bodies; subclasses provide _run(sql, params) and the table prefix."""

    name = "sql"
    prefix = ""

    def _run(self, sql: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        raise NotImplementedError

    def _q(self, key: str, **params: Any) -> list[dict[str, Any]]:
        return self._run(QUERIES[key].format(t=self.prefix), params)

    def offices(self) -> list[dict[str, Any]]:
        return self._q("offices")

    def contracts_ending(self, office: str) -> list[dict[str, Any]]:
        return self._q("ending", office=office)

    def closeout_candidates(self, office: str) -> list[dict[str, Any]]:
        return self._q("closeout", office=office)

    def vendor_share(self, office: str) -> list[dict[str, Any]]:
        return self._q("vendor", office=office)

    def award(self, award: str) -> list[dict[str, Any]]:
        return self._q("award", award=award)

    def data_date(self) -> str:
        rows = self._q("data_date")
        return str(rows[0]["data_date"] or "") if rows else ""
