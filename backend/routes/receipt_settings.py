"""CRUD endpoints for the singleton ReceiptSettings document.

GET /api/receipt-settings  → returns the current settings, auto-creating the
                             default row on first call. Never 404s.
PUT /api/receipt-settings  → replaces the settings with the supplied payload.
                             The document is validated + persisted, then the
                             fresh document is returned so the caller can
                             overwrite its local cache in one round-trip.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException

from db import receipt_settings_col
from models.receipt_settings import (
    KNOWN_HEADER_SLOTS,
    SETTINGS_ID,
    ReceiptSettings,
    ReceiptSettingsUpdate,
)

router = APIRouter(prefix="/receipt-settings", tags=["receipt-settings"])


def _sanitize_header_order(order: List[str]) -> List[str]:
    """De-dup while preserving user-chosen order; append any missing known
    slots at the end so the payload always covers every renderable slot.
    """
    seen: set[str] = set()
    result: List[str] = []
    for slot in order:
        if slot in seen:
            continue
        seen.add(slot)
        result.append(slot)
    for slot in KNOWN_HEADER_SLOTS:
        if slot not in seen:
            result.append(slot)
    return result


async def _load_or_seed() -> dict:
    """Return the singleton settings row, creating the default document
    on first read so the admin UI never gets a 404 on cold-start."""
    doc = await receipt_settings_col.find_one({"id": SETTINGS_ID}, {"_id": 0})
    if doc:
        return doc
    default = ReceiptSettings()
    await receipt_settings_col.insert_one(default.model_dump())
    return default.model_dump()


@router.get("", response_model=ReceiptSettings)
async def get_receipt_settings() -> ReceiptSettings:
    doc = await _load_or_seed()
    return ReceiptSettings(**doc)


@router.put("", response_model=ReceiptSettings)
async def put_receipt_settings(payload: ReceiptSettingsUpdate) -> ReceiptSettings:
    fresh = payload.model_dump()
    fresh["header_order"] = _sanitize_header_order(fresh.get("header_order", []))
    if not fresh["header_order"]:
        raise HTTPException(status_code=422, detail="header_order cannot be empty")
    fresh["id"] = SETTINGS_ID
    fresh["updated_at"] = datetime.now(timezone.utc)
    await receipt_settings_col.replace_one(
        {"id": SETTINGS_ID}, fresh, upsert=True
    )
    return ReceiptSettings(**fresh)
