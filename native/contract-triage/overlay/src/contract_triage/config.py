"""Server settings, read from environment variables or a .env file.

Blueprint 2.1 and 3.1. One setting, DATA_BACKEND, chooses where the tools read:
  snapshot   -> Parquet files committed under src/contract_triage/data/ (no login, no keys)
  databricks -> gold views in Unity Catalog through a SQL warehouse (the deployed app)
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PACKAGE_DATA = Path(__file__).resolve().parent / "data"
_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,127}$")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Transport (unchanged from the template)
    mcp_transport: str = "stdio"
    mcp_host: str = "0.0.0.0"
    mcp_port: int = 8000

    # Where the tools read
    data_backend: Literal["snapshot", "databricks"] = "snapshot"
    snapshot_dir: str = ""  # empty -> the package's data/ folder

    # Databricks backend. The app injects DATABRICKS_HOST / CLIENT_ID / CLIENT_SECRET.
    databricks_warehouse_id: str = ""
    databricks_catalog: str = ""
    databricks_schema: str = "contract_triage"

    # Public API keys. Locally from .env; on Databricks from a secret via valueFrom.
    sam_api_key: str = ""
    datagov_api_key: str = ""

    # Live award brief: cache responses to protect the SAM.gov daily quota.
    cache_ttl_seconds: int = 86_400

    @field_validator("databricks_catalog", "databricks_schema")
    @classmethod
    def _plain_identifier(cls, v: str) -> str:
        # Catalog and schema go into SQL text, so only plain identifiers are allowed.
        if v and not _IDENT.match(v):
            raise ValueError("catalog and schema must be plain identifiers")
        return v

    @property
    def snapshot_path(self) -> Path:
        return Path(self.snapshot_dir) if self.snapshot_dir else PACKAGE_DATA


settings = Settings()
