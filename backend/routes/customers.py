"""Customers CRUD endpoints.

POST  /api/customers                       → create customer
GET   /api/customers                       → list, optional ?q= search + ?source= + ?type=
GET   /api/customers/{customer_id}         → single (uuid id)
PATCH /api/customers/{customer_id}         → partial update (fix WA/name/address/source_category)
PATCH /api/customers/{customer_id}/deduct  → decrement remaining_quota_kg (members only)
GET   /api/customers/export.csv            → CSV export of all customers
POST  /api/customers/import                → bulk-upsert from CSV body (text/csv)
"""

from __future__ import annotations

import csv
import io
import re
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from db import customers_col
from models import Customer, CustomerCreate, CustomerUpdate, QuotaDeduction
from utils import deserialize_from_mongo, serialize_for_mongo

router = APIRouter(prefix="/customers", tags=["customers"])

# Column order used by both export and import — treated as the canonical
# public CSV shape. Kept in sync with the frontend admin UI.
CSV_COLUMNS = [
    "id",
    "name",
    "phone",
    "address",
    "type",
    "member_tier",
    "source_category",
    "remaining_quota_kg",
    "quota_expiry_date",
    "notes",
]


@router.post("", response_model=Customer, status_code=201)
async def create_customer(payload: CustomerCreate) -> Customer:
    customer = Customer(**payload.model_dump())

    # soft uniqueness on phone
    existing = await customers_col.find_one({"phone": customer.phone}, {"_id": 0})
    if existing:
        raise HTTPException(
            status_code=409, detail=f"phone '{customer.phone}' already exists"
        )

    await customers_col.insert_one(serialize_for_mongo(customer.model_dump()))
    return customer


@router.get("", response_model=List[Customer])
async def list_customers(
    q: Optional[str] = Query(
        None, description="Case-insensitive substring match on name or phone"
    ),
    source: Optional[str] = Query(
        None, description="Filter by source_category (exact match)"
    ),
    type: Optional[str] = Query(
        None, description="Filter by customer type Regular|Member"
    ),
    limit: int = Query(500, ge=1, le=5000),
) -> List[Customer]:
    query: dict = {}
    if q:
        escaped = re.escape(q)
        query["$or"] = [
            {"name": {"$regex": escaped, "$options": "i"}},
            {"phone": {"$regex": escaped, "$options": "i"}},
        ]
    if source:
        query["source_category"] = source
    if type:
        query["type"] = type

    rows = (
        await customers_col.find(query, {"_id": 0})
        .sort("created_at", -1)
        .to_list(limit)
    )
    return [Customer(**deserialize_from_mongo(r)) for r in rows]


@router.get("/export.csv", response_class=PlainTextResponse)
async def export_customers_csv() -> PlainTextResponse:
    """Return the full customers collection as UTF-8 CSV."""
    rows = await customers_col.find({}, {"_id": 0}).to_list(10000)
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=CSV_COLUMNS)
    writer.writeheader()
    for r in rows:
        writer.writerow({k: (r.get(k) if r.get(k) is not None else "") for k in CSV_COLUMNS})
    return PlainTextResponse(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="customers.csv"'},
    )


@router.post("/import")
async def import_customers_csv(request: Request) -> dict:
    """Bulk-upsert customers from a CSV body. Existing rows are matched by
    ``phone`` and updated in place; unknown rows are inserted. The response
    reports counts so the client can render a summary toast."""
    raw = (await request.body()).decode("utf-8", errors="ignore")
    if not raw.strip():
        raise HTTPException(status_code=400, detail="empty CSV body")
    try:
        reader = csv.DictReader(io.StringIO(raw))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"invalid CSV: {e}")

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
        # Coerce optional numeric fields
        quota = row.get("remaining_quota_kg")
        try:
            quota_val = float(quota) if quota not in (None, "", "None") else None
        except ValueError:
            quota_val = None
        doc = {
            "name": name,
            "phone": phone,
            "address": row.get("address") or None,
            "type": (row.get("type") or "Regular").strip() or "Regular",
            "member_tier": (row.get("member_tier") or None) or None,
            "source_category": (row.get("source_category") or "Lainnya").strip() or "Lainnya",
            "remaining_quota_kg": quota_val,
            "notes": row.get("notes") or None,
        }
        # Build a Customer to validate literals + fill defaults
        try:
            existing = await customers_col.find_one({"phone": phone}, {"_id": 0})
            if existing:
                await customers_col.update_one(
                    {"phone": phone}, {"$set": doc}
                )
                updated += 1
            else:
                customer = Customer(**doc)
                await customers_col.insert_one(
                    serialize_for_mongo(customer.model_dump())
                )
                created += 1
        except Exception as e:
            errors.append(f"row {row_idx}: {e}")
            skipped += 1

    return {"created": created, "updated": updated, "skipped": skipped, "errors": errors[:20]}


@router.get("/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str) -> Customer:
    row = await customers_col.find_one({"id": customer_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return Customer(**deserialize_from_mongo(row))


@router.patch("/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, payload: CustomerUpdate) -> Customer:
    """Partial update — only the fields present in the payload are written.
    Phone uniqueness re-checked when phone is being changed."""
    row = await customers_col.find_one({"id": customer_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return Customer(**deserialize_from_mongo(row))

    new_phone = changes.get("phone")
    if new_phone and new_phone != row.get("phone"):
        clash = await customers_col.find_one(
            {"phone": new_phone, "id": {"$ne": customer_id}}, {"_id": 0}
        )
        if clash:
            raise HTTPException(
                status_code=409,
                detail=f"phone '{new_phone}' already used by another customer",
            )

    await customers_col.update_one(
        {"id": customer_id}, {"$set": serialize_for_mongo(changes)}
    )
    updated = await customers_col.find_one({"id": customer_id}, {"_id": 0})
    return Customer(**deserialize_from_mongo(updated))


@router.patch("/{customer_id}/deduct", response_model=Customer)
async def deduct_quota(customer_id: str, payload: QuotaDeduction) -> Customer:
    row = await customers_col.find_one({"id": customer_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")

    if row.get("type") != "Member":
        raise HTTPException(
            status_code=400, detail="Only Member customers have a quota"
        )

    remaining = row.get("remaining_quota_kg")
    if remaining is None:
        raise HTTPException(
            status_code=400, detail="Customer has no active quota"
        )
    if payload.kg > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient quota: {remaining} kg remaining, requested {payload.kg}",
        )

    new_remaining = round(remaining - payload.kg, 3)
    await customers_col.update_one(
        {"id": customer_id},
        {"$set": {"remaining_quota_kg": new_remaining}},
    )

    updated = await customers_col.find_one({"id": customer_id}, {"_id": 0})
    return Customer(**deserialize_from_mongo(updated))
