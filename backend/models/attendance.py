"""Attendance model — clock-in/out events with geotag, selfie, and shift report."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ShiftReport(BaseModel):
    """Dynamic performance data sent as part of clock-out WA blast."""

    model_config = ConfigDict(extra="allow")

    cuci_kg: float = Field(default=0, ge=0)
    cuci_pelanggan: int = Field(default=0, ge=0)
    kering_kg: float = Field(default=0, ge=0)
    kering_pelanggan: int = Field(default=0, ge=0)
    setrika_kg: float = Field(default=0, ge=0)
    setrika_pelanggan: int = Field(default=0, ge=0)
    packing_kg: float = Field(default=0, ge=0)
    packing_pelanggan: int = Field(default=0, ge=0)
    pickup_kg: float = Field(default=0, ge=0)
    pickup_pelanggan: int = Field(default=0, ge=0)
    delivery_kg: float = Field(default=0, ge=0)
    delivery_pelanggan: int = Field(default=0, ge=0)


class AttendanceBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    staff_name: str
    clock_in_time: datetime
    clock_out_time: Optional[datetime] = None
    geotag_lat: float
    geotag_lng: float
    selfie_url: str = Field(..., description="Public URL / object-store key for selfie")
    shift_report_data: Optional[ShiftReport] = None


class AttendanceCreate(AttendanceBase):
    """Payload accepted by POST /api/attendance."""


class Attendance(AttendanceBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
