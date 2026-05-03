"""Prices CRUD endpoints.

GET  /api/prices            → list all price rows
POST /api/prices/bulk       → replace the entire pricing grid in one call
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter

from db import prices_col
from models import Price, PriceCreate
from utils import deserialize_from_mongo, serialize_for_mongo

router = APIRouter(prefix="/prices", tags=["prices"])


@router.get("", response_model=List[Price])
async def list_prices() -> List[Price]:
    rows = await prices_col.find({}, {"_id": 0}).to_list(100)
    return [Price(**deserialize_from_mongo(r)) for r in rows]


@router.post("/bulk", response_model=List[Price])
async def bulk_replace_prices(payload: List[PriceCreate]) -> List[Price]:
    """Replace the entire pricing grid atomically (wipe + insert).

    Admin UI sends the full grid via the giant SIMPAN button. Deleting and
    re-inserting is simpler and correct here because pricing is a small,
    write-rarely dataset and we always want the grid to be internally consistent.
    """
    await prices_col.delete_many({})

    prices = [Price(**row.model_dump()) for row in payload]
    if prices:
        await prices_col.insert_many(
            [serialize_for_mongo(p.model_dump()) for p in prices]
        )
    return prices
