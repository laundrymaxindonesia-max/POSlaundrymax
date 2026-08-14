"""Storage abstraction: local disk in dev/preview, Cloudflare R2 in production.

Design:
- Callers pass raw bytes + a category ('attendance' | 'pod') + a filename.
- ``save_image_bytes`` returns the **object key** (e.g. ``attendance/xyz.jpg``),
  which is what we persist in MongoDB. The key is stable across environments.
- ``resolve_url`` turns a stored key into a URL the frontend can use:
  * If R2 is configured → a 15-minute presigned GET URL.
  * Otherwise → the legacy ``/api/uploads/<key>`` path served by StaticFiles.
- Legacy DB rows that hold a full ``/api/uploads/...`` URL (pre-migration)
  are passed through ``resolve_url`` untouched so the frontend keeps working.

R2 activates automatically as soon as **all 4** required env vars are set:
``R2_ACCOUNT_ID``, ``R2_ACCESS_KEY_ID``, ``R2_SECRET_ACCESS_KEY``, ``R2_BUCKET``.
Missing any one → we transparently fall back to local disk (safe for dev).
"""

from __future__ import annotations

import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator, Optional

import aioboto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

log = logging.getLogger(__name__)

# ---------------- Env / paths ----------------
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "").strip()
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "").strip()
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "").strip()
R2_BUCKET = os.environ.get("R2_BUCKET", "").strip()
R2_ENDPOINT_URL = os.environ.get("R2_ENDPOINT_URL", "").strip() or (
    f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com" if R2_ACCOUNT_ID else ""
)
R2_PRESIGNED_TTL = int(os.environ.get("R2_PRESIGNED_GET_TTL", "900"))  # 15 min

UPLOADS_DIR = Path(__file__).resolve().parent / "uploads"

# MIME → file extension (kept in sync with the two upload routes).
_EXT_BY_TYPE = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def is_r2_enabled() -> bool:
    """R2 activates only when all four credentials are present."""
    return bool(
        R2_ACCOUNT_ID and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY and R2_BUCKET
    )


def make_object_key(category: str, prefix: str, content_type: str) -> str:
    """Build a stable per-upload object key: ``<category>/<prefix>_<uuid>.<ext>``.

    ``prefix`` is a caller-supplied stem (e.g. staff_id or order_id) that helps
    humans grep for a file; the uuid guarantees uniqueness.
    """
    ext = _EXT_BY_TYPE.get(content_type, "jpg")
    return f"{category}/{prefix}_{uuid.uuid4().hex[:10]}.{ext}"


# ---------------- R2 client ----------------
@asynccontextmanager
async def _r2_client() -> AsyncIterator:
    """Async S3 client for R2. Constructed per-request (small, self-contained).

    For extremely high traffic we could lift this into the FastAPI lifespan
    with ``AsyncExitStack``, but for our current load (a handful of uploads
    per minute) per-request creation is simpler and safer.
    """
    session = aioboto3.Session()
    async with session.client(
        "s3",
        endpoint_url=R2_ENDPOINT_URL,
        region_name="auto",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
            connect_timeout=10,
            read_timeout=60,
        ),
    ) as client:
        yield client


# ---------------- Public API ----------------
async def save_image_bytes(
    raw: bytes,
    *,
    key: str,
    content_type: str,
) -> str:
    """Persist ``raw`` at ``key`` (either to R2 or to local disk).

    Returns the same ``key`` unchanged — callers store this in MongoDB.
    Raises the underlying storage error if R2 mode fails; the endpoint
    should convert that to a 502 for the client.
    """
    if is_r2_enabled():
        try:
            async with _r2_client() as client:
                await client.put_object(
                    Bucket=R2_BUCKET,
                    Key=key,
                    Body=raw,
                    ContentType=content_type,
                    ContentLength=len(raw),
                )
            log.info("R2 uploaded key=%s size=%d", key, len(raw))
            return key
        except (ClientError, BotoCoreError) as exc:
            log.exception("R2 upload failed for key=%s: %s", key, exc)
            raise

    # Local-disk fallback
    dest = UPLOADS_DIR / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(raw)
    return key


async def resolve_url(stored: Optional[str]) -> Optional[str]:
    """Turn a stored key (or a legacy full URL) into a usable frontend URL.

    - ``None`` / empty → ``None``.
    - Legacy path starting with ``/api/uploads/`` → returned unchanged (still
      served by StaticFiles, which we keep mounted for backward compat).
    - Modern bare key (``attendance/xxx.jpg``, ``pod/xxx.jpg``) → presigned
      R2 URL if R2 is enabled, otherwise the mounted ``/api/uploads/`` path.
    """
    if not stored:
        return None
    if stored.startswith("/api/uploads/") or stored.startswith("http"):
        return stored  # legacy full URL or already-signed URL

    key = stored.lstrip("/")
    if is_r2_enabled():
        try:
            async with _r2_client() as client:
                return await client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": R2_BUCKET, "Key": key},
                    ExpiresIn=max(60, min(R2_PRESIGNED_TTL, 900)),
                )
        except (ClientError, BotoCoreError) as exc:
            log.exception("R2 presign failed for key=%s: %s", key, exc)
            # Fall through to local path so the app still shows *something*
    return f"/api/uploads/{key}"


async def delete_object(stored: Optional[str]) -> None:
    """Best-effort deletion. Used by cleanup jobs / lifecycle enforcement.

    Silent on all errors — deletion never blocks the caller path.
    """
    if not stored:
        return
    key = stored.lstrip("/")
    if key.startswith("api/uploads/"):
        key = key[len("api/uploads/"):]

    if is_r2_enabled():
        try:
            async with _r2_client() as client:
                await client.delete_object(Bucket=R2_BUCKET, Key=key)
        except (ClientError, BotoCoreError):
            log.exception("R2 delete failed key=%s", key)
        return

    local = UPLOADS_DIR / key
    try:
        if local.exists():
            local.unlink()
    except OSError:
        log.exception("Local delete failed path=%s", local)
