"""Customer model — walk-in and B2B membership customers."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

CustomerType = Literal["Regular", "Member"]
MemberTier = Literal["Silver", "Gold", "Platinum"]
# CRM segmentation — where the customer originally came from. Used for
# marketing filters, reporting and outreach eligibility.
SourceCategory = Literal[
    "Taman Melati",
    "Walk-in Laskita",
    "B2B Kosan",
    "Antar Jemput",
    "Lainnya",
]


class CustomerBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(..., min_length=1)
    phone: str = Field(..., min_length=1)
    address: Optional[str] = None
    type: CustomerType = "Regular"
    member_tier: Optional[MemberTier] = None
    remaining_quota_kg: Optional[float] = Field(default=None, ge=0)
    quota_expiry_date: Optional[datetime] = None
    source_category: SourceCategory = "Lainnya"
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    """Payload accepted by POST /api/customers."""


class CustomerUpdate(BaseModel):
    """Partial update — every field optional so the kasir can fix a single
    typo without re-typing the full record."""

    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(default=None, min_length=1)
    phone: Optional[str] = Field(default=None, min_length=1)
    address: Optional[str] = None
    type: Optional[CustomerType] = None
    member_tier: Optional[MemberTier] = None
    remaining_quota_kg: Optional[float] = Field(default=None, ge=0)
    quota_expiry_date: Optional[datetime] = None
    source_category: Optional[SourceCategory] = None
    notes: Optional[str] = None


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
