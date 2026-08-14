"""Tests for storage.py — the R2 / local-disk hybrid backend.

We only exercise the LOCAL fallback path here (no R2 credentials in CI/preview).
The R2 code path is validated manually per DEPLOYMENT.md §6 after the owner
configures the four R2 env vars on Render.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

# Add backend dir to sys.path so `import storage` works when pytest runs from repo root.
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import storage  # noqa: E402


def test_is_r2_enabled_defaults_to_false(monkeypatch):
    for var in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"):
        monkeypatch.setattr(storage, var, "")
    assert storage.is_r2_enabled() is False


def test_is_r2_enabled_requires_all_four(monkeypatch):
    monkeypatch.setattr(storage, "R2_ACCOUNT_ID", "acc")
    monkeypatch.setattr(storage, "R2_ACCESS_KEY_ID", "key")
    monkeypatch.setattr(storage, "R2_SECRET_ACCESS_KEY", "sec")
    monkeypatch.setattr(storage, "R2_BUCKET", "")  # one missing → disabled
    assert storage.is_r2_enabled() is False
    monkeypatch.setattr(storage, "R2_BUCKET", "b")
    assert storage.is_r2_enabled() is True


def test_make_object_key_shape():
    k = storage.make_object_key("attendance", "staff42", "image/jpeg")
    assert k.startswith("attendance/staff42_")
    assert k.endswith(".jpg")
    # 10-char uuid suffix
    stem = k.rsplit("_", 1)[1].rsplit(".", 1)[0]
    assert len(stem) == 10


def test_make_object_key_maps_content_types():
    assert storage.make_object_key("pod", "o1", "image/png").endswith(".png")
    assert storage.make_object_key("pod", "o1", "image/webp").endswith(".webp")
    # Unknown MIME defaults to jpg
    assert storage.make_object_key("pod", "o1", "application/octet-stream").endswith(".jpg")


def test_save_image_bytes_local_writes_to_disk(monkeypatch, tmp_path):
    """When R2 is off, save_image_bytes writes raw bytes to uploads_dir/<key>."""
    monkeypatch.setattr(storage, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(storage, "R2_BUCKET", "")  # force local

    key = "attendance/test_local.jpg"
    payload = b"\xff\xd8\xff\xe0jpeg-magic-bytes"
    returned = asyncio.get_event_loop().run_until_complete(
        storage.save_image_bytes(payload, key=key, content_type="image/jpeg")
    )
    assert returned == key
    written = tmp_path / key
    assert written.read_bytes() == payload


def test_resolve_url_passthrough_for_legacy(monkeypatch):
    """Legacy `/api/uploads/...` URLs and any http(s):// URL pass through."""
    monkeypatch.setattr(storage, "R2_BUCKET", "")
    loop = asyncio.get_event_loop()
    assert (
        loop.run_until_complete(storage.resolve_url("/api/uploads/attendance/x.jpg"))
        == "/api/uploads/attendance/x.jpg"
    )
    assert (
        loop.run_until_complete(storage.resolve_url("https://cdn.example.com/x.jpg"))
        == "https://cdn.example.com/x.jpg"
    )


def test_resolve_url_local_wraps_bare_key(monkeypatch):
    monkeypatch.setattr(storage, "R2_BUCKET", "")
    loop = asyncio.get_event_loop()
    assert (
        loop.run_until_complete(storage.resolve_url("attendance/staff1_abc.jpg"))
        == "/api/uploads/attendance/staff1_abc.jpg"
    )


def test_resolve_url_handles_none(monkeypatch):
    monkeypatch.setattr(storage, "R2_BUCKET", "")
    loop = asyncio.get_event_loop()
    assert loop.run_until_complete(storage.resolve_url(None)) is None
    assert loop.run_until_complete(storage.resolve_url("")) is None


def test_delete_object_local_removes_file(tmp_path, monkeypatch):
    """delete_object() must remove the on-disk file in local (non-R2) mode."""
    monkeypatch.setattr(storage, "R2_BUCKET", "")
    monkeypatch.setattr(storage, "UPLOADS_DIR", tmp_path)
    key = "pod/cleanup_test_abc.jpg"
    target = tmp_path / key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(b"tobedeleted")
    assert target.exists()
    loop = asyncio.get_event_loop()
    loop.run_until_complete(storage.delete_object(key))
    assert not target.exists()
    # Idempotent: calling again on missing key must not raise
    loop.run_until_complete(storage.delete_object(key))
    # None / empty must be no-op
    loop.run_until_complete(storage.delete_object(None))
    loop.run_until_complete(storage.delete_object(""))



@pytest.mark.skipif(
    not storage.is_r2_enabled(),
    reason="R2 env vars not configured — smoke test only runs in prod / with real creds.",
)
def test_r2_smoke_upload_and_presign():
    """Run only when R2 creds are actually present. Uploads a tiny blob and
    verifies the resolved URL is a presigned R2 URL."""
    key = f"attendance/smoke_{asyncio.get_event_loop().time():.0f}.jpg"
    loop = asyncio.get_event_loop()
    loop.run_until_complete(
        storage.save_image_bytes(b"smoke-test", key=key, content_type="image/jpeg")
    )
    url = loop.run_until_complete(storage.resolve_url(key))
    assert url and "X-Amz-Signature" in url and "r2.cloudflarestorage.com" in url
    # Cleanup
    loop.run_until_complete(storage.delete_object(key))
