"""Tests for /api/receipt-settings CRUD (singleton config document)."""

import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://laundrymax-cashier.preview.emergentagent.com",
).rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
API = f"{BASE_URL}/api"

# Match backend constants without importing motor / async modules
SETTINGS_ID = "default"
KNOWN_HEADER_SLOTS = ["speed", "qr", "logo"]


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture(autouse=True)
def _wipe(mongo):
    mongo["receipt_settings"].delete_many({"id": SETTINGS_ID})
    yield


def test_get_seeds_default_on_first_call():
    r = requests.get(f"{API}/receipt-settings", timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["store_name"] == "LAUNDRYMAX"
    assert body["header_order"] == ["speed", "qr", "logo"]
    assert body["paper_width"] in ("58mm", "80mm")
    assert body["id"] == SETTINGS_ID
    # Second GET is idempotent (no new row created)
    r2 = requests.get(f"{API}/receipt-settings", timeout=10)
    assert r2.status_code == 200
    assert r2.json()["store_name"] == body["store_name"]
    assert r2.json()["header_order"] == body["header_order"]


def test_put_replaces_and_persists():
    payload = {
        "header_order": ["logo", "qr", "speed"],
        "store_name": "LaundryMax Bandung",
        "store_address": "Jl. Merdeka 42, Bandung",
        "store_phone": "0812-1111-2222",
        "footer_message": "Barang hilang tidak ditanggung setelah 30 hari.",
        "paper_width": "80mm",
    }
    r = requests.put(f"{API}/receipt-settings", json=payload, timeout=10)
    assert r.status_code == 200, r.text
    fresh = r.json()
    assert fresh["header_order"] == ["logo", "qr", "speed"]
    assert fresh["store_name"] == "LaundryMax Bandung"
    assert fresh["paper_width"] == "80mm"

    g = requests.get(f"{API}/receipt-settings", timeout=10).json()
    assert g["store_name"] == "LaundryMax Bandung"
    assert g["paper_width"] == "80mm"


def test_put_appends_missing_known_slots():
    r = requests.put(
        f"{API}/receipt-settings",
        json={"header_order": ["speed"]},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    assert r.json()["header_order"] == [
        "speed",
        *[s for s in KNOWN_HEADER_SLOTS if s != "speed"],
    ]


def test_put_dedupes_repeats():
    r = requests.put(
        f"{API}/receipt-settings",
        json={"header_order": ["qr", "qr", "speed", "logo", "qr"]},
        timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["header_order"] == ["qr", "speed", "logo"]


def test_put_rejects_invalid_paper_width():
    r = requests.put(
        f"{API}/receipt-settings",
        json={
            "header_order": ["speed", "qr", "logo"],
            "store_name": "X",
            "store_address": "A",
            "store_phone": "1",
            "footer_message": "",
            "paper_width": "112mm",
        },
        timeout=10,
    )
    assert r.status_code == 422
