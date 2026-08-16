"""MongoDB connection & collection handles for LaundryMax.

Single place of truth for the async Motor client, the target database, and
every domain collection. Import handles from here — never instantiate a new
client elsewhere.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

client: AsyncIOMotorClient = AsyncIOMotorClient(MONGO_URL)
db: AsyncIOMotorDatabase = client[DB_NAME]

# ---- Collection handles (one per Pydantic domain model) ----
orders_col = db["orders"]
customers_col = db["customers"]
prices_col = db["prices"]
b2b_quotas_col = db["b2b_quotas"]
staff_col = db["staff"]
attendance_col = db["attendance"]
receipt_settings_col = db["receipt_settings"]


async def ping() -> bool:
    """Lightweight liveness probe used by /api/health."""
    await client.admin.command("ping")
    return True


async def close() -> None:
    client.close()
