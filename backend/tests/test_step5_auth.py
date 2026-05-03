"""STEP 5 — Auth backend tests.

Covers:
- POST /api/auth/staff-pin (200/403/422)
- GET /api/auth/me (401 without auth)
- POST /api/auth/session (401 with bogus session_id)
- Owner session simulation via direct Mongo seeding (per /app/auth_testing.md Step 1)
- POST /api/auth/logout (deletes the session record)
"""
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://laundrymax-cashier.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="module", autouse=True)
def seed_data():
    # Seed staff so PIN 1234 is valid
    r = requests.post(f"{API}/seed/all", timeout=30)
    assert r.status_code in (200, 201), f"seed failed: {r.status_code} {r.text}"
    yield


# ---------------- Staff PIN ----------------
class TestStaffPin:
    def test_staff_pin_correct_returns_200(self):
        r = requests.post(f"{API}/auth/staff-pin", json={"pin_code": "1234"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body == {"ok": True}

    def test_staff_pin_wrong_returns_403(self):
        r = requests.post(f"{API}/auth/staff-pin", json={"pin_code": "9999"})
        assert r.status_code == 403, r.text
        assert r.json().get("detail") == "PIN salah"

    def test_staff_pin_too_short_returns_422(self):
        r = requests.post(f"{API}/auth/staff-pin", json={"pin_code": "123"})
        assert r.status_code == 422

    def test_staff_pin_missing_field_returns_422(self):
        r = requests.post(f"{API}/auth/staff-pin", json={})
        assert r.status_code == 422

    def test_staff_pin_non_digits_returns_422(self):
        r = requests.post(f"{API}/auth/staff-pin", json={"pin_code": "abcd"})
        assert r.status_code == 422


# ---------------- /auth/me unauthenticated ----------------
class TestAuthMeUnauthenticated:
    def test_me_no_cookie_or_header_returns_401(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401, r.text

    def test_me_invalid_bearer_returns_401(self):
        r = requests.get(
            f"{API}/auth/me",
            headers={"Authorization": "Bearer not-a-real-token"},
        )
        assert r.status_code == 401


# ---------------- /auth/session bogus ----------------
class TestAuthSessionExchange:
    def test_session_exchange_bogus_id_returns_401(self):
        r = requests.post(f"{API}/auth/session", json={"session_id": "bogus-session-" + uuid.uuid4().hex})
        assert r.status_code == 401, r.text


# ---------------- Owner session simulation (per Step 1 mongosh) ----------------
class TestOwnerSessionSimulation:
    @pytest.fixture(autouse=True)
    def seed_owner(self, mongo):
        # Cleanup prior test artifacts
        mongo["users"].delete_many({"email": {"$in": ["theomahrizal@gmail.com", "hacker@gmail.com"]}})
        mongo["user_sessions"].delete_many({"session_token": {"$regex": "^test_session_"}})

        # Owner user + session
        owner_uid = f"test-user-owner-{int(time.time()*1000)}"
        owner_token = f"test_session_owner_{uuid.uuid4().hex}"
        mongo["users"].insert_one({
            "user_id": owner_uid,
            "email": "theomahrizal@gmail.com",
            "name": "Theo Mahrizal",
            "picture": "https://via.placeholder.com/150",
            "created_at": datetime.now(timezone.utc),
        })
        mongo["user_sessions"].insert_one({
            "user_id": owner_uid,
            "session_token": owner_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        })

        # Non-whitelisted user with valid session (should still resolve at /me per spec)
        hacker_uid = f"test-user-hacker-{int(time.time()*1000)}"
        hacker_token = f"test_session_hacker_{uuid.uuid4().hex}"
        mongo["users"].insert_one({
            "user_id": hacker_uid,
            "email": "hacker@gmail.com",
            "name": "Hacker",
            "picture": None,
            "created_at": datetime.now(timezone.utc),
        })
        mongo["user_sessions"].insert_one({
            "user_id": hacker_uid,
            "session_token": hacker_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        })

        self.owner_token = owner_token
        self.hacker_token = hacker_token
        yield
        mongo["users"].delete_many({"user_id": {"$in": [owner_uid, hacker_uid]}})
        mongo["user_sessions"].delete_many({"session_token": {"$in": [owner_token, hacker_token]}})

    def test_me_with_owner_bearer_returns_200(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {self.owner_token}"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email"] == "theomahrizal@gmail.com"
        assert body["name"] == "Theo Mahrizal"
        assert "user_id" in body and isinstance(body["user_id"], str)

    def test_me_with_owner_cookie_returns_200(self):
        r = requests.get(f"{API}/auth/me", cookies={"session_token": self.owner_token})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email"] == "theomahrizal@gmail.com"

    def test_me_with_non_whitelisted_session_returns_403(self):
        """Defense-in-depth: /me now re-enforces OWNER_EMAILS whitelist at read time.

        A Mongo-injected session for a non-whitelisted email must NOT be admitted.
        """
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {self.hacker_token}"})
        assert r.status_code == 403, r.text
        assert r.json().get("detail") == "Akun tidak memiliki akses Owner"

    def test_me_with_non_whitelisted_cookie_returns_403(self):
        """Same defense-in-depth check via cookie path (used by browser)."""
        r = requests.get(f"{API}/auth/me", cookies={"session_token": self.hacker_token})
        assert r.status_code == 403, r.text
        assert r.json().get("detail") == "Akun tidak memiliki akses Owner"

    def test_logout_deletes_session(self, mongo):
        # Sanity: session exists
        assert mongo["user_sessions"].find_one({"session_token": self.owner_token}) is not None
        # Logout via cookie
        r = requests.post(
            f"{API}/auth/logout",
            cookies={"session_token": self.owner_token},
        )
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}
        # Session removed from Mongo
        assert mongo["user_sessions"].find_one({"session_token": self.owner_token}) is None
        # /auth/me with that token now returns 401
        r2 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {self.owner_token}"})
        assert r2.status_code == 401
