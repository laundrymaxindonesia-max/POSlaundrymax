"""Prospects (marketing leads) CRUD.

POST  /api/prospects                       → create prospect
GET   /api/prospects                       → list, optional ?q= + ?status=
PATCH /api/prospects/{prospect_id}         → partial update (status flips etc)
POST  /api/prospects/{prospect_id}/convert → move prospect → customer, keep audit
GET   /api/prospects/export.csv            → CSV export
POST  /api/prospects/import                → bulk-upsert (matched by phone)
DELETE /api/prospects/{prospect_id}        → remove a lead
"""

from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from db import customers_col, prospects_col
from models import (
    Customer,
    CustomerCreate,
    Prospect,
    ProspectCreate,
    ProspectUpdate,
)
from utils import deserialize_from_mongo, serialize_for_mongo

router = APIRouter(prefix="/prospects", tags=["prospects"])

CSV_COLUMNS = ["id", "name", "phone", "status", "source_category", "notes"]


@router.post("", response_model=Prospect, status_code=201)
async def create_prospect(payload: ProspectCreate) -> Prospect:
    prospect = Prospect(**payload.model_dump())
    existing = await prospects_col.find_one({"phone": prospect.phone}, {"_id": 0})
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"prospect phone '{prospect.phone}' already exists",
        )
    await prospects_col.insert_one(serialize_for_mongo(prospect.model_dump()))
    return prospect


@router.get("", response_model=List[Prospect])
async def list_prospects(
    q: Optional[str] = Query(None, description="Substring match on name or phone"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(500, ge=1, le=5000),
) -> List[Prospect]:
    query: dict = {}
    if q:
        escaped = re.escape(q)
        query["$or"] = [
            {"name": {"$regex": escaped, "$options": "i"}},
            {"phone": {"$regex": escaped, "$options": "i"}},
        ]
    if status:
        query["status"] = status
    rows = (
        await prospects_col.find(query, {"_id": 0})
        .sort("created_at", -1)
        .to_list(limit)
    )
    return [Prospect(**deserialize_from_mongo(r)) for r in rows]


@router.get("/export.csv", response_class=PlainTextResponse)
async def export_prospects_csv() -> PlainTextResponse:
    rows = await prospects_col.find({}, {"_id": 0}).to_list(10000)
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=CSV_COLUMNS)
    writer.writeheader()
    for r in rows:
        writer.writerow({k: (r.get(k) if r.get(k) is not None else "") for k in CSV_COLUMNS})
    return PlainTextResponse(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="prospects.csv"'},
    )


@router.post("/import")
async def import_prospects_csv(request: Request) -> dict:
    raw = (await request.body()).decode("utf-8", errors="ignore")
    if not raw.strip():
        raise HTTPException(status_code=400, detail="empty CSV body")
    reader = csv.DictReader(io.StringIO(raw))
    created = 0
    updated = 0
    skipped = 0
    errors: list[str] = []
    for row_idx, row in enumerate(reader, start=2):
        phone = (row.get("phone") or "").strip()
        name = (row.get("name") or "").strip()
        if not phone or not name:
            skipped += 1
            continue
        doc = {
            "name": name,
            "phone": phone,
            "status": (row.get("status") or "Belum Ditawari").strip() or "Belum Ditawari",
            "source_category": (row.get("source_category") or None) or None,
            "notes": row.get("notes") or None,
        }
        try:
            existing = await prospects_col.find_one({"phone": phone}, {"_id": 0})
            if existing:
                await prospects_col.update_one(
                    {"phone": phone}, {"$set": doc}
                )
                updated += 1
            else:
                prospect = Prospect(**doc)
                await prospects_col.insert_one(
                    serialize_for_mongo(prospect.model_dump())
                )
                created += 1
        except Exception as e:
            errors.append(f"row {row_idx}: {e}")
            skipped += 1
    return {"created": created, "updated": updated, "skipped": skipped, "errors": errors[:20]}


@router.patch("/{prospect_id}", response_model=Prospect)
async def update_prospect(prospect_id: str, payload: ProspectUpdate) -> Prospect:
    row = await prospects_col.find_one({"id": prospect_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Prospect not found")
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("status") == "Sudah Ditawari":
        changes.setdefault("followed_up_at", datetime.now(timezone.utc))
    if changes:
        await prospects_col.update_one(
            {"id": prospect_id}, {"$set": serialize_for_mongo(changes)}
        )
    updated = await prospects_col.find_one({"id": prospect_id}, {"_id": 0})
    return Prospect(**deserialize_from_mongo(updated))


@router.post("/{prospect_id}/convert", response_model=Customer)
async def convert_prospect(prospect_id: str, payload: CustomerCreate) -> Customer:
    """Move a prospect into the customers collection. The payload supplies
    the final customer details (type, address, source_category, etc.). The
    prospect record is kept but marked ``Konversi`` for reporting."""
    row = await prospects_col.find_one({"id": prospect_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Prospect not found")

    # Insert into customers (dedupe by phone)
    existing = await customers_col.find_one({"phone": payload.phone}, {"_id": 0})
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"phone '{payload.phone}' already exists as active customer",
        )
    customer = Customer(**payload.model_dump())
    await customers_col.insert_one(serialize_for_mongo(customer.model_dump()))

    await prospects_col.update_one(
        {"id": prospect_id},
        {
            "$set": {
                "status": "Konversi",
                "converted_customer_id": customer.id,
                "followed_up_at": row.get("followed_up_at")
                or datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    return customer


@router.delete("/{prospect_id}", status_code=204, response_class=PlainTextResponse)
async def delete_prospect(prospect_id: str):
    result = await prospects_col.delete_one({"id": prospect_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prospect not found")
    return PlainTextResponse(content="", status_code=204)
