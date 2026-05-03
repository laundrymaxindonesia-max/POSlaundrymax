"""Customer model — walk-in and B2B membership customers."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

CustomerType = Literal["Regular", "Member"]
MemberTier = Literal["Silver", "Gold", "Platinum"]


class CustomerBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(..., min_length=1)
    phone: str = Field(..., min_length=1)
    address: Optional[str] = None
    type: CustomerType = "Regular"
    member_tier: Optional[MemberTier] = None
    remaining_quota_kg: Optional[float] = Field(default=None, ge=0)
    quota_expiry_date: Optional[datetime] = None


class CustomerCreate(CustomerBase):
    """Payload accepted by POST /api/customers."""


class QuotaDeduction(BaseModel):
    """Body for PATCH /api/customers/{id}/deduct."""

    kg: float = Field(..., gt=0, description="Kilograms to deduct from remaining quota")
    reason: Optional[str] = Field(
        default=None, description="e.g. 'order LND-042'"
    )


class Customer(CustomerBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
