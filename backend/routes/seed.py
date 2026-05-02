"""Seed endpoint — populates orders collection with realistic dummy data.

POST /api/seed/orders        → wipe + reseed 35 orders
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter

from db import orders_col
from models import Order, OrderEvent, OrderSource, PaymentStatus, STATUS_CHAIN
from utils import serialize_for_mongo

router = APIRouter(prefix="/seed", tags=["seed"])


# Distribution of order_status across the 35 seed orders
_STATUS_DISTRIBUTION: List[tuple[str, int]] = [
    ("Antrian", 5),
    ("Cuci", 5),
    ("Kering", 4),
    ("Setrika", 5),
    ("Packing", 4),
    ("OTW", 4),
    ("Selesai", 8),
]

_CUSTOMERS = [
    ("Siti Rahmawati", "6281311000001", "Jl. Dipatiukur 15, Bandung"),
    ("Budi Santoso", "6281311000002", "Jl. Sukajadi 42, Bandung"),
    ("Rina Kartika", "6281311000003", "Jl. Setiabudi 88, Bandung"),
    ("Agus Firmansyah", "6281311000004", "Jl. Ciumbuleuit 5, Bandung"),
    ("Dewi Puspita", "6281311000005", "Jl. Dago 77, Bandung"),
    ("Erfa Maulana", "6281311000006", "Jl. Cihampelas 32, Bandung"),
    ("Dedi Supardi", "6281311000007", "Jl. Riau 19, Bandung"),
    ("Nur Aisyah", "6281311000008", "Jl. Braga 4, Bandung"),
    ("Iqbal Prasetyo", "6281311000009", "Jl. Pajajaran 11, Bandung"),
    ("Mega Anggraeni", "6281311000010", "Jl. Pasteur 60, Bandung"),
]

_SOURCES: List[OrderSource] = ["Walk-in", "Tamel", "Anter", "Kosan"]
_PAYMENT: List[PaymentStatus] = ["Lunas", "Nanti"]

# Per-stage transition gap (minutes) — used to space events within an order's lifecycle
_STAGE_GAP_MIN = (45, 120)

# actor vocabulary per stage
_ACTORS = {
    "Antrian": ["kasir-erfa", "kasir-siti"],
    "Cuci": ["produksi-dedi", "produksi-agus"],
    "Kering": ["produksi-agus", "produksi-dedi"],
    "Setrika": ["produksi-rina", "produksi-siti"],
    "Packing": ["produksi-siti", "produksi-rina"],
    "OTW": ["kurir-budi", "kurir-iqbal"],
    "Selesai": ["kurir-budi", "kurir-iqbal"],
}


def _build_seed_orders() -> List[Order]:
    rng = random.Random(42)  # deterministic seed
    orders: List[Order] = []
    idx = 0
    now = datetime.now(timezone.utc)

    flat: List[str] = []
    for status, count in _STATUS_DISTRIBUTION:
        flat.extend([status] * count)
    rng.shuffle(flat)

    for final_status in flat:
        idx += 1
        order_code = f"LND-{idx:03d}"
        customer = _CUSTOMERS[idx % len(_CUSTOMERS)]
        source = _SOURCES[idx % len(_SOURCES)]
        weight = round(rng.uniform(1.5, 8.5), 1)
        # Rate ranges IDR 7k-12k/kg
        rate = rng.choice([7000, 8000, 9000, 10000, 12000])
        total = int(weight * rate)
        payment = rng.choices(_PAYMENT, weights=[0.6, 0.4])[0]

        # created_at spread: 60% today, 25% last 7 days, 15% last 30 days
        bucket = rng.random()
        if bucket < 0.6:
            hours_back = rng.uniform(0.2, 14)
            created = now - timedelta(hours=hours_back)
        elif bucket < 0.85:
            days_back = rng.uniform(1, 6.9)
            created = now - timedelta(days=days_back)
        else:
            days_back = rng.uniform(7, 29.5)
            created = now - timedelta(days=days_back)

        # Build event chain up through final_status
        chain_cutoff = STATUS_CHAIN.index(final_status)
        events: List[OrderEvent] = []
        cursor = created
        for i in range(chain_cutoff + 1):
            stage = STATUS_CHAIN[i]
            if i > 0:
                cursor = cursor + timedelta(
                    minutes=rng.uniform(*_STAGE_GAP_MIN)
                )
            events.append(
                OrderEvent(
                    status=stage,
                    actor=rng.choice(_ACTORS[stage]),
                    timestamp=cursor,
                )
            )

        order = Order(
            order_id=order_code,
            customer_name=customer[0],
            customer_phone=customer[1],
            customer_address=customer[2],
            source=source,
            weight_kg=weight,
            items_detail=None,
            total_price=total,
            payment_status=payment,
            order_status=final_status,
            created_at=created,
            order_events=events,
        )
        orders.append(order)
    return orders


@router.post("/orders")
async def seed_orders():
    """Wipe the orders collection and reseed with deterministic demo data."""
    await orders_col.delete_many({})
    docs = [serialize_for_mongo(o.model_dump()) for o in _build_seed_orders()]
    if docs:
        await orders_col.insert_many(docs)
    # Per-status summary for response
    by_status: dict = {}
    for d in docs:
        by_status[d["order_status"]] = by_status.get(d["order_status"], 0) + 1
    return {
        "inserted": len(docs),
        "by_status": by_status,
    }
