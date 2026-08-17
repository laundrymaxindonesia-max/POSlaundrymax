"""Seed endpoints — wipe & populate collections with realistic demo data.

POST /api/seed/orders        → 35 dummy orders across all statuses (existing)
POST /api/seed/prices        → 6 service rows matching Admin UI defaults
POST /api/seed/customers     → 5 customers mix (2 Regular + 3 Member)
POST /api/seed/b2b           → 4 B2B partners matching Admin UI
POST /api/seed/all           → runs all of the above in sequence
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List

from fastapi import APIRouter

from db import attendance_col, b2b_quotas_col, customers_col, orders_col, prices_col, staff_col
from models import (
    B2BQuota,
    Customer,
    Order,
    OrderEvent,
    OrderSource,
    PaymentStatus,
    Price,
    Staff,
    STATUS_CHAIN,
)
from utils import serialize_for_mongo

router = APIRouter(prefix="/seed", tags=["seed"])


# ---------------- ORDERS ----------------
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
_STAGE_GAP_MIN = (45, 120)

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
    rng = random.Random(42)
    orders: List[Order] = []
    now = datetime.now(timezone.utc)

    flat: List[str] = []
    for status, count in _STATUS_DISTRIBUTION:
        flat.extend([status] * count)
    rng.shuffle(flat)

    for idx, final_status in enumerate(flat, start=1):
        order_code = f"LND-{idx:03d}"
        customer = _CUSTOMERS[idx % len(_CUSTOMERS)]
        source = _SOURCES[idx % len(_SOURCES)]
        weight = round(rng.uniform(1.5, 8.5), 1)
        rate = rng.choice([7000, 8000, 9000, 10000, 12000])
        total = int(weight * rate)
        payment = rng.choices(_PAYMENT, weights=[0.6, 0.4])[0]

        bucket = rng.random()
        if bucket < 0.6:
            created = now - timedelta(hours=rng.uniform(0.2, 14))
        elif bucket < 0.85:
            created = now - timedelta(days=rng.uniform(1, 6.9))
        else:
            created = now - timedelta(days=rng.uniform(7, 29.5))

        chain_cutoff = STATUS_CHAIN.index(final_status)
        events: List[OrderEvent] = []
        cursor = created
        for i in range(chain_cutoff + 1):
            stage = STATUS_CHAIN[i]
            if i > 0:
                cursor = cursor + timedelta(minutes=rng.uniform(*_STAGE_GAP_MIN))
            events.append(
                OrderEvent(status=stage, actor=rng.choice(_ACTORS[stage]), timestamp=cursor)
            )

        orders.append(
            Order(
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
        )
    return orders


async def _seed_orders() -> Dict[str, int]:
    """Wipe orders collection — no demo orders seeded anymore (production-ready)."""
    await orders_col.delete_many({})
    return {"inserted": 0, "by_status": {}}


# ---------------- PRICES ----------------
# NOTE: The four columns are: Umum (Walk-in), Tamel, Laskita, Member (Kostunpad).
# Per business rules: LASKITA & KOSTUNPAD copy the TAMEL price exactly for kiloan.
# Speed tiers (Reguler / Flash / Express) only apply to Cuci Kiloan as separate
# rows. Satuan & Sepatu use a single base row + client-side multiplier
# (Flash = base × 1.5, Express = base × 2.0). Showcase has no speed tier.
_DEFAULT_PRICES = [
    # ---- Cuci Kiloan with speed tiers ---------------------------------
    {"service_id": "kiloan_reguler", "label": "Cuci Kiloan — Reguler (3 hari)", "unit": "/kg",  "umum": 7000,  "tamel": 8000,  "laskita": 8000,  "member": 8000},
    {"service_id": "kiloan_flash",   "label": "Cuci Kiloan — Flash (1 hari)",   "unit": "/kg",  "umum": 10000, "tamel": 12000, "laskita": 12000, "member": 12000},
    {"service_id": "kiloan_express", "label": "Cuci Kiloan — Express (5 jam)",  "unit": "/kg",  "umum": 18500, "tamel": 20000, "laskita": 20000, "member": 20000},
    # ---- Satuan / Sepatu base prices (multiplier applied client-side) -
    {"service_id": "satuan",   "label": "Satuan (Kemeja/Celana)",     "unit": "/pcs", "umum": 15000, "tamel": 15000, "laskita": 18000, "member": 13500},
    {"service_id": "sepatu",   "label": "Sepatu",                     "unit": "/pcs", "umum": 30000, "tamel": 30000, "laskita": 35000, "member": 27000},
    # ---- No speed tier ------------------------------------------------
    {"service_id": "jas",      "label": "Jas / Coat",                 "unit": "/pcs", "umum": 25000, "tamel": 25000, "laskita": 30000, "member": 22500},
    {"service_id": "karpet",   "label": "Karpet",                     "unit": "/m²",  "umum": 30000, "tamel": 30000, "laskita": 35000, "member": 27000},
    {"service_id": "showcase", "label": "Showcase (Gas/Air)",         "unit": "/pcs", "umum": 20000, "tamel": 20000, "laskita": 22000, "member": 18000},
]


async def _seed_prices() -> Dict[str, int]:
    await prices_col.delete_many({})
    prices = [Price(**row) for row in _DEFAULT_PRICES]
    await prices_col.insert_many(
        [serialize_for_mongo(p.model_dump()) for p in prices]
    )
    return {"inserted": len(prices)}


# ---------------- CUSTOMERS ----------------
_DEFAULT_CUSTOMERS = [
    {"name": "Rina Permata",    "phone": "082111223344", "address": "Jl. Dago 77",        "type": "Regular", "member_tier": None,       "remaining_quota_kg": None},
    {"name": "Hendra Gunawan",  "phone": "082255443322", "address": "Jl. Riau 19",        "type": "Regular", "member_tier": None,       "remaining_quota_kg": None},
    {"name": "Citra Wibowo",    "phone": "087877668899", "address": "Kost UNPAD A12",     "type": "Member",  "member_tier": "Silver",   "remaining_quota_kg": 18.0},
    {"name": "Ahmad Subagja",   "phone": "085622334455", "address": "Kost UNPAD B03",     "type": "Member",  "member_tier": "Gold",     "remaining_quota_kg": 32.5},
    {"name": "Dewi Puspita",    "phone": "081211000005", "address": "Kost UNPAD Premium", "type": "Member",  "member_tier": "Platinum", "remaining_quota_kg": 48.0},
]


async def _seed_customers() -> Dict[str, int]:
    """Wipe customers collection — no demo customers seeded anymore.
    All customers must be created through the POS 'Simpan Pelanggan Reguler'
    or member registration flow so the DB reflects real business data."""
    await customers_col.delete_many({})
    return {"inserted": 0}


# ---------------- B2B QUOTAS ----------------
_DEFAULT_B2B = [
    {"partner_id": "tamel",     "partner_name": "Hotel Tamel",        "total_quota_kg": 500, "used_quota_kg": 312, "billing_period": "2026-02"},
    {"partner_id": "laskita",   "partner_name": "Laskita Kostel",     "total_quota_kg": 300, "used_quota_kg": 285, "billing_period": "2026-02"},
    {"partner_id": "kostunpad", "partner_name": "Kost UNPAD Network", "total_quota_kg": 800, "used_quota_kg": 410, "billing_period": "2026-02"},
    {"partner_id": "wins",      "partner_name": "Kosan Wins",         "total_quota_kg": 200, "used_quota_kg": 124, "billing_period": "2026-02"},
]


async def _seed_b2b() -> Dict[str, int]:
    await b2b_quotas_col.delete_many({})
    docs = [serialize_for_mongo(B2BQuota(**r).model_dump()) for r in _DEFAULT_B2B]
    await b2b_quotas_col.insert_many(docs)
    return {"inserted": len(docs)}


# ---------------- STAFF ----------------
_DEFAULT_STAFF = [
    {"name": "Erfa", "role": "Kasir",    "display_role": "Kasir Outlet",     "pin_code": "1234"},
    {"name": "Dedi", "role": "Produksi", "display_role": "Operator Cuci",    "pin_code": "1234"},
    {"name": "Rina", "role": "Produksi", "display_role": "Operator Setrika", "pin_code": "1234"},
    {"name": "Budi", "role": "Kurir",    "display_role": "Kurir Antareun",   "pin_code": "1234"},
    {"name": "Siti", "role": "Produksi", "display_role": "Packing & QC",     "pin_code": "1234"},
    {"name": "Agus", "role": "Produksi", "display_role": "Operator Kering",  "pin_code": "1234"},
]


async def _seed_staff() -> Dict[str, int]:
    # Wipe staff AND any dangling attendance records that reference old ids
    await staff_col.delete_many({})
    await attendance_col.delete_many({})
    docs = [serialize_for_mongo(Staff(**r).model_dump()) for r in _DEFAULT_STAFF]
    await staff_col.insert_many(docs)
    return {"inserted": len(docs)}


# ---------------- HTTP endpoints ----------------
@router.post("/orders")
async def seed_orders_endpoint():
    return await _seed_orders()


@router.post("/prices")
async def seed_prices_endpoint():
    return await _seed_prices()


@router.post("/customers")
async def seed_customers_endpoint():
    return await _seed_customers()


@router.post("/b2b")
async def seed_b2b_endpoint():
    return await _seed_b2b()


@router.post("/staff")
async def seed_staff_endpoint():
    return await _seed_staff()


@router.post("/all")
async def seed_all_endpoint():
    """Single-shot reset of the whole demo dataset."""
    return {
        "orders": await _seed_orders(),
        "prices": await _seed_prices(),
        "customers": await _seed_customers(),
        "b2b_quotas": await _seed_b2b(),
        "staff": await _seed_staff(),
    }
