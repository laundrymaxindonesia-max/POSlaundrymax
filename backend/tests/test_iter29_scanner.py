"""Iter-29 regression tests — QR scanner backend endpoints.

Covers:
- PATCH /api/orders/{id}/payment flips Nanti→Lunas, appends kind='payment:lunas'
- Idempotent second call still appends event, still Lunas
- 404 for unknown order on GET + payment PATCH
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def _make_order(payment_status="Nanti", order_status="Antrian"):
    oid = f"LND-TEST-{uuid.uuid4().hex[:8].upper()}"
    payload = {
        "order_id": oid,
        "customer_name": "TEST_ScannerCust",
        "customer_phone": "6280000000000",
        "weight_kg": 2.0,
        "speed_tier": "reguler",
        "total_price": 14000,
        "payment_status": payment_status,
        "order_status": order_status,
        "sumber_order": "walkin",
        "actor": "kasir",
    }
    r = requests.post(f"{API}/orders", json=payload, timeout=10)
    assert r.status_code == 201, r.text
    return oid


def test_get_order_404():
    r = requests.get(f"{API}/orders/LND-DOES-NOT-EXIST-XYZ", timeout=10)
    assert r.status_code == 404
    assert r.json().get("detail") == "Order not found"


def test_payment_patch_flips_nanti_to_lunas():
    oid = _make_order(payment_status="Nanti")
    r = requests.patch(f"{API}/orders/{oid}/payment?actor=kasir_test", timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["payment_status"] == "Lunas"
    kinds = [e.get("kind") for e in body.get("order_events", [])]
    assert "payment:lunas" in kinds

    # GET verifies persistence
    g = requests.get(f"{API}/orders/{oid}", timeout=10)
    assert g.status_code == 200
    assert g.json()["payment_status"] == "Lunas"


def test_payment_patch_idempotent_still_appends_event():
    oid = _make_order(payment_status="Nanti")
    requests.patch(f"{API}/orders/{oid}/payment?actor=first", timeout=10)
    r2 = requests.patch(f"{API}/orders/{oid}/payment?actor=second", timeout=10)
    assert r2.status_code == 200
    body = r2.json()
    assert body["payment_status"] == "Lunas"
    lunas_events = [e for e in body["order_events"] if e.get("kind") == "payment:lunas"]
    assert len(lunas_events) >= 2, f"Expected 2 payment:lunas events, got {len(lunas_events)}"


def test_payment_patch_404_unknown_order():
    r = requests.patch(f"{API}/orders/LND-NOPE-404/payment?actor=kasir", timeout=10)
    assert r.status_code == 404


def test_payment_patch_requires_actor_default_ok():
    # actor query param has default 'kasir' — omitting should still work
    oid = _make_order(payment_status="Nanti")
    r = requests.patch(f"{API}/orders/{oid}/payment", timeout=10)
    assert r.status_code == 200
    assert r.json()["payment_status"] == "Lunas"


def test_status_patch_still_works_alongside_payment():
    # Regression: status endpoint untouched
    oid = _make_order(order_status="Packing", payment_status="Lunas")
    r = requests.patch(
        f"{API}/orders/{oid}/status",
        json={"new_status": "Selesai", "actor": "kasir_test"},
        timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["order_status"] == "Selesai"
