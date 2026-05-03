"""Price model — one row per service category with 3 tier prices.

Shape matches the Admin "Pengaturan Harga" grid (6 service rows × 3 tier columns).
This lets the frontend POST the whole grid as-is via POST /api/prices/bulk.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ServiceId = Literal["kiloan", "satuan", "jas", "sepatu", "karpet", "showcase"]


class PriceBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    service_id: ServiceId
    label: str = Field(..., min_length=1)
    unit: str = Field(..., min_length=1, description="e.g. '/kg', '/pcs', '/m²'")
    tamel: int = Field(..., ge=0, description="Tamel tier price (IDR)")
    laskita: int = Field(..., ge=0, description="Laskita tier price (IDR)")
    member: int = Field(..., ge=0, description="Kostunpad/Member tier price (IDR)")


class PriceCreate(PriceBase):
    """Payload accepted by the bulk-replace endpoint."""


class Price(PriceBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
