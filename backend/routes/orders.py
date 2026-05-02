"""Orders CRUD endpoints.

Routes
------
POST   /api/orders                        → create a new order (auto-seed first event)
GET    /api/orders                        → list orders with optional filters
GET    /api/orders/{order_id}             → fetch single order
PATCH  /api/orders/{order_id}/status      → transition status + append event
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from db import orders_col
from models import (
    Order,
    OrderCreate,
    OrderEvent,
    OrderStatus,
    PaymentStatus,
    StatusUpdate,
)
from utils import deserialize_from_mongo, serialize_for_mongo

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=Order, status_code=201)
async def create_order(payload: OrderCreate) -> Order:
    # Split actor off (OrderCreate-only field) before building the stored Order
    data = payload.model_dump()
    actor = data.pop("actor", "kasir") or "kasir"

    order = Order(**data)

    # Seed initial event matching the starting status
    order.order_events = [
        OrderEvent(
            status=order.order_status,
            actor=actor,
            timestamp=order.created_at,
        )
    ]

    # Uniqueness check on order_id (human-readable code)
    existing = await orders_col.find_one({"order_id": order.order_id}, {"_id": 0})
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"order_id '{order.order_id}' already exists",
        )

    await orders_col.insert_one(serialize_for_mongo(order.model_dump()))
    return order


@router.get("", response_model=List[Order])
async def list_orders(
    status: Optional[OrderStatus] = Query(None, description="Filter by order_status"),
    payment_status: Optional[PaymentStatus] = Query(None, description="Filter by payment_status"),
    since: Optional[datetime] = Query(None, description="Only orders created at/after this ISO datetime"),
    limit: int = Query(500, ge=1, le=5000),
) -> List[Order]:
    query: dict = {}
    if status:
        query["order_status"] = status
    if payment_status:
        query["payment_status"] = payment_status
    if since:
        query["created_at"] = {"$gte": since.isoformat()}

    rows = (
        await orders_col.find(query, {"_id": 0})
        .sort("created_at", -1)
        .to_list(limit)
    )
    return [Order(**deserialize_from_mongo(r)) for r in rows]


@router.get("/{order_id}", response_model=Order)
async def get_order(order_id: str) -> Order:
    row = await orders_col.find_one({"order_id": order_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    return Order(**deserialize_from_mongo(row))


@router.patch("/{order_id}/status", response_model=Order)
async def update_status(order_id: str, payload: StatusUpdate) -> Order:
    row = await orders_col.find_one({"order_id": order_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")

    event = OrderEvent(
        status=payload.new_status,
        actor=payload.actor,
        timestamp=datetime.now(timezone.utc),
    )
    event_doc = serialize_for_mongo(event.model_dump())

    await orders_col.update_one(
        {"order_id": order_id},
        {
            "$set": {"order_status": payload.new_status},
            "$push": {"order_events": event_doc},
        },
    )
    updated = await orders_col.find_one({"order_id": order_id}, {"_id": 0})
    return Order(**deserialize_from_mongo(updated))
