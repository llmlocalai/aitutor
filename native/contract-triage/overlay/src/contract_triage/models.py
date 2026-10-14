"""Pydantic models and enums for tool inputs and the evidence block (Blueprint 2.2).

Bounded inputs give the model a precise schema, and FastMCP rejects a bad value
before the tool runs, with a message that names the field and the bound.
"""

from __future__ import annotations

from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field

# GSA awarding office codes are six characters, letters and digits (e.g. 47QFLA).
OfficeCode = Annotated[
    str,
    Field(
        pattern=r"^[A-Z0-9]{6}$",
        description="Six-character awarding office code, e.g. 47QFLA. "
        "Use contracts_find_office first if you only have a name.",
    ),
]
DaysAhead = Annotated[
    int, Field(ge=1, le=730, description="Window after the data date, 1 to 730 days.")
]
PageSize = Annotated[int, Field(ge=1, le=50, description="Items per page, 1 to 50.")]
Offset = Annotated[int, Field(ge=0, description="Items to skip, from next_offset.")]


class ResponseFormat(str, Enum):
    JSON = "json"
    MARKDOWN = "markdown"


class PaginationParams(BaseModel):
    """Kept from the template for list tools that page."""

    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class EndingSort(str, Enum):
    END_DATE = "end_date"
    REMAINING_OPTION_VALUE = "remaining_option_value"
    CURRENT_VALUE = "current_value"


class CloseoutBasis(str, Enum):
    """Which closeout signal decides that an ended award is still open."""

    BOTH = "both"  # no K action in USAspending AND not closed in SAM.gov
    USASPENDING_K = "usaspending_k"  # no K action in USAspending (ignore SAM.gov)
    SAM_CLOSED = "sam_closed"  # not closed in SAM.gov (ignore K actions)


class Evidence(BaseModel):
    """Attached to every result so an answer can be traced to rows and sources."""

    award_keys: list[str] = Field(default_factory=list)
    fields_used: list[str] = Field(default_factory=list)
    data_date: str = ""
    sources: list[str] = Field(default_factory=list)
    note: str = ""
