"""B2B Quota model — contracted monthly kg quotas for partner institutions."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field


class B2BQuotaBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    partner_id: str = Field(..., min_length=1, description="Stable slug e.g. 'tamel'")
    partner_name: str = Field(..., min_length=1, description="Display name")
    total_quota_kg: float = Field(..., gt=0)
    used_quota_kg: float = Field(default=0.0, ge=0)
    billing_period: str = Field(
        ..., description="ISO month string, e.g. '2026-02'", pattern=r"^\d{4}-\d{2}$"
    )


class B2BQuotaCreate(B2BQuotaBase):
    """Payload accepted by POST /api/b2b_quotas."""


class B2BQuotaUsageUpdate(BaseModel):
    """Body for PATCH /api/b2b_quotas/{partner_id}/usage.

    Positive `delta_kg` adds to `used_quota_kg`; negative subtracts (e.g. refund).
    """

    delta_kg: float = Field(..., description="kg to add to used_quota_kg (can be negative)")


class B2BQuota(B2BQuotaBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
