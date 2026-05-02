"""Staff model — kiosk-scoped user records with 4-digit PIN."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

StaffRole = Literal["Kasir", "Produksi", "Kurir"]


class StaffBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    role: StaffRole
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
