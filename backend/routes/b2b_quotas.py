"""B2B Quotas endpoints.

GET   /api/b2b_quotas                    → list all active B2B contracts
PATCH /api/b2b_quotas/{partner_id}/usage → add `delta_kg` to used_quota_kg
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException

from db import b2b_quotas_col
from models import B2BQuota, B2BQuotaUsageUpdate
from utils import deserialize_from_mongo

router = APIRouter(prefix="/b2b_quotas", tags=["b2b_quotas"])


@router.get("", response_model=List[B2BQuota])
async def list_quotas() -> List[B2BQuota]:
    rows = (
        await b2b_quotas_col.find({}, {"_id": 0})
        .sort("partner_name", 1)
        .to_list(100)
    )
    return [B2BQuota(**deserialize_from_mongo(r)) for r in rows]


@router.patch("/{partner_id}/usage", response_model=B2BQuota)
async def update_usage(partner_id: str, payload: B2BQuotaUsageUpdate) -> B2BQuota:
    row = await b2b_quotas_col.find_one({"partner_id": partner_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Partner not found")

    current_used = float(row.get("used_quota_kg", 0))
    new_used = round(current_used + payload.delta_kg, 3)
    if new_used < 0:
        raise HTTPException(
            status_code=400,
            detail=f"used_quota_kg cannot go below 0 (current={current_used}, delta={payload.delta_kg})",
        )
    total = float(row["total_quota_kg"])
    if new_used > total:
        raise HTTPException(
            status_code=400,
            detail=f"Exceeds total quota {total} kg (attempted {new_used})",
        )

    await b2b_quotas_col.update_one(
        {"partner_id": partner_id},
        {"$set": {"used_quota_kg": new_used}},
    )
    updated = await b2b_quotas_col.find_one({"partner_id": partner_id}, {"_id": 0})
    return B2BQuota(**deserialize_from_mongo(updated))
