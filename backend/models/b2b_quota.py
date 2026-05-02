"""B2B Quota model — contracted monthly kg quotas for partner institutions."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PartnerName = Literal["Tamel", "Laskita", "Kosan"]


class B2BQuotaBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    partner_name: PartnerName
    total_quota_kg: float = Field(..., gt=0)
    used_quota_kg: float = Field(default=0.0, ge=0)
    billing_period: str = Field(
        ..., description="ISO month string, e.g. '2026-02'", pattern=r"^\d{4}-\d{2}$"
    )


class B2BQuotaCreate(B2BQuotaBase):
    """Payload accepted by POST /api/b2b/quotas."""


class B2BQuota(B2BQuotaBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
