"""Iteration 28 backend regression tests.

Covers:
- Empty DB behavior after seed (orders & customers wipe-only)
- ReceiptSettings.logo_url field (GET/PUT round-trip, max 500)
- RBAC scaffolding imports (models.users + db collections)
"""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


@pytest.fixture
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---- Seed wipe-only behavior ----
class TestSeedWipeBehavior:
    def test_seed_all_returns_zero_orders_and_customers(self, s):
        r = s.post(f"{BASE_URL}/api/seed/all")
        assert r.status_code == 200, r.text
        data = r.json()
        # orders + customers must both be wipe-only
        assert data["orders"]["inserted"] == 0
        assert data["customers"]["inserted"] == 0
        # prices/b2b/staff still seeded
        assert data["prices"]["inserted"] > 0
        assert data["b2b_quotas"]["inserted"] > 0
        assert data["staff"]["inserted"] > 0

    def test_get_orders_empty_after_seed(self, s):
        s.post(f"{BASE_URL}/api/seed/all")
        r = s.get(f"{BASE_URL}/api/orders")
        assert r.status_code == 200
        assert r.json() == []

    def test_get_customers_empty_after_seed(self, s):
        s.post(f"{BASE_URL}/api/seed/all")
        r = s.get(f"{BASE_URL}/api/customers")
        assert r.status_code == 200
        assert r.json() == []

    def test_seed_orders_endpoint_wipe_only(self, s):
        r = s.post(f"{BASE_URL}/api/seed/orders")
        assert r.status_code == 200
        assert r.json()["inserted"] == 0

    def test_seed_customers_endpoint_wipe_only(self, s):
        r = s.post(f"{BASE_URL}/api/seed/customers")
        assert r.status_code == 200
        assert r.json()["inserted"] == 0


# ---- Receipt Settings logo_url ----
class TestReceiptLogo:
    def test_get_receipt_settings_has_logo_url(self, s):
        r = s.get(f"{BASE_URL}/api/receipt-settings")
        assert r.status_code == 200
        data = r.json()
        assert "logo_url" in data
        assert isinstance(data["logo_url"], str)

    def test_put_logo_url_persists(self, s):
        # Read current settings to preserve required fields
        current = s.get(f"{BASE_URL}/api/receipt-settings").json()
        payload = {
            "header_order": current.get("header_order", ["speed", "qr", "logo"]),
            "store_name": current.get("store_name", "LAUNDRYMAX"),
            "store_address": current.get("store_address", "Jl. Test"),
            "store_phone": current.get("store_phone", "0812"),
            "footer_message": current.get("footer_message", "TY"),
            "paper_width": current.get("paper_width", "58mm"),
            "logo_url": "https://example.com/logo.png",
        }
        r = s.put(f"{BASE_URL}/api/receipt-settings", json=payload)
        assert r.status_code == 200, r.text
        assert r.json()["logo_url"] == "https://example.com/logo.png"

        # GET echoes
        r2 = s.get(f"{BASE_URL}/api/receipt-settings")
        assert r2.json()["logo_url"] == "https://example.com/logo.png"

        # Cleanup: reset to empty
        payload["logo_url"] = ""
        s.put(f"{BASE_URL}/api/receipt-settings", json=payload)

    def test_put_logo_url_max_500_chars(self, s):
        current = s.get(f"{BASE_URL}/api/receipt-settings").json()
        too_long = "https://example.com/" + ("a" * 500)
        payload = {**current, "logo_url": too_long}
        payload.pop("id", None)
        payload.pop("updated_at", None)
        r = s.put(f"{BASE_URL}/api/receipt-settings", json=payload)
        assert r.status_code in (400, 422), f"Expected validation error, got {r.status_code}"


# ---- RBAC scaffolding ----
class TestRBACScaffolding:
    def test_users_models_import(self):
        from models.users import User, UserSession, RoleAssignment, ROLE_HIERARCHY  # noqa
        u = User(email="test@example.com", name="Test", roles=["super_admin"])
        assert u.id
        assert u.roles == ["super_admin"]

    def test_db_collection_handles_exist(self):
        from db import users_col, user_sessions_col, role_assignments_col
        assert users_col is not None
        assert user_sessions_col is not None
        assert role_assignments_col is not None

    def test_users_col_insert_and_cleanup(self):
        import asyncio
        from db import users_col

        async def _run():
            doc = {"id": "TEST_iter28_user", "email": "test_iter28@example.com", "name": "T"}
            await users_col.delete_many({"id": "TEST_iter28_user"})
            res = await users_col.insert_one(doc)
            assert res.inserted_id is not None
            found = await users_col.find_one({"id": "TEST_iter28_user"})
            assert found["email"] == "test_iter28@example.com"
            await users_col.delete_many({"id": "TEST_iter28_user"})

        asyncio.run(_run())
