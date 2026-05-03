"""Staff model — kiosk-scoped user records with 4-digit PIN."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

StaffRole = Literal["Kasir", "Produksi", "Kurir"]


class StaffBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(..., min_length=1)
    role: StaffRole
    display_role: Optional[str] = Field(
        default=None,
        description="Optional human-friendly role shown in the kiosk UI, e.g. 'Operator Cuci'",
    )
    pin_code: str = Field(
        ..., min_length=4, max_length=4, pattern=r"^\d{4}$",
        description="4-digit kiosk PIN"
    )


class StaffCreate(StaffBase):
    """Payload accepted by POST /api/staff."""


class Staff(StaffBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class StaffPublic(BaseModel):
    """Safe shape returned by GET /api/staff — never leaks pin_code."""

    id: str
    name: str
    role: StaffRole
    display_role: Optional[str] = None
