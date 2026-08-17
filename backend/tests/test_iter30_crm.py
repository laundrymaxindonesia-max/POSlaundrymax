"""Iter-30 CRM tests — customers filtering/PATCH/CSV + prospects CRUD/convert.

Covers:
- GET /api/customers?source= &type= filters
- PATCH /api/customers/{id} partial update + phone conflict 409
- GET /api/customers/export.csv header + rowcount
- POST /api/customers/import upsert
- POST /api/prospects (default status + 409 dup phone)
- GET /api/prospects?status= filter
- PATCH /api/prospects/{id} stamps followed_up_at when Sudah Ditawari
- POST /api/prospects/{id}/convert → customer + prospect Konversi
- DELETE /api/prospects/{id}
- Prospects CSV export/import
"""

import os
import uuid
import pytest
import requests

from pathlib import Path
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
except Exception:
    pass
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


def _uniq(prefix: str = "TEST_") -> str:
    return f"{prefix}{uuid.uuid4().hex[:8]}"


def _phone() -> str:
    return "08" + uuid.uuid4().hex[:10]


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_ids():
    """Track ids so we can attempt best-effort cleanup at teardown."""
    return {"customers": [], "prospects": []}


# ---------------------------------------------------------------- Customers filter
class TestCustomersFilter:
    def test_seed_and_filter_by_source_and_type(self, client, created_ids):
        # Create 3 customers with different sources/types
        c1 = client.post(f"{API}/customers", json={
            "name": _uniq("TEST_TM_"), "phone": _phone(),
            "type": "Regular", "source_category": "Taman Melati"
        })
        assert c1.status_code == 201, c1.text
        created_ids["customers"].append(c1.json()["id"])

        c2 = client.post(f"{API}/customers", json={
            "name": _uniq("TEST_WL_"), "phone": _phone(),
            "type": "Member", "member_tier": "Silver",
            "source_category": "Walk-in Laskita",
            "remaining_quota_kg": 20.0,
        })
        assert c2.status_code == 201, c2.text
        c2_id = c2.json()["id"]
        created_ids["customers"].append(c2_id)

        c3 = client.post(f"{API}/customers", json={
            "name": _uniq("TEST_B2B_"), "phone": _phone(),
            "type": "Member", "member_tier": "Gold",
            "source_category": "B2B Kosan",
            "remaining_quota_kg": 50.0,
        })
        assert c3.status_code == 201, c3.text
        created_ids["customers"].append(c3.json()["id"])

        # ?source=Taman Melati
        r = client.get(f"{API}/customers", params={"source": "Taman Melati"})
        assert r.status_code == 200
        assert all(x["source_category"] == "Taman Melati" for x in r.json())
        assert c1.json()["id"] in [x["id"] for x in r.json()]

        # ?type=Regular
        r = client.get(f"{API}/customers", params={"type": "Regular"})
        assert r.status_code == 200
        assert all(x["type"] == "Regular" for x in r.json())

        # ?type=Member
        r = client.get(f"{API}/customers", params={"type": "Member"})
        assert r.status_code == 200
        assert all(x["type"] == "Member" for x in r.json())

        # Combined
        r = client.get(f"{API}/customers", params={"type": "Member", "source": "B2B Kosan"})
        assert r.status_code == 200
        data = r.json()
        assert all(x["type"] == "Member" and x["source_category"] == "B2B Kosan" for x in data)


# ---------------------------------------------------------------- PATCH
class TestCustomerPatch:
    def test_partial_update_address_only(self, client, created_ids):
        c = client.post(f"{API}/customers", json={
            "name": _uniq("TEST_PATCH_"), "phone": _phone(),
            "type": "Regular", "source_category": "Lainnya",
            "address": "Old Addr",
        }).json()
        created_ids["customers"].append(c["id"])

        r = client.patch(f"{API}/customers/{c['id']}", json={"address": "Jl. Baru"})
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["address"] == "Jl. Baru"
        assert updated["name"] == c["name"]
        assert updated["phone"] == c["phone"]

        # Verify persistence
        g = client.get(f"{API}/customers/{c['id']}").json()
        assert g["address"] == "Jl. Baru"

    def test_patch_phone_conflict_409(self, client, created_ids):
        p1 = _phone()
        p2 = _phone()
        a = client.post(f"{API}/customers", json={
            "name": _uniq("TEST_A_"), "phone": p1, "type": "Regular",
        }).json()
        b = client.post(f"{API}/customers", json={
            "name": _uniq("TEST_B_"), "phone": p2, "type": "Regular",
        }).json()
        created_ids["customers"] += [a["id"], b["id"]]

        r = client.patch(f"{API}/customers/{b['id']}", json={"phone": p1})
        assert r.status_code == 409, r.text


# ---------------------------------------------------------------- CSV export/import
class TestCustomerCSV:
    def test_export_header_and_content(self, client):
        r = client.get(f"{API}/customers/export.csv")
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "text/csv" in ct, ct
        first_line = r.text.splitlines()[0]
        expected = "id,name,phone,address,type,member_tier,source_category,remaining_quota_kg,quota_expiry_date,notes"
        assert first_line == expected

    def test_import_creates_and_updates(self, client, created_ids):
        new_phone = _phone()
        # First create an existing customer we intend to UPDATE via import
        existing = client.post(f"{API}/customers", json={
            "name": _uniq("TEST_IMPEXIST_"), "phone": _phone(),
            "type": "Regular", "source_category": "Lainnya",
        }).json()
        created_ids["customers"].append(existing["id"])

        csv_body = (
            "id,name,phone,address,type,member_tier,source_category,remaining_quota_kg,quota_expiry_date,notes\n"
            f",TEST_IMPNEW,{new_phone},Jl A,Regular,,Taman Melati,,,\n"
            f",{existing['name']}_UPD,{existing['phone']},Jl B,Regular,,Walk-in Laskita,,,\n"
        )
        r = requests.post(
            f"{API}/customers/import",
            data=csv_body.encode("utf-8"),
            headers={"Content-Type": "text/csv"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["created"] >= 1
        assert body["updated"] >= 1
        assert isinstance(body["errors"], list)

        # Verify new row
        found = client.get(f"{API}/customers", params={"q": new_phone}).json()
        assert any(c["phone"] == new_phone for c in found)


# ---------------------------------------------------------------- Prospects
class TestProspects:
    def test_create_default_status_and_dup_conflict(self, client, created_ids):
        p = _phone()
        r = client.post(f"{API}/prospects", json={
            "name": _uniq("TEST_PROS_"), "phone": p, "notes": "hi",
        })
        assert r.status_code == 201, r.text
        obj = r.json()
        assert obj["status"] == "Belum Ditawari"
        created_ids["prospects"].append(obj["id"])

        # Duplicate
        r2 = client.post(f"{API}/prospects", json={
            "name": _uniq("TEST_DUP_"), "phone": p,
        })
        assert r2.status_code == 409

    def test_list_filter_by_status(self, client, created_ids):
        # Create + flip one to Sudah Ditawari
        r = client.post(f"{API}/prospects", json={
            "name": _uniq("TEST_FLIP_"), "phone": _phone(),
        }).json()
        created_ids["prospects"].append(r["id"])
        upd = client.patch(f"{API}/prospects/{r['id']}", json={"status": "Sudah Ditawari"})
        assert upd.status_code == 200
        assert upd.json()["status"] == "Sudah Ditawari"
        assert upd.json().get("followed_up_at") is not None

        rows = client.get(f"{API}/prospects", params={"status": "Sudah Ditawari"}).json()
        assert all(x["status"] == "Sudah Ditawari" for x in rows)
        assert r["id"] in [x["id"] for x in rows]

    def test_convert_prospect_to_customer(self, client, created_ids):
        phone = _phone()
        p = client.post(f"{API}/prospects", json={
            "name": _uniq("TEST_CONV_"), "phone": phone,
        }).json()
        created_ids["prospects"].append(p["id"])

        r = client.post(f"{API}/prospects/{p['id']}/convert", json={
            "name": p["name"], "phone": phone,
            "address": "Jl. Convert", "type": "Regular",
            "source_category": "Antar Jemput",
        })
        assert r.status_code == 200, r.text
        cust = r.json()
        assert cust["phone"] == phone
        assert cust["source_category"] == "Antar Jemput"
        created_ids["customers"].append(cust["id"])

        # Prospect now Konversi + linked
        after = [x for x in client.get(f"{API}/prospects").json() if x["id"] == p["id"]]
        assert after and after[0]["status"] == "Konversi"
        assert after[0]["converted_customer_id"] == cust["id"]

    def test_delete_prospect(self, client, created_ids):
        p = client.post(f"{API}/prospects", json={
            "name": _uniq("TEST_DEL_"), "phone": _phone(),
        }).json()
        r = client.delete(f"{API}/prospects/{p['id']}")
        assert r.status_code == 204
        # 404 on further delete
        r2 = client.delete(f"{API}/prospects/{p['id']}")
        assert r2.status_code == 404

    def test_prospects_csv_export_import(self, client, created_ids):
        # Export header check
        r = client.get(f"{API}/prospects/export.csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        first = r.text.splitlines()[0]
        assert first == "id,name,phone,status,source_category,notes"

        # Import
        p = _phone()
        body = (
            "id,name,phone,status,source_category,notes\n"
            f",TEST_PROSIMP,{p},Belum Ditawari,Taman Melati,imported\n"
        )
        r2 = requests.post(f"{API}/prospects/import", data=body.encode("utf-8"),
                           headers={"Content-Type": "text/csv"})
        assert r2.status_code == 200, r2.text
        assert r2.json()["created"] >= 1


# ---------------------------------------------------------------- Cleanup
def test_zzz_cleanup(client, created_ids):
    for cid in created_ids["prospects"]:
        try:
            client.delete(f"{API}/prospects/{cid}")
        except Exception:
            pass
    # Customers have no DELETE endpoint — leave them (TEST_ prefix)
