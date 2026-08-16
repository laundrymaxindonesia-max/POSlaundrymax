"""Iteration 27 backend tests — POS Regular-customer persistence, autocomplete,
   B2B quotas, staff list, and unpaid-orders (piutang) endpoint contracts.

Endpoints exercised:
  POST /api/customers            (create Regular)
  GET  /api/customers?q=         (autocomplete substring)
  POST /api/customers            (duplicate phone → 409)
  GET  /api/b2b_quotas           (4 partners after seed)
  GET  /api/staff                (6 staff after seed)
  GET  /api/orders?payment_status=Nanti  (piutang widget source)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://laundrymax-cashier.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module", autouse=True)
def seed_db():
    r = requests.post(f"{API}/seed/all", timeout=30)
    assert r.status_code == 200
    return r.json()


# ---------- Customers ----------
class TestCustomers:
    def test_create_regular_customer_and_get_via_search(self):
        ts = int(time.time() * 1000)
        name = f"TEST_Reg_{ts}"
        phone = f"0812{ts % 100000000}"
        payload = {"name": name, "phone": phone, "address": "Jl. Testing 27", "type": "Regular"}

        r = requests.post(f"{API}/customers", json=payload, timeout=15)
        assert r.status_code == 201, f"create failed: {r.text}"
        created = r.json()
        assert created["name"] == name
        assert created["phone"] == phone
        assert created["type"] == "Regular"
        assert "id" in created

        # Search first 5 chars of name -> should hit
        q = name[:5]
        r2 = requests.get(f"{API}/customers", params={"q": q, "limit": 25}, timeout=15)
        assert r2.status_code == 200
        rows = r2.json()
        assert any(c["id"] == created["id"] for c in rows), f"created customer not in q={q!r} results"

    def test_duplicate_phone_returns_409(self):
        ts = int(time.time() * 1000) + 1
        phone = f"0813{ts % 100000000}"
        payload = {"name": f"TEST_Dup_{ts}", "phone": phone, "address": "x", "type": "Regular"}
        r1 = requests.post(f"{API}/customers", json=payload, timeout=15)
        assert r1.status_code == 201

        payload2 = {**payload, "name": f"TEST_Dup_{ts}_b"}
        r2 = requests.post(f"{API}/customers", json=payload2, timeout=15)
        assert r2.status_code == 409, f"expected 409 got {r2.status_code}: {r2.text}"
        body = r2.json()
        assert "already exists" in (body.get("detail") or "").lower()


# ---------- B2B Quotas ----------
class TestB2BQuotas:
    def test_list_returns_seeded_partners(self):
        r = requests.get(f"{API}/b2b_quotas", timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 4, f"expected >=4 seeded partners, got {len(rows)}"
        # Sanity: each has partner_name + total_quota_kg + used_quota_kg
        for row in rows:
            assert row.get("partner_name")
            assert isinstance(row.get("total_quota_kg", 0), (int, float))
            assert isinstance(row.get("used_quota_kg", 0), (int, float))
        names = {r.get("partner_name") for r in rows}
        # spec mentions Hotel Tamel / Laskita Kostel / Kost UNPAD / Kosan Wins
        assert any("Tamel" in (n or "") for n in names), f"seed missing Hotel Tamel: {names}"


# ---------- Staff ----------
class TestStaff:
    def test_list_returns_seeded_staff(self):
        r = requests.get(f"{API}/staff", timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 6, f"expected >=6 seeded staff, got {len(rows)}"
        names = {s.get("name") for s in rows}
        for expected in ["Erfa", "Budi", "Dedi"]:
            assert expected in names, f"missing {expected} in {names}"


# ---------- Orders / Piutang ----------
class TestOrdersPiutang:
    def test_orders_payment_status_nanti(self):
        r = requests.get(f"{API}/orders", params={"payment_status": "Nanti", "limit": 200}, timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        # After seed there SHOULD be at least some 'Nanti' orders; but not guaranteed.
        for o in rows:
            assert o.get("payment_status") == "Nanti", f"filter leak: {o.get('payment_status')}"
            assert "order_id" in o

    def test_orders_status_packing_for_courier(self):
        r = requests.get(f"{API}/orders", params={"status": "Packing", "limit": 200}, timeout=15)
        assert r.status_code == 200
        for o in r.json():
            assert o.get("order_status") == "Packing"
