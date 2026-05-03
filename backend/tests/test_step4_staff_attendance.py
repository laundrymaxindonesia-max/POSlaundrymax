"""STEP 4 — Staff + Attendance CRUD, selfie upload, shift report tests."""
import io
import os
import struct
import zlib

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://laundrymax-cashier.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _make_png_bytes(w=4, h=4) -> bytes:
    """Produce a tiny but valid PNG."""
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    raw = b""
    for _ in range(h):
        raw += b"\x00" + b"\x00\x00\x00" * w
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


PNG = _make_png_bytes()


@pytest.fixture(scope="module")
def seeded_state():
    r = requests.post(f"{API}/seed/all", timeout=30)
    assert r.status_code == 200, f"seed/all failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def staff_list(seeded_state):
    r = requests.get(f"{API}/staff", timeout=15)
    assert r.status_code == 200
    return r.json()


def _reseed_and_fetch():
    """Reseed staff (wipes attendance) and return the fresh staff list."""
    requests.post(f"{API}/seed/staff", timeout=15)
    r = requests.get(f"{API}/staff", timeout=15)
    assert r.status_code == 200
    return r.json()


class TestSeed:
    def test_seed_all_includes_staff_inserted_6(self, seeded_state):
        assert "staff" in seeded_state
        assert seeded_state["staff"]["inserted"] == 6

    def test_seed_staff_alone_returns_inserted_6_and_wipes_attendance(self):
        r = requests.post(f"{API}/seed/staff", timeout=15)
        assert r.status_code == 200
        assert r.json() == {"inserted": 6}
        # attendance should be wiped
        r2 = requests.get(f"{API}/attendance", timeout=15)
        assert r2.status_code == 200
        assert r2.json() == []


class TestStaffList:
    def test_get_staff_returns_6_sorted_ascending_and_no_pin(self, staff_list):
        assert isinstance(staff_list, list)
        assert len(staff_list) == 6
        names = [s["name"] for s in staff_list]
        assert names == sorted(names)
        expected = {"Erfa", "Dedi", "Rina", "Budi", "Siti", "Agus"}
        assert set(names) == expected
        for s in staff_list:
            assert "pin_code" not in s
            assert "id" in s and "role" in s


class TestClockIn:
    def test_clock_in_happy_path(self, staff_list):
        # fresh re-seed (wipes attendance) so this test is idempotent across retries
        staff_list = _reseed_and_fetch()
        erfa = next(s for s in staff_list if s["name"] == "Erfa")
        files = {"selfie": ("selfie.png", io.BytesIO(PNG), "image/png")}
        data = {"staff_id": erfa["id"], "pin_code": "1234", "lat": "-6.929", "lng": "107.774"}
        r = requests.post(f"{API}/attendance/clock-in", files=files, data=data, timeout=30)
        assert r.status_code == 201, r.text
        j = r.json()
        assert j["clock_in_time"]
        assert j["clock_out_time"] is None
        # NEW PREFIX: StaticFiles is mounted under /api/uploads so the K8s
        # ingress (/api/*) routes the request to the backend.
        assert j["selfie_url"].startswith("/api/uploads/attendance/"), j["selfie_url"]
        assert j["geotag_lat"] == -6.929
        assert j["staff_name"] == "Erfa"

        # Reachability via the PUBLIC ingress URL — should now serve the PNG.
        public_url = f"{BASE_URL}{j['selfie_url']}"
        sr = requests.get(public_url, timeout=20)
        assert sr.status_code == 200, f"{sr.status_code} {sr.headers} {sr.text[:200]}"
        ctype = sr.headers.get("content-type", "")
        assert ctype.startswith("image/"), f"expected image/*, got {ctype}"
        # The first 8 bytes of any PNG must be the PNG signature.
        assert sr.content[:8] == b"\x89PNG\r\n\x1a\n", sr.content[:16]

    def test_clock_in_wrong_pin_returns_403(self, staff_list):
        staff_list = _reseed_and_fetch()
        dedi = next(s for s in staff_list if s["name"] == "Dedi")
        files = {"selfie": ("selfie.png", io.BytesIO(PNG), "image/png")}
        data = {"staff_id": dedi["id"], "pin_code": "9999", "lat": "-6.929", "lng": "107.774"}
        r = requests.post(f"{API}/attendance/clock-in", files=files, data=data, timeout=15)
        assert r.status_code == 403

    def test_clock_in_duplicate_returns_409(self, staff_list):
        # re-seed so only Erfa has an open attendance from test above is cleared
        staff_list = _reseed_and_fetch()
        erfa = next(s for s in staff_list if s["name"] == "Erfa")
        files1 = {"selfie": ("selfie.png", io.BytesIO(PNG), "image/png")}
        data = {"staff_id": erfa["id"], "pin_code": "1234", "lat": "-6.929", "lng": "107.774"}
        r1 = requests.post(f"{API}/attendance/clock-in", files=files1, data=data, timeout=15)
        assert r1.status_code == 201
        # second should 409
        files2 = {"selfie": ("selfie.png", io.BytesIO(PNG), "image/png")}
        r2 = requests.post(f"{API}/attendance/clock-in", files=files2, data=data, timeout=15)
        assert r2.status_code == 409

    def test_clock_in_non_image_content_type_returns_415(self, staff_list):
        staff_list = _reseed_and_fetch()
        rina = next(s for s in staff_list if s["name"] == "Rina")
        files = {"selfie": ("selfie.txt", io.BytesIO(b"hello"), "text/plain")}
        data = {"staff_id": rina["id"], "pin_code": "1234", "lat": "-6.929", "lng": "107.774"}
        r = requests.post(f"{API}/attendance/clock-in", files=files, data=data, timeout=15)
        assert r.status_code == 415

    def test_clock_in_missing_selfie_returns_422(self, staff_list):
        staff_list = _reseed_and_fetch()
        rina = next(s for s in staff_list if s["name"] == "Rina")
        data = {"staff_id": rina["id"], "pin_code": "1234", "lat": "-6.929", "lng": "107.774"}
        r = requests.post(f"{API}/attendance/clock-in", data=data, timeout=15)
        assert r.status_code == 422


class TestClockOut:
    def test_clock_out_wrong_pin_returns_403(self, staff_list):
        staff_list = _reseed_and_fetch()
        budi = next(s for s in staff_list if s["name"] == "Budi")
        r = requests.post(
            f"{API}/attendance/clock-out",
            json={"staff_id": budi["id"], "pin_code": "9999"},
            timeout=15,
        )
        assert r.status_code == 403

    def test_clock_out_without_open_attendance_returns_400(self, staff_list):
        # ensure no attendance open
        staff_list = _reseed_and_fetch()
        budi = next(s for s in staff_list if s["name"] == "Budi")
        r = requests.post(
            f"{API}/attendance/clock-out",
            json={"staff_id": budi["id"], "pin_code": "1234"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_clock_out_happy_path_populates_shift_report(self, staff_list):
        staff_list = _reseed_and_fetch()
        siti = next(s for s in staff_list if s["name"] == "Siti")
        # clock in first
        files = {"selfie": ("selfie.png", io.BytesIO(PNG), "image/png")}
        data = {"staff_id": siti["id"], "pin_code": "1234", "lat": "-6.929", "lng": "107.774"}
        r_in = requests.post(f"{API}/attendance/clock-in", files=files, data=data, timeout=15)
        assert r_in.status_code == 201

        r_out = requests.post(
            f"{API}/attendance/clock-out",
            json={"staff_id": siti["id"], "pin_code": "1234"},
            timeout=15,
        )
        assert r_out.status_code == 200, r_out.text
        j = r_out.json()
        assert j["clock_out_time"]
        sr = j["shift_report_data"]
        assert sr["cuci_kg"] == 35 and sr["cuci_pelanggan"] == 9
        assert sr["kering_kg"] == 45 and sr["kering_pelanggan"] == 10
        assert sr["setrika_kg"] == 80 and sr["setrika_pelanggan"] == 28
        assert sr["packing_kg"] == 77 and sr["packing_pelanggan"] == 25
        assert sr["pickup_kg"] == 15 and sr["pickup_pelanggan"] == 5
        assert sr["delivery_kg"] == 10 and sr["delivery_pelanggan"] == 2


class TestAttendanceList:
    def test_filter_by_staff_id_and_open_only(self, staff_list):
        staff_list = _reseed_and_fetch()
        agus = next(s for s in staff_list if s["name"] == "Agus")
        files = {"selfie": ("selfie.png", io.BytesIO(PNG), "image/png")}
        data = {"staff_id": agus["id"], "pin_code": "1234", "lat": "-6.929", "lng": "107.774"}
        r_in = requests.post(f"{API}/attendance/clock-in", files=files, data=data, timeout=15)
        assert r_in.status_code == 201

        r_list = requests.get(f"{API}/attendance", params={"staff_id": agus["id"]}, timeout=15)
        assert r_list.status_code == 200
        assert len(r_list.json()) == 1

        r_open = requests.get(
            f"{API}/attendance",
            params={"staff_id": agus["id"], "open_only": "true"},
            timeout=15,
        )
        assert r_open.status_code == 200
        rows = r_open.json()
        assert len(rows) == 1
        assert rows[0]["clock_out_time"] is None


class TestRegressions:
    def test_health_ok(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_orders_list(self):
        r = requests.get(f"{API}/orders", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_prices_list(self):
        r = requests.get(f"{API}/prices", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 6
