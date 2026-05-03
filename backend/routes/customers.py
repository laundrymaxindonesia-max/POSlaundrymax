"""Customers CRUD endpoints.

POST  /api/customers                       → create customer
GET   /api/customers                       → list, optional ?q= search (name or phone)
GET   /api/customers/{customer_id}         → single (uuid id)
PATCH /api/customers/{customer_id}/deduct  → decrement remaining_quota_kg (members only)
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from db import customers_col
from models import Customer, CustomerCreate, QuotaDeduction
from utils import deserialize_from_mongo, serialize_for_mongo

router = APIRouter(prefix="/customers", tags=["customers"])


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
    limit: int = Query(500, ge=1, le=5000),
) -> List[Customer]:
    query: dict = {}
    if q:
        query = {
            "$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"phone": {"$regex": q, "$options": "i"}},
            ]
        }

    rows = (
        await customers_col.find(query, {"_id": 0})
        .sort("created_at", -1)
        .to_list(limit)
    )
    return [Customer(**deserialize_from_mongo(r)) for r in rows]


@router.get("/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str) -> Customer:
    row = await customers_col.find_one({"id": customer_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return Customer(**deserialize_from_mongo(row))


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
