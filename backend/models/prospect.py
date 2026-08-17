"""Prospect (Lead) model — pre-customer marketing pipeline.

A prospect is someone we intend to convert into an active customer. Its
lifecycle is tracked via `status`:

- ``Belum Ditawari``  — freshly imported / added, no outreach yet
- ``Sudah Ditawari``  — WA template sent
- ``Konversi``        — moved to the customers collection (kept in the
  prospects collection as a historical record so conversion rate can be
  measured over time)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

ProspectStatus = Literal["Belum Ditawari", "Sudah Ditawari", "Konversi"]


class ProspectBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(..., min_length=1)
    phone: str = Field(..., min_length=1)
    status: ProspectStatus = "Belum Ditawari"
    notes: Optional[str] = None
    source_category: Optional[str] = None  # optional pre-tag before conversion


class ProspectCreate(ProspectBase):
    """POST /api/prospects payload."""


class ProspectUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(default=None, min_length=1)
    phone: Optional[str] = Field(default=None, min_length=1)
    status: Optional[ProspectStatus] = None
    notes: Optional[str] = None
    source_category: Optional[str] = None


class Prospect(ProspectBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    followed_up_at: Optional[datetime] = None
    converted_customer_id: Optional[str] = None
