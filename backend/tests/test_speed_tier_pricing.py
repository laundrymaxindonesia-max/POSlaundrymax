"""Tests for the new Speed Tier (Durasi Pengerjaan) pricing schema.

Covers:
- POST /api/seed/all returns prices.inserted == 8
- POST /api/seed/prices returns inserted == 8
- GET /api/prices returns 8 rows including kiloan_reguler / kiloan_flash / kiloan_express
  and the new `umum` integer field on every row
- POST /api/prices/bulk round-trip preserves the new 4-tier schema
- POS-style order creation persists the speed-tier label inside items_detail
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://laundrymax-cashier.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

EXPECTED_KILOAN_UMUM = {
    "kiloan_reguler": 7000,
    "kiloan_flash": 10000,
    "kiloan_express": 18500,
}
EXPECTED_KILOAN_TAMEL = {
    "kiloan_reguler": 8000,
    "kiloan_flash": 12000,
    "kiloan_express": 20000,
}


@pytest.fixture(scope="module", autouse=True)
def seed_all():
    r = requests.post(f"{API}/seed/all", timeout=30)
    assert r.status_code == 200
    yield r.json()
    # Restore canonical data for next session
    requests.post(f"{API}/seed/all", timeout=30)


# ---------------- Seed contract ---------------------------------------------
class TestSeedContract:
    def test_seed_all_returns_8_prices(self, seed_all):
        assert seed_all["prices"]["inserted"] == 8

    def test_seed_prices_endpoint_inserts_8(self):
        r = requests.post(f"{API}/seed/prices", timeout=15)
        assert r.status_code == 200
        assert r.json() == {"inserted": 8}


# ---------------- GET /api/prices schema ------------------------------------
class TestPricesSchema:
    def test_get_prices_returns_8_rows(self):
        r = requests.get(f"{API}/prices", timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) == 8

    def test_every_row_has_umum_integer_field(self):
        rows = requests.get(f"{API}/prices", timeout=15).json()
        for row in rows:
            assert "umum" in row, f"Missing umum field in row {row.get('service_id')}"
            assert isinstance(row["umum"], int), f"umum must be int in {row.get('service_id')}"
            # 4-tier check
            for k in ("tamel", "laskita", "member"):
                assert k in row and isinstance(row[k], int)

    def test_kiloan_speed_tiers_present_with_correct_umum(self):
        rows = {p["service_id"]: p for p in requests.get(f"{API}/prices", timeout=15).json()}
        for sid, expected in EXPECTED_KILOAN_UMUM.items():
            assert sid in rows, f"Missing service_id {sid}"
            assert rows[sid]["umum"] == expected, f"{sid} umum should be {expected}, got {rows[sid]['umum']}"

    def test_kiloan_speed_tiers_tamel_member_laskita_match(self):
        rows = {p["service_id"]: p for p in requests.get(f"{API}/prices", timeout=15).json()}
        for sid, expected in EXPECTED_KILOAN_TAMEL.items():
            r = rows[sid]
            assert r["tamel"] == expected
            assert r["laskita"] == expected
            assert r["member"] == expected

    def test_required_service_ids_present(self):
        rows = {p["service_id"] for p in requests.get(f"{API}/prices", timeout=15).json()}
        expected = {"kiloan_reguler", "kiloan_flash", "kiloan_express",
                    "satuan", "sepatu", "jas", "karpet", "showcase"}
        assert rows == expected


# ---------------- Bulk round-trip -------------------------------------------
class TestBulkRoundTrip:
    def test_bulk_replace_preserves_4_tier_schema(self):
        custom = [
            {"service_id": "kiloan_reguler", "label": "Cuci Kiloan — Reguler (3 hari)", "unit": "/kg",  "umum": 7500,  "tamel": 8500,  "laskita": 8500,  "member": 8500},
            {"service_id": "kiloan_flash",   "label": "Cuci Kiloan — Flash (1 hari)",   "unit": "/kg",  "umum": 11000, "tamel": 12500, "laskita": 12500, "member": 12500},
            {"service_id": "kiloan_express", "label": "Cuci Kiloan — Express (5 jam)",  "unit": "/kg",  "umum": 19000, "tamel": 21000, "laskita": 21000, "member": 21000},
            {"service_id": "satuan",   "label": "Satuan", "unit": "/pcs", "umum": 16000, "tamel": 16000, "laskita": 19000, "member": 14500},
            {"service_id": "sepatu",   "label": "Sepatu", "unit": "/pcs", "umum": 31000, "tamel": 31000, "laskita": 36000, "member": 28000},
            {"service_id": "jas",      "label": "Jas",    "unit": "/pcs", "umum": 26000, "tamel": 26000, "laskita": 31000, "member": 23500},
            {"service_id": "karpet",   "label": "Karpet", "unit": "/m²",  "umum": 31000, "tamel": 31000, "laskita": 36000, "member": 28000},
            {"service_id": "showcase", "label": "Showcase", "unit": "/pcs", "umum": 21000, "tamel": 21000, "laskita": 23000, "member": 19000},
        ]
        r = requests.post(f"{API}/prices/bulk", json=custom, timeout=15)
        assert r.status_code == 200, r.text

        got = {p["service_id"]: p for p in requests.get(f"{API}/prices", timeout=15).json()}
        assert len(got) == 8
        for row in custom:
            g = got[row["service_id"]]
            for k in ("umum", "tamel", "laskita", "member", "label", "unit"):
                assert g[k] == row[k], f"Mismatch {row['service_id']}.{k}: got {g[k]} vs {row[k]}"

        # Re-seed so subsequent tests see canonical defaults
        requests.post(f"{API}/seed/prices", timeout=15)


# ---------------- items_detail with speed label ------------------------------
class TestOrderItemsDetailSpeedLabel:
    def test_create_order_with_speed_label_persists(self):
        import uuid as _uuid
        payload = {
            "order_id": f"TEST-SPEED-{_uuid.uuid4().hex[:6].upper()}",
            "customer_name": "TEST_SpeedTier User",
            "customer_phone": "6281999900001",
            "customer_address": "Jl. Test 1",
            "source": "Walk-in",
            "weight_kg": 3.0,
            "items_detail": "Cuci Kiloan - Flash (1 Hari) - 3.0kg",
            "total_price": 30000,
            "payment_status": "Lunas",
            "order_status": "Antrian",
        }
        r = requests.post(f"{API}/orders", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        order_id = created.get("order_id") or created.get("id")
        assert order_id

        g = requests.get(f"{API}/orders/{order_id}", timeout=15)
        assert g.status_code == 200, g.text
        fetched = g.json()
        assert "Flash" in (fetched.get("items_detail") or ""), fetched
        assert "1 Hari" in fetched["items_detail"]
