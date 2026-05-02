"""Order model — one document per laundry order flowing through the pipeline."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

OrderSource = Literal["Walk-in", "Tamel", "Anter", "Kosan"]
PaymentStatus = Literal["Lunas", "Nanti"]
OrderStatus = Literal[
    "Antrian", "Cuci", "Kering", "Setrika", "Packing", "OTW", "Selesai"
]

# Full ordered pipeline chain — used for seed + SLA calculations.
STATUS_CHAIN: List[OrderStatus] = [
    "Antrian", "Cuci", "Kering", "Setrika", "Packing", "OTW", "Selesai"
]


class OrderEvent(BaseModel):
    """Immutable audit record of a status transition on an Order."""

    model_config = ConfigDict(extra="ignore")

    status: OrderStatus
    actor: str = Field(..., description="Who triggered the change, e.g. 'kasir-erfa'")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class OrderBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    order_id: str = Field(..., description="Human-readable code, e.g. LND-001")
    customer_name: str
    customer_phone: str
    customer_address: Optional[str] = None
    source: OrderSource = "Walk-in"
    weight_kg: float = Field(..., ge=0)
    items_detail: Optional[str] = None
    total_price: int = Field(..., ge=0, description="Total in IDR (integer rupiah)")
    payment_status: PaymentStatus = "Nanti"
    order_status: OrderStatus = "Antrian"


class OrderCreate(OrderBase):
    """Payload accepted by POST /api/orders."""

    actor: Optional[str] = Field(
        default="kasir",
        description="Actor for the initial event; stripped before persistence",
    )


class StatusUpdate(BaseModel):
    """Payload for PATCH /api/orders/{order_id}/status."""

    new_status: OrderStatus
    actor: str = Field(..., min_length=1)


class Order(OrderBase):
    """Stored document shape."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    order_events: List[OrderEvent] = Field(default_factory=list)
