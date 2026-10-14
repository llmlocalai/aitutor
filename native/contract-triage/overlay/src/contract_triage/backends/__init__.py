"""Pick the backend once per process from settings.data_backend."""

from __future__ import annotations

from functools import lru_cache

from contract_triage.backends.base import Backend
from contract_triage.config import settings


@lru_cache(maxsize=1)
def get_backend() -> Backend:
    if settings.data_backend == "databricks":
        from contract_triage.backends.databricks_sql import DatabricksSqlBackend

        return DatabricksSqlBackend(
            settings.databricks_warehouse_id,
            settings.databricks_catalog,
            settings.databricks_schema,
        )
    from contract_triage.backends.snapshot import SnapshotBackend

    return SnapshotBackend(settings.snapshot_path)


__all__ = ["Backend", "get_backend"]
