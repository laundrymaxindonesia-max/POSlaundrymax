"""Price model — one row per service category with multi-tier prices.

Shape matches the Admin "Pengaturan Harga" grid. Pricing now includes a
4th `umum` column (Walk-in / general public), in addition to the existing
Tamel / Laskita / Kostunpad-Member tiers.

Speed-tier categories (Reguler / Flash / Express) for Kiloan are encoded
via separate service_id rows: `kiloan_reguler`, `kiloan_flash`,
`kiloan_express`. Satuan & Sepatu use a single base row + client-side
multiplier. Showcase is a flat retail price (no speed tier).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field


class PriceBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    service_id: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    unit: str = Field(..., min_length=1, description="e.g. '/kg', '/pcs', '/m²'")
    umum: int = Field(default=0, ge=0, description="Umum / Walk-in tier price (IDR)")
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


# Kept for backward compat with `from models import ... ServiceId`.
ServiceId = str
