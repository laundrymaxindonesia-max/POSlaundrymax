"""Tests for Orders CRUD + Seeding endpoints (LaundryMax Step 2)."""
import os
import pytest
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://laundrymax-cashier.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

STATUS_CHAIN = ["Antrian", "Cuci", "Kering", "Setrika", "Packing", "OTW", "Selesai"]
EXPECTED_DIST = {"Antrian": 5, "Cuci": 5, "Kering": 4, "Setrika": 5, "Packing": 4, "OTW": 4, "Selesai": 8}


@pytest.fixture(scope="module")
def seeded():
    r = requests.post(f"{API}/seed/orders", timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


# --- Seed endpoint ---
def test_seed_returns_correct_distribution(seeded):
    assert seeded["inserted"] == 35
    assert seeded["by_status"] == EXPECTED_DIST


# --- GET /orders list ---
def test_list_all_orders(seeded):
    r = requests.get(f"{API}/orders", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 35
    # sorted DESC by created_at
    for i in range(len(data) - 1):
        assert data[i]["created_at"] >= data[i + 1]["created_at"]
    # required fields
    for o in data:
        for f in ["order_id", "customer_name", "customer_phone", "weight_kg",
                  "total_price", "payment_status", "order_status",
                  "created_at", "order_events"]:
            assert f in o, f"missing {f}"
        assert isinstance(o["order_events"], list)


def test_filter_status_antrian(seeded):
    r = requests.get(f"{API}/orders", params={"status": "Antrian"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 5
    assert all(o["order_status"] == "Antrian" for o in data)


def test_filter_status_selesai(seeded):
    r = requests.get(f"{API}/orders", params={"status": "Selesai"}, timeout=15)
    assert r.status_code == 200
    assert len(r.json()) == 8


def test_filter_payment_lunas(seeded):
    r = requests.get(f"{API}/orders", params={"payment_status": "Lunas"}, timeout=15)
    assert r.status_code == 200
    lunas = r.json()
    assert all(o["payment_status"] == "Lunas" for o in lunas)
    r2 = requests.get(f"{API}/orders", params={"payment_status": "Nanti"}, timeout=15)
    nanti = r2.json()
    assert all(o["payment_status"] == "Nanti" for o in nanti)
    assert len(lunas) + len(nanti) == 35


def test_filter_since_far_past(seeded):
    past = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
    r = requests.get(f"{API}/orders", params={"since": past}, timeout=15)
    assert r.status_code == 200
    assert len(r.json()) == 35


def test_filter_since_future(seeded):
    future = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    r = requests.get(f"{API}/orders", params={"since": future}, timeout=15)
    assert r.status_code == 200
    assert len(r.json()) == 0


def test_limit(seeded):
    r = requests.get(f"{API}/orders", params={"limit": 5}, timeout=15)
    assert r.status_code == 200
    assert len(r.json()) == 5


# --- GET /orders/{id} ---
def test_get_order_by_id(seeded):
    r = requests.get(f"{API}/orders", params={"limit": 1}, timeout=15)
    oid = r.json()[0]["order_id"]
    r2 = requests.get(f"{API}/orders/{oid}", timeout=15)
    assert r2.status_code == 200
    assert r2.json()["order_id"] == oid


def test_get_order_404(seeded):
    r = requests.get(f"{API}/orders/NOPE", timeout=15)
    assert r.status_code == 404


# --- Event chain invariant ---
def test_event_chain_selesai(seeded):
    r = requests.get(f"{API}/orders", params={"status": "Selesai"}, timeout=15)
    for o in r.json():
        events = o["order_events"]
        assert len(events) == 7, f"{o['order_id']} has {len(events)} events"
        assert [e["status"] for e in events] == STATUS_CHAIN


def test_event_chain_antrian(seeded):
    r = requests.get(f"{API}/orders", params={"status": "Antrian"}, timeout=15)
    for o in r.json():
        assert len(o["order_events"]) == 1
        assert o["order_events"][0]["status"] == "Antrian"


# --- POST /orders ---
def test_create_order(seeded):
    # cleanup if exists from a previous run
    payload = {
        "order_id": "TEST-BE-1",
        "customer_name": "API Test",
        "customer_phone": "628",
        "source": "Walk-in",
        "weight_kg": 5.0,
        "total_price": 50000,
        "payment_status": "Lunas",
        "actor": "kasir-test",
    }
    r = requests.post(f"{API}/orders", json=payload, timeout=15)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["order_id"] == "TEST-BE-1"
    assert len(body["order_events"]) == 1
    assert body["order_events"][0]["status"] == "Antrian"
    assert body["order_events"][0]["actor"] == "kasir-test"
    # Verify persistence
    r2 = requests.get(f"{API}/orders/TEST-BE-1", timeout=15)
    assert r2.status_code == 200


def test_create_duplicate_409(seeded):
    payload = {
        "order_id": "TEST-BE-1",
        "customer_name": "Dup",
        "customer_phone": "628",
        "weight_kg": 1.0,
        "total_price": 1000,
    }
    r = requests.post(f"{API}/orders", json=payload, timeout=15)
    assert r.status_code == 409


# --- PATCH /orders/{id}/status ---
def test_patch_status(seeded):
    r = requests.patch(
        f"{API}/orders/TEST-BE-1/status",
        json={"new_status": "Cuci", "actor": "produksi-dedi"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["order_status"] == "Cuci"
    assert len(body["order_events"]) == 2
    assert body["order_events"][1]["status"] == "Cuci"
    assert body["order_events"][1]["actor"] == "produksi-dedi"


def test_patch_404(seeded):
    r = requests.patch(
        f"{API}/orders/NOPE/status",
        json={"new_status": "Cuci", "actor": "x"},
        timeout=15,
    )
    assert r.status_code == 404


def test_patch_invalid_status_422(seeded):
    r = requests.patch(
        f"{API}/orders/TEST-BE-1/status",
        json={"new_status": "Flying", "actor": "x"},
        timeout=15,
    )
    assert r.status_code == 422


def test_patch_empty_actor_422(seeded):
    r = requests.patch(
        f"{API}/orders/TEST-BE-1/status",
        json={"new_status": "Kering", "actor": ""},
        timeout=15,
    )
    assert r.status_code == 422
