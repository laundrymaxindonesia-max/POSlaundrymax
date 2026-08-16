"""STEP 6 — Proof-of-Delivery upload endpoint.

Covers:
- POST /api/orders/{order_id}/pod success (multipart PNG)
- pod_urls appended, order_events +1, static serving through K8s ingress
- 404 unknown order_id, 415 bad mime, 400 empty file
"""
import io
import os
import struct
import zlib

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://laundrymax-cashier.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _tiny_png() -> bytes:
    """Return a valid 1x1 PNG (~70 bytes)."""
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    ihdr = b"IHDR" + ihdr_data
    ihdr_chunk = struct.pack(">I", len(ihdr_data)) + ihdr + struct.pack(">I", zlib.crc32(ihdr))
    raw = b"\x00\xff\x00\x00"
    comp = zlib.compress(raw)
    idat = b"IDAT" + comp
    idat_chunk = struct.pack(">I", len(comp)) + idat + struct.pack(">I", zlib.crc32(idat))
    iend = b"IEND"
    iend_chunk = struct.pack(">I", 0) + iend + struct.pack(">I", zlib.crc32(iend))
    return sig + ihdr_chunk + idat_chunk + iend_chunk


@pytest.fixture(scope="module", autouse=True)
def seed():
    r = requests.post(f"{API}/seed/all", timeout=30)
    assert r.status_code in (200, 201), r.text


@pytest.fixture(scope="module")
def sample_order_id():
    """Grab an existing seeded order_id (e.g. LND-001)."""
    r = requests.get(f"{API}/orders?limit=1")
    assert r.status_code == 200, r.text
    rows = r.json()
    assert rows, "no orders seeded"
    return rows[0]["order_id"]


class TestPodUpload:
    def test_pod_upload_png_success(self, sample_order_id):
        # Baseline event count
        r0 = requests.get(f"{API}/orders/{sample_order_id}")
        assert r0.status_code == 200
        base_events = len(r0.json().get("order_events", []))
        base_pods = len(r0.json().get("pod_urls", []))

        png = _tiny_png()
        files = {"photo": ("pod.png", io.BytesIO(png), "image/png")}
        data = {"actor": "kurir-budi", "kind": "delivery"}
        r = requests.post(f"{API}/orders/{sample_order_id}/pod", data=data, files=files)
        assert r.status_code == 200, r.text
        body = r.json()

        # pod_urls grew by 1 and starts with /api/uploads/pod/
        assert len(body["pod_urls"]) == base_pods + 1
        new_url = body["pod_urls"][-1]
        assert new_url.startswith("/api/uploads/pod/"), new_url
        assert new_url.endswith(".png")

        # order_events grew by 1
        assert len(body["order_events"]) == base_events + 1

        # Static serving through K8s ingress
        full = f"{BASE_URL}{new_url}"
        r2 = requests.get(full)
        assert r2.status_code == 200, f"{full} → {r2.status_code}"
        assert r2.headers.get("content-type", "").startswith("image/png")
        assert r2.content.startswith(b"\x89PNG")

    def test_pod_upload_unknown_order_returns_404(self):
        png = _tiny_png()
        files = {"photo": ("pod.png", io.BytesIO(png), "image/png")}
        data = {"actor": "kurir-budi", "kind": "delivery"}
        r = requests.post(f"{API}/orders/UNKNOWN-XYZ/pod", data=data, files=files)
        assert r.status_code == 404, r.text

    def test_pod_upload_bad_mime_returns_415(self, sample_order_id):
        files = {"photo": ("pod.txt", io.BytesIO(b"not an image"), "text/plain")}
        data = {"actor": "kurir-budi", "kind": "delivery"}
        r = requests.post(f"{API}/orders/{sample_order_id}/pod", data=data, files=files)
        assert r.status_code == 415, r.text

    def test_pod_upload_empty_returns_400(self, sample_order_id):
        files = {"photo": ("pod.png", io.BytesIO(b""), "image/png")}
        data = {"actor": "kurir-budi", "kind": "delivery"}
        r = requests.post(f"{API}/orders/{sample_order_id}/pod", data=data, files=files)
        assert r.status_code == 400, r.text

    def test_pod_upload_payment_kind_also_works(self, sample_order_id):
        png = _tiny_png()
        files = {"photo": ("pay.png", io.BytesIO(png), "image/png")}
        data = {"actor": "kurir-budi", "kind": "payment"}
        r = requests.post(f"{API}/orders/{sample_order_id}/pod", data=data, files=files)
        assert r.status_code == 200, r.text
        url = r.json()["pod_urls"][-1]
        assert "_payment_" in url

    def test_pod_upload_evidence_kind_with_geotag(self, sample_order_id):
        """kind='evidence' + lat/lng Form fields must land on the event doc in Mongo.

        NOTE: OrderEvent Pydantic model has extra='ignore', so kind/geotag_lat/lng
        are stripped from the JSON response. We assert against Mongo directly.
        """
        import pymongo
        from pathlib import Path
        env = {}
        for line in Path("/app/backend/.env").read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"')
        client = pymongo.MongoClient(env["MONGO_URL"])
        col = client[env["DB_NAME"]]["orders"]

        png = _tiny_png()
        files = {"photo": ("evi.png", io.BytesIO(png), "image/png")}
        data = {"actor": "kasir-erfa", "kind": "evidence", "lat": "-6.9", "lng": "107.6"}
        r = requests.post(f"{API}/orders/{sample_order_id}/pod", data=data, files=files)
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body["pod_urls"]) >= 1
        url = body["pod_urls"][-1]
        assert "_evidence_" in url, url

        # Assert Mongo doc has the raw event with kind + geotag
        doc = col.find_one({"order_id": sample_order_id}, {"order_events": 1, "_id": 0})
        matching = [
            ev for ev in doc["order_events"]
            if ev.get("kind") == "pod:evidence"
            and ev.get("geotag_lat") == -6.9
            and ev.get("geotag_lng") == 107.6
        ]
        assert matching, f"no evidence event with geotag found in {doc['order_events'][-3:]}"

    def test_pod_upload_no_geotag_backward_compat(self, sample_order_id):
        """Without lat/lng, event doc in Mongo must NOT have geotag_* keys."""
        import pymongo
        from pathlib import Path
        env = {}
        for line in Path("/app/backend/.env").read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"')
        client = pymongo.MongoClient(env["MONGO_URL"])
        col = client[env["DB_NAME"]]["orders"]

        png = _tiny_png()
        files = {"photo": ("plain.png", io.BytesIO(png), "image/png")}
        data = {"actor": "kurir-budi", "kind": "delivery"}
        r = requests.post(f"{API}/orders/{sample_order_id}/pod", data=data, files=files)
        assert r.status_code == 200, r.text

        doc = col.find_one({"order_id": sample_order_id}, {"order_events": 1, "_id": 0})
        last_ev = doc["order_events"][-1]
        assert last_ev.get("kind") == "pod:delivery"
        # Since OrderEvent has geotag_lat/lng as Optional[float] (default None),
        # the keys exist but must be None when not supplied.
        assert last_ev.get("geotag_lat") is None
        assert last_ev.get("geotag_lng") is None

