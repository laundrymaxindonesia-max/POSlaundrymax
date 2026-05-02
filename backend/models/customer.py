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

    name: str
    phone: str
    address: Optional[str] = None
    type: CustomerType = "Regular"
    member_tier: Optional[MemberTier] = None
    remaining_quota_kg: Optional[float] = Field(default=None, ge=0)
    quota_expiry_date: Optional[datetime] = None


class CustomerCreate(CustomerBase):
    """Payload accepted by POST /api/customers."""


class Customer(CustomerBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
