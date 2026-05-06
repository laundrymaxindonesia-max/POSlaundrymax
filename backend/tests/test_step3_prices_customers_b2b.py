"""STEP 3 backend tests: Prices, Customers, B2B Quotas, Seed.

Run order matters: seed/all first, then resource tests, then re-seed if mutated.
"""
from __future__ import annotations

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend env file (used in tests harness)
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ------------- Seed (run first) -------------
def test_seed_all_returns_expected_counts(client):
    r = client.post(f"{API}/seed/all", timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["orders"]["inserted"] == 35
    assert j["prices"]["inserted"] == 8
    assert j["customers"]["inserted"] == 5
    assert j["b2b_quotas"]["inserted"] == 4


# ------------- Prices -------------
def test_get_prices_returns_canonical_rows(client):
    r = client.get(f"{API}/prices", timeout=10)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 8
    # (label, unit, umum, tamel, laskita, member)
    expected = {
        "kiloan_reguler": ("Cuci Kiloan — Reguler (3 hari)", "/kg",  7000,  8000,  8000,  8000),
        "kiloan_flash":   ("Cuci Kiloan — Flash (1 hari)",   "/kg",  10000, 12000, 12000, 12000),
        "kiloan_express": ("Cuci Kiloan — Express (5 jam)",  "/kg",  18500, 20000, 20000, 20000),
        "satuan":   ("Satuan (Kemeja/Celana)",     "/pcs", 15000, 15000, 18000, 13500),
        "sepatu":   ("Sepatu",                     "/pcs", 30000, 30000, 35000, 27000),
        "jas":      ("Jas / Coat",                 "/pcs", 25000, 25000, 30000, 22500),
        "karpet":   ("Karpet",                     "/m²",  30000, 30000, 35000, 27000),
        "showcase": ("Showcase (Gas/Air)",         "/pcs", 20000, 20000, 22000, 18000),
    }
    by_id = {r["service_id"]: r for r in rows}
    for sid, (label, unit, umum, tamel, laskita, member) in expected.items():
        assert sid in by_id, f"missing {sid}"
        row = by_id[sid]
        assert row["label"] == label
        assert row["unit"] == unit
        assert row["umum"] == umum
        assert row["tamel"] == tamel
        assert row["laskita"] == laskita
        assert row["member"] == member


def test_prices_bulk_replace_then_reseed(client):
    payload = [
        {"service_id": "kiloan_reguler", "label": "Cuci Kiloan", "unit": "/kg",
         "umum": 999, "tamel": 1234, "laskita": 2345, "member": 3456},
        {"service_id": "jas", "label": "Jas / Coat", "unit": "/pcs",
         "umum": 9999, "tamel": 11111, "laskita": 22222, "member": 33333},
    ]
    r = client.post(f"{API}/prices/bulk", json=payload, timeout=10)
    assert r.status_code == 200, r.text
    assert len(r.json()) == 2

    g = client.get(f"{API}/prices").json()
    assert len(g) == 2
    sids = sorted([row["service_id"] for row in g])
    assert sids == ["jas", "kiloan_reguler"]

    # restore
    rs = client.post(f"{API}/seed/prices")
    assert rs.status_code == 200
    assert rs.json()["inserted"] == 8


def test_prices_bulk_invalid_missing_field(client):
    bad = [{"service_id": "kiloan", "label": "Cuci Kiloan", "unit": "/kg",
            "tamel": 6000, "laskita": 7500}]  # missing member
    r = client.post(f"{API}/prices/bulk", json=bad)
    assert r.status_code == 422


def test_prices_bulk_invalid_negative(client):
    bad = [{"service_id": "kiloan", "label": "Cuci Kiloan", "unit": "/kg",
            "tamel": -1, "laskita": 7500, "member": 5400}]
    r = client.post(f"{API}/prices/bulk", json=bad)
    assert r.status_code == 422


def test_prices_bulk_accepts_arbitrary_service_id(client):
    """service_id is now `str` (was Literal) to allow new categories like
    `kiloan_reguler` / `kiloan_flash` / `kiloan_express` without bumping the
    Pydantic model. Empty string still rejected via min_length=1."""
    custom = [{"service_id": "future_premium", "label": "Premium", "unit": "/kg",
               "umum": 1, "tamel": 2, "laskita": 3, "member": 4}]
    r = client.post(f"{API}/prices/bulk", json=custom)
    assert r.status_code == 200, r.text

    bad_empty = [{"service_id": "", "label": "x", "unit": "/kg",
                  "umum": 0, "tamel": 1, "laskita": 2, "member": 3}]
    r = client.post(f"{API}/prices/bulk", json=bad_empty)
    assert r.status_code == 422

    # Re-seed to make sure prices are consistent
    client.post(f"{API}/seed/prices")


# ------------- Customers -------------
def test_get_customers_returns_five_with_expected_mix(client):
    r = client.get(f"{API}/customers")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 5
    regulars = [c for c in rows if c["type"] == "Regular"]
    members = [c for c in rows if c["type"] == "Member"]
    assert len(regulars) == 2
    assert len(members) == 3
    tiers = sorted([m["member_tier"] for m in members])
    assert tiers == ["Gold", "Platinum", "Silver"]
    quotas = {m["member_tier"]: m["remaining_quota_kg"] for m in members}
    assert quotas["Silver"] == 18.0
    assert quotas["Gold"] == 32.5
    assert quotas["Platinum"] == 48.0


def test_customers_search_by_name(client):
    r = client.get(f"{API}/customers", params={"q": "citra"})
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["name"] == "Citra Wibowo"


def test_customers_search_by_phone(client):
    r = client.get(f"{API}/customers", params={"q": "6281"})
    # at least one but may be 0 if phones don't have 6281; check seed
    # Seed phones: 082111223344, 082255443322, 087877668899, 085622334455, 081211000005
    # No phones contain '6281'. Use a substring that matches: '082'
    assert r.status_code == 200
    # adjust: try substring that does match
    r2 = client.get(f"{API}/customers", params={"q": "082"})
    assert r2.status_code == 200
    assert len(r2.json()) >= 1


def test_get_customer_by_id_and_404(client):
    rows = client.get(f"{API}/customers").json()
    target = rows[0]
    r = client.get(f"{API}/customers/{target['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == target["id"]

    r404 = client.get(f"{API}/customers/does-not-exist-uuid")
    assert r404.status_code == 404


def test_create_customer_and_duplicate_phone(client):
    payload = {
        "name": "TEST_NewCust",
        "phone": "0899TESTUNIQUE001",
        "address": "Jl. Tes",
        "type": "Regular",
    }
    r = client.post(f"{API}/customers", json=payload)
    assert r.status_code == 201, r.text
    j = r.json()
    assert "id" in j and "created_at" in j

    # duplicate
    r2 = client.post(f"{API}/customers", json=payload)
    assert r2.status_code == 409


def test_deduct_member_quota_decrements(client):
    rows = client.get(f"{API}/customers").json()
    member = next(c for c in rows if c["type"] == "Member"
                  and c["remaining_quota_kg"] >= 5)
    before = member["remaining_quota_kg"]
    r = client.patch(f"{API}/customers/{member['id']}/deduct", json={"kg": 2.5})
    assert r.status_code == 200, r.text
    after = r.json()["remaining_quota_kg"]
    assert round(before - after, 3) == 2.5


def test_deduct_regular_returns_400(client):
    rows = client.get(f"{API}/customers").json()
    regular = next(c for c in rows if c["type"] == "Regular")
    r = client.patch(f"{API}/customers/{regular['id']}/deduct", json={"kg": 1})
    assert r.status_code == 400


def test_deduct_insufficient_quota(client):
    rows = client.get(f"{API}/customers").json()
    member = next(c for c in rows if c["type"] == "Member")
    r = client.patch(f"{API}/customers/{member['id']}/deduct",
                     json={"kg": 99999})
    assert r.status_code == 400


def test_deduct_kg_zero_or_negative_returns_422(client):
    rows = client.get(f"{API}/customers").json()
    member = next(c for c in rows if c["type"] == "Member")
    r0 = client.patch(f"{API}/customers/{member['id']}/deduct", json={"kg": 0})
    assert r0.status_code == 422
    rn = client.patch(f"{API}/customers/{member['id']}/deduct", json={"kg": -1})
    assert rn.status_code == 422


# ------------- B2B Quotas -------------
def test_b2b_list_four_partners_sorted_by_name(client):
    # Re-seed to known state
    client.post(f"{API}/seed/b2b")
    r = client.get(f"{API}/b2b_quotas")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 4
    names = [r["partner_name"] for r in rows]
    assert names == sorted(names), f"not sorted: {names}"
    by_id = {r["partner_id"]: r for r in rows}
    assert by_id["tamel"]["total_quota_kg"] == 500
    assert by_id["tamel"]["used_quota_kg"] == 312
    assert by_id["laskita"]["used_quota_kg"] == 285
    assert by_id["kostunpad"]["total_quota_kg"] == 800
    assert by_id["kostunpad"]["used_quota_kg"] == 410
    assert by_id["wins"]["used_quota_kg"] == 124


def test_b2b_usage_positive_delta(client):
    client.post(f"{API}/seed/b2b")
    r = client.patch(f"{API}/b2b_quotas/tamel/usage", json={"delta_kg": 15})
    assert r.status_code == 200, r.text
    assert r.json()["used_quota_kg"] == 327


def test_b2b_usage_exceeds_total_returns_400(client):
    client.post(f"{API}/seed/b2b")
    r = client.patch(f"{API}/b2b_quotas/tamel/usage", json={"delta_kg": 999})
    assert r.status_code == 400


def test_b2b_usage_below_zero_returns_400(client):
    client.post(f"{API}/seed/b2b")
    r = client.patch(f"{API}/b2b_quotas/laskita/usage", json={"delta_kg": -400})
    assert r.status_code == 400


def test_b2b_usage_unknown_partner_returns_404(client):
    r = client.patch(f"{API}/b2b_quotas/NOPE/usage", json={"delta_kg": 1})
    assert r.status_code == 404


# ------------- No regression: dashboard/orders -------------
def test_dashboard_orders_still_listed(client):
    r = client.get(f"{API}/orders")
    assert r.status_code == 200
    assert len(r.json()) == 35
