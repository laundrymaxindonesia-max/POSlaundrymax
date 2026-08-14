"""Staff listing + Attendance clock-in/clock-out endpoints.

GET  /api/staff                    → list staff (without PIN) for kiosk dropdown
POST /api/attendance/clock-in      → multipart/form-data: staff_id, pin_code, lat, lng, selfie
POST /api/attendance/clock-out     → JSON: staff_id, pin_code → writes clock_out_time + shift_report
GET  /api/attendance               → optional debug list (filter by staff_id, open)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from db import attendance_col, staff_col
from models import (
    Attendance,
    ShiftReport,
    StaffPublic,
)
from storage import make_object_key, resolve_url, save_image_bytes
from utils import deserialize_from_mongo, serialize_for_mongo

log = logging.getLogger(__name__)
router = APIRouter(tags=["staff_attendance"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_SELFIE_BYTES = 5 * 1024 * 1024  # 5 MB


# ---------------- GET /api/staff ----------------
@router.get("/staff", response_model=List[StaffPublic])
async def list_staff() -> List[StaffPublic]:
    rows = (
        await staff_col.find({}, {"_id": 0, "pin_code": 0})
        .sort("name", 1)
        .to_list(100)
    )
    return [StaffPublic(**deserialize_from_mongo(r)) for r in rows]


# ---------------- Helpers ----------------
async def _load_and_verify_staff(staff_id: str, pin_code: str) -> dict:
    staff = await staff_col.find_one({"id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    if staff.get("pin_code") != pin_code:
        raise HTTPException(status_code=403, detail="PIN salah")
    return staff


def _default_shift_report() -> ShiftReport:
    """Mocked per-shift performance numbers that match the UI copy.

    In a real deployment this would aggregate from the `orders` collection
    scoped to the staff's clock-in window + their actor events.
    """
    return ShiftReport(
        cuci_kg=35, cuci_pelanggan=9,
        kering_kg=45, kering_pelanggan=10,
        setrika_kg=80, setrika_pelanggan=28,
        packing_kg=77, packing_pelanggan=25,
        pickup_kg=15, pickup_pelanggan=5,
        delivery_kg=10, delivery_pelanggan=2,
    )


# ---------------- POST /api/attendance/clock-in ----------------
@router.post("/attendance/clock-in", response_model=Attendance, status_code=201)
async def clock_in(
    staff_id: str = Form(...),
    pin_code: str = Form(..., min_length=4, max_length=4, pattern=r"^\d{4}$"),
    lat: float = Form(...),
    lng: float = Form(...),
    selfie: UploadFile = File(...),
) -> Attendance:
    staff = await _load_and_verify_staff(staff_id, pin_code)

    # Reject if there's already an open attendance for this staff
    open_existing = await attendance_col.find_one(
        {"staff_id": staff_id, "clock_out_time": None}, {"_id": 0}
    )
    if open_existing:
        raise HTTPException(
            status_code=409,
            detail="Sudah absen masuk — absen pulang dulu sebelum masuk lagi",
        )

    # Validate + persist the selfie
    if selfie.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image type: {selfie.content_type}",
        )
    raw = await selfie.read()
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Selfie file is empty")
    if len(raw) > MAX_SELFIE_BYTES:
        raise HTTPException(status_code=413, detail="Selfie too large (max 5 MB)")

    key = make_object_key("attendance", staff_id, selfie.content_type)
    try:
        await save_image_bytes(raw, key=key, content_type=selfie.content_type)
    except (ClientError, BotoCoreError) as exc:
        log.exception("Attendance selfie upload failed: %s", exc)
        raise HTTPException(status_code=502, detail="Storage upload failed")

    # Persist the bare object KEY (not a URL) so we can regenerate presigned
    # URLs at read time. Legacy rows that hold a full `/api/uploads/...` URL
    # keep working — resolve_url() passes them through untouched.
    selfie_url = key

    record = Attendance(
        staff_name=staff["name"],
        clock_in_time=datetime.now(timezone.utc),
        clock_out_time=None,
        geotag_lat=lat,
        geotag_lng=lng,
        selfie_url=selfie_url,
    )
    doc = serialize_for_mongo(record.model_dump())
    # Attach staff_id as a non-model index field so clock-out can find it
    doc["staff_id"] = staff_id
    await attendance_col.insert_one(doc)
    # Expose a resolved URL (presigned R2 or local path) in the response.
    record.selfie_url = await resolve_url(selfie_url)
    return record


# ---------------- POST /api/attendance/clock-out ----------------
class ClockOutRequest(BaseModel):
    staff_id: str = Field(..., min_length=1)
    pin_code: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")


@router.post("/attendance/clock-out", response_model=Attendance)
async def clock_out(payload: ClockOutRequest) -> Attendance:
    await _load_and_verify_staff(payload.staff_id, payload.pin_code)

    # Find the most recent open attendance for this staff
    open_row = await attendance_col.find_one(
        {"staff_id": payload.staff_id, "clock_out_time": None},
        {"_id": 0},
        sort=[("clock_in_time", -1)],
    )
    if not open_row:
        raise HTTPException(
            status_code=400,
            detail="Belum ada absen masuk yang aktif untuk staff ini",
        )

    shift_report = _default_shift_report()
    now = datetime.now(timezone.utc)
    await attendance_col.update_one(
        {"staff_id": payload.staff_id, "clock_out_time": None, "id": open_row["id"]},
        {
            "$set": {
                "clock_out_time": now.isoformat(),
                "shift_report_data": serialize_for_mongo(shift_report.model_dump()),
            }
        },
    )
    updated = await attendance_col.find_one({"id": open_row["id"]}, {"_id": 0})
    record = Attendance(**deserialize_from_mongo(updated))
    record.selfie_url = await resolve_url(record.selfie_url)
    return record


# ---------------- GET /api/attendance (debug/admin) ----------------
@router.get("/attendance", response_model=List[Attendance])
async def list_attendance(
    staff_id: Optional[str] = Query(None),
    open_only: bool = Query(False, description="Only records without clock_out_time"),
    limit: int = Query(200, ge=1, le=1000),
) -> List[Attendance]:
    query: dict = {}
    if staff_id:
        query["staff_id"] = staff_id
    if open_only:
        query["clock_out_time"] = None
    rows = (
        await attendance_col.find(query, {"_id": 0})
        .sort("clock_in_time", -1)
        .to_list(limit)
    )
    records = [Attendance(**deserialize_from_mongo(r)) for r in rows]
    for rec in records:
        rec.selfie_url = await resolve_url(rec.selfie_url)
    return records
