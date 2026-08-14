"""Orders CRUD endpoints.

Routes
------
POST   /api/orders                        → create a new order (auto-seed first event)
GET    /api/orders                        → list orders with optional filters
GET    /api/orders/{order_id}             → fetch single order
PATCH  /api/orders/{order_id}/status      → transition status + append event
POST   /api/orders/{order_id}/pod         → upload proof-of-delivery photos
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from db import orders_col
from models import (
    Order,
    OrderCreate,
    OrderEvent,
    OrderStatus,
    PaymentStatus,
    StatusUpdate,
)
from storage import make_object_key, resolve_url, save_image_bytes
from utils import deserialize_from_mongo, serialize_for_mongo

log = logging.getLogger(__name__)
router = APIRouter(prefix="/orders", tags=["orders"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_POD_BYTES = 5 * 1024 * 1024  # 5 MB


async def _hydrate_pod_urls(order: Order) -> Order:
    """Replace stored object keys in ``pod_urls`` with usable frontend URLs
    (presigned R2 GET URLs in prod, /api/uploads/... locally). Idempotent —
    legacy full paths pass through untouched."""
    if order.pod_urls:
        order.pod_urls = [await resolve_url(u) for u in order.pod_urls]
    return order


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
    orders = [Order(**deserialize_from_mongo(r)) for r in rows]
    for o in orders:
        await _hydrate_pod_urls(o)
    return orders


@router.get("/{order_id}", response_model=Order)
async def get_order(order_id: str) -> Order:
    row = await orders_col.find_one({"order_id": order_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    return await _hydrate_pod_urls(Order(**deserialize_from_mongo(row)))


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
    return await _hydrate_pod_urls(Order(**deserialize_from_mongo(updated)))


# ---------------- POST /api/orders/{order_id}/pod ----------------
@router.post("/{order_id}/pod", response_model=Order)
async def upload_pod(
    order_id: str,
    actor: str = Form(..., min_length=1),
    kind: str = Form("delivery", description="Tag for the photo: 'delivery' or 'payment'"),
    photo: UploadFile = File(...),
) -> Order:
    """Upload a Proof-of-Delivery (or Proof-of-Payment) photo for an order.

    Saves the image under /app/backend/uploads/pod/, appends the public URL to
    the order's `pod_urls` array, and records an audit event. Does NOT auto-
    transition status — the courier screen issues a separate PATCH /status
    call so the two concerns stay independent.
    """
    row = await orders_col.find_one({"order_id": order_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")

    if photo.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415, detail=f"Unsupported image type: {photo.content_type}"
        )
    raw = await photo.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(raw) > MAX_POD_BYTES:
        raise HTTPException(status_code=413, detail="Photo too large (max 5 MB)")

    pod_key = make_object_key("pod", f"{order_id}_{kind}", photo.content_type)
    try:
        await save_image_bytes(raw, key=pod_key, content_type=photo.content_type)
    except (ClientError, BotoCoreError) as exc:
        log.exception("PoD upload failed for order=%s: %s", order_id, exc)
        raise HTTPException(status_code=502, detail="Storage upload failed")

    # Store the bare object key. resolve_url() converts it to a presigned R2
    # URL (or /api/uploads/... locally) at read time.
    pod_url = pod_key

    event = OrderEvent(
        status=row["order_status"],  # audit event, status doesn't change here
        actor=actor,
        timestamp=datetime.now(timezone.utc),
    )
    event_doc = serialize_for_mongo(event.model_dump())
    # Tag the event so it's distinguishable from status transitions
    event_doc["kind"] = f"pod:{kind}"
    event_doc["pod_url"] = pod_url

    await orders_col.update_one(
        {"order_id": order_id},
        {
            "$push": {
                "pod_urls": pod_url,
                "order_events": event_doc,
            }
        },
    )
    updated = await orders_col.find_one({"order_id": order_id}, {"_id": 0})
    return await _hydrate_pod_urls(Order(**deserialize_from_mongo(updated)))
