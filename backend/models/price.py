"""Price model — multi-tier pricing matrix managed by Admin."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ServiceType = Literal["Kiloan", "Satuan"]
PriceTier = Literal["Tamel", "Laskita", "Umum"]


class PriceBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    service_type: ServiceType
    tier: PriceTier
    price: int = Field(..., ge=0, description="IDR per kg (Kiloan) or per item (Satuan)")


class PriceCreate(PriceBase):
    """Payload accepted by POST/PUT /api/prices."""


class Price(PriceBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
