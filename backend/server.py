"""LaundryMax FastAPI application entry point.

Only boilerplate + legacy status-check routes + health probe live here.
Domain routes (orders, customers, prices, b2b_quotas, staff, attendance)
will land in /app/backend/routes/ in subsequent backend steps.
"""

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import APIRouter, FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

import os

# Centralised Mongo client + collection handles
from db import client, db, ping, close  # noqa: F401  (db/client re-exported for tests)

# Import models package eagerly so schemas are validated at boot
import models  # noqa: F401

# Domain routers
from routes.auth import router as auth_router
from routes.orders import router as orders_router
from routes.prices import router as prices_router
from routes.customers import router as customers_router
from routes.b2b_quotas import router as b2b_quotas_router
from routes.staff_attendance import router as staff_attendance_router
from routes.seed import router as seed_router
from routes.receipt_settings import router as receipt_settings_router


# ---------------- FastAPI app ----------------
app = FastAPI(title="LaundryMax API", version="0.1.0")
api_router = APIRouter(prefix="/api")


# ---------------- Legacy StatusCheck (kept for regression) ----------------
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


@api_router.get("/")
async def root():
    return {"message": "LaundryMax API is running"}


@api_router.get("/health")
async def health():
    """Liveness + Mongo ping probe."""
    try:
        await ping()
        mongo_ok = True
    except Exception as exc:  # pragma: no cover - surfaced in status string
        mongo_ok = False
        logging.getLogger(__name__).warning("Mongo ping failed: %s", exc)

    return {
        "status": "ok" if mongo_ok else "degraded",
        "mongo": mongo_ok,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(payload: StatusCheckCreate):
    status_obj = StatusCheck(**payload.model_dump())
    doc = status_obj.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    rows = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for r in rows:
        if isinstance(r.get("timestamp"), str):
            r["timestamp"] = datetime.fromisoformat(r["timestamp"])
    return rows


app.include_router(api_router)
app.include_router(auth_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(prices_router, prefix="/api")
app.include_router(customers_router, prefix="/api")
app.include_router(b2b_quotas_router, prefix="/api")
app.include_router(staff_attendance_router, prefix="/api")
app.include_router(seed_router, prefix="/api")
app.include_router(receipt_settings_router, prefix="/api")

# Static files for uploaded selfies etc. Mounted under /api/uploads so the
# Kubernetes ingress (which only forwards /api/* to the backend) serves them.
UPLOADS_DIR = Path(__file__).resolve().parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
(UPLOADS_DIR / "attendance").mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    await close()
