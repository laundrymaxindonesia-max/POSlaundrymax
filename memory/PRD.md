# LaundryMax — PRD

## Original Problem Statement
Mobile-first three-role ops app + Admin Command Center for a laundry business "LaundryMax". Strict Wolverine theme (#FFD700 + #111111), glassmorphism, micro-animations. React + Tailwind + shadcn UI.

## Architecture
- **Frontend**: React 19 + react-router-dom, Tailwind, shadcn UI (Tabs/Select/Dialog), Sonner toasts, lucide-react, qrcode.react, recharts.
- **Backend** (boot: iter_13, STEP 2 iter_14): FastAPI 0.110 + Motor 3.3 (async MongoDB) + Pydantic v2. Package layout:
  - `/app/backend/server.py` — app entry, CORS, legacy StatusCheck routes, `/api/health` (Mongo ping), mounts `orders_router` + `seed_router` under `/api`.
  - `/app/backend/db.py` — single Motor client + 6 collection handles + `ping()/close()`.
  - `/app/backend/models/` — one file per domain model (Order/Customer/Price/B2BQuota/Staff/Attendance). Order model now includes `order_events: List[OrderEvent]` audit log.
  - `/app/backend/routes/` — `orders.py` (POST/GET/GET-by-id/PATCH status), `seed.py` (POST /api/seed/orders → deterministic 35-order seed across all statuses & payment types).
  - `/app/backend/utils/__init__.py` — `serialize_for_mongo` / `deserialize_from_mongo` (datetime ↔ ISO str).
- Routes: `/` Cashier · `/production` Production · `/courier` Courier · `/dashboard` Pipeline · `/absen` HR Kiosk · `/admin` Admin.
- Shared `HeaderNav` 6-pill group on every screen with active-route highlight; labels hide below `lg` breakpoint.
- Typography: Outfit (headings) + Poppins (body).

## User Personas
- **Kasir** — input order cucian di konter (Walk-in / Member Kostunpad −10%).
- **Pekerja produksi** — scan QR per stasiun Wash/Dry/Iron/Pack untuk update status.
- **Kurir** — jemput bag pickup ke gudang + antar order selesai dengan bukti foto.
- **Superadmin** — monitor KPI, atur multi-tier pricing, lihat laporan pegawai, monitor kuota B2B.

## What's Been Implemented
### Segment 1 — Cashier POS (/) — iter_1, iter_5, iter_6, iter_7, iter_9, iter_10 100%
4-tab order input + full UX overhaul + membership + regular customer save. **REFACTORED (iter_10)** from ~1921 → 1280 lines:
- Extracted to `/components/pos/`: `data.js` (all constants), `MembershipModal.jsx`, `RegularCustomerModal.jsx`, `TrackingModal.jsx` (+ TrackingProgress), `QrReceiptModal.jsx`. Parent passes state + setters + callbacks as props.
- Photo & payment-proof modals remain inline (tightly coupled, small).
- All data-testids preserved; no regressions across 11 flows.

### Segment 3 — Courier Dashboard (/courier) — iter_3, iter_8, iter_10 100%
2 tabs JEMPUT + ANTAREUN with 2-section loading flow. **iter_10 addition**: each motor card now has a 2-col grid of `chat-wa-button-{id}` (green, opens `wa.me/{phone}?text=Halo [Nama], kurir LaundryMax sedang OTW ke [Alamat]. Mohon disiapkan tanda terimanya ya!`) + `pod-button-{id}` (yellow).

### Segment 4 — Admin Command Center (/admin) — iter_4, iter_10 100%
Sidebar console (Overview/Pricing/Staff/B2B). **iter_10 addition**: `PiutangWidget` below Staff Performance card on Overview — 5 mock unpaid orders (Total Rp 241.000) with per-row green `wa-tagihan-{id}` button opening `wa.me` deep link with encoded billing reminder template.

### Segment 5 — Pipeline Dashboard (/dashboard) — iter_11 100%
Wide analytical view for global operations monitoring.
- Date-range dropdown top-right: Hari Ini / Minggu Ini / Bulan Ini with distinct mock datasets (100/420/1580 orders).
- 4 summary KPIs: Total Order · Total Kilogram · In-Progress · Completion Rate.
- Pipeline funnel grid of 7 stage cards (Antrian Cuci → Sudah Dicuci → Sudah Dikeringkan → Sudah Disetrika → Sudah Dipacking → Sedang Diantar → Selesai) — each with icon, count, kg, % of total, color-coded progress bar.
- Recharts AreaChart throughput: 7 hourly buckets (Today), 7 daily (Week), 30 date buckets (Month).
- Added `nav-dashboard` pill (5th) to shared HeaderNav.

### Segment 6 — HR Attendance Kiosk (/absen) — iter_12 100%
Staff clock-in/clock-out kiosk with selfie + geotag + shift-report WA push.
- Added `nav-absen` pill (6th) to shared HeaderNav (Fingerprint icon).
- Live tabular digital clock (ticks every 1s, id-ID locale) + date banner.
- Step 1 — Staff picker: 6 mock staff grid (Erfa/Dedi/Rina/Budi/Siti/Agus) with role badges; selected card turns full-yellow with black initial avatar.
- Step 2 — 4-digit PIN field with auto-focus forward, backspace clears-and-moves back, password-masked input (1234 demo hint).
- Dual massive CTA: `ABSEN MASUK` (emerald gradient) + `ABSEN PULANG` (red gradient), both disabled until staff + 4-digit PIN complete.
- **Clock-In Modal**: mock front-facing viewfinder (silhouette placeholder, blinking corner frames, Live Camera badge, scan line during upload) + bottom info strip `📍 Lokasi: -6.929, 107.774 · ±5m akurat` + live clock + `AMBIL FOTO & CATAT WAKTU` button → 1s mock upload → TERVERIFIKASI overlay → auto-close → success toast → kiosk auto-resets.
- **Clock-Out Modal**: "Rekap Kinerja Shift" with dual-chip Jam Masuk 07:14 / Jam Pulang 16:15, 6-stat grid (Cuci 35kg/9p, Kering 45kg/10p, Setrika 80kg/28p, Packing 77kg/25p, Pickup 15kg/5p, Delivery 10kg/2p), WA preview card with exact dynamic message, giant green `KIRIM LAPORAN KE WA OWNER` button → `window.open('https://wa.me/628123456789?text=<exact URL-encoded shift template>')` → LAPORAN TERKIRIM → auto-close → kiosk auto-resets.

### Segment 2 — Production Scanner (/production) — iter_2 100%
2×2 chunky station grid (WASH/DRY/IRON/PACK), animated scanner modal (1.5s mock), Recent Scans list with colored badges.

### Segment 3 — Courier Dashboard (/courier) — iter_3, iter_8 100%
2 tabs: JEMPUT (scan→manifest, ANGKUT SEMUA CTA) + ANTAREUN (2-section flow). Shared HeaderNav.

**ANTAREUN delivery flow overhauled (iter_8)** — simulates realistic trip loading:
- **Section "Menunggu di Outlet"**: 4 seeded ready orders with mini payment-status badge (Lunas/Nanti) and total price per row.
- Massive **"SCAN BARANG MASUK MOTOR"** button (reuses scanner modal with `scanMode` state, 1.5s animation, StrictMode-safe via `queueMicrotask` + idempotent guard) moves 1st ready order → onMotor list with toast.
- **Section "Di Atas Motor · Sedang Diantar"**: full delivery cards with customer, address, phone, ETA, items, payment badge, "Wajib tagih" hint for Bayar-Nanti.
- **"BARANG DITERIMA (AMBIL BUKTI)"** → PoD modal with 2-step capture: Step 1 delivery photo always required; Step 2 payment proof only for paymentStatus='nanti' (sequential, payment button disabled until delivery captured). Selesai button gated by `podReady = podCaptured && (!podPaymentRequired || podPaymentCaptured)`.
- On confirm → order removed from onMotor list + success toast.

### Segment 4 — Admin Command Center (/admin) — iter_4 100%
Desktop sidebar layout (mobile drawer via burger menu) with mock auth badge "Superadmin: theomahrizal@gmail.com".
- **Overview**: 4 KPI cards (Pendapatan/Kg/Showcase/Menunggu) + Staff Performance bar chart (recharts) for 5 staff.
- **Pengaturan Harga**: 6-row × 3-tier (Tamel/Laskita/Kostunpad) editable pricing table + giant SIMPAN button (toast on save).
- **Laporan Pegawai**: 5-row staff report table (Name/Role/KG/Order/Hours).
- **Kuota B2B**: 4 partner cards with progress bars + status badges (Hampir Habis at 95%).
- HeaderNav extended to 4 pills (Cashier/Produksi/Kurir/Admin).

## MOCKED / Not Real
- Camera / R2 upload (setTimeout simulation).
- QR scanners (setTimeout 1.5s + random LND-### ID).
- Receipt printing + ESC/POS (toast only).
- Auth (static badge — no session, no Google OAuth).
- All KPIs, pricing tables, staff reports, B2B quotas, manifests, deliveries, orders are hardcoded client-side React state.
- Pricing save & price-row delete/add buttons are non-functional (UI only).

## Backlog
### Backend roadmap — 🎉 COMPLETE
- ✅ **STEP 1** (iter_13) — FastAPI boilerplate + 6 Pydantic models + Mongo connection + /api/health.
- ✅ **STEP 2** (iter_14) — Orders CRUD + event audit log + Pipeline Dashboard wired.
- ✅ **STEP 3** (iter_15) — Prices, Customers, B2B Quotas CRUD + Admin Pricing UI wired.
- ✅ **STEP 4** (iter_16→iter_17) — Staff + Attendance CRUD with multipart selfie uploads; HR Kiosk wired.
- ✅ **STEP 5** (iter_18→iter_19) — Auth & Role-Gated Routes (Emergent Google OAuth + Staff PIN).
- ✅ **STEP 6** (iter_20) — Final wiring of POS, Production Scanner & Courier.
  - `POST /api/orders/{order_id}/pod` — multipart Proof-of-Delivery photos, saved to `/api/uploads/pod/`, appended to `order.pod_urls[]`, audit event logged.
  - Order model gains `pod_urls: List[str]`.
  - POS `handleSave` fire-and-forget: `POST /api/orders` + `PATCH /api/customers/{id}/deduct` for members + `POST /api/customers` for new regulars. Optimistic cache via `lib/orderStore.js` kept for offline-resilience.
  - Live prices fetched from `GET /api/prices`; customer directory pulled from `GET /api/customers` on mount.
  - Production Scanner stations map Antrian→Cuci→Kering→Setrika→Packing; each tap fetches the oldest eligible order then `PATCH status` with actor=current-PIN-staff.
  - Courier reads `status=Packing` (Menunggu di Outlet) + `status=OTW` (Di Atas Motor). "SCAN BARANG MASUK MOTOR" → PATCH Packing→OTW. "BARANG DITERIMA" → uploads 2 PoD photos → PATCH OTW→Selesai.
  - `POST /api/auth/staff-pin` breaking change: now requires `{staff_id, pin_code}` and returns `StaffPinResponse` with identity so operational pages can tag orders with the correct actor.
  - Staff PIN Gate: 2-step picker (staff tile → PIN) with identity stored in sessionStorage via `lib/staffSession.js`.
  - Backend 73/73 GREEN; Frontend 4/5 critical flows GREEN (POS UI save-through blocked only by pre-existing payment-proof UX gate; backend create-order path proven by 5 direct API tests).

### Frontend backlog
- **P0** Real auth (Google OAuth via Emergent or JWT) with role-gated routes (cashier/worker/courier/admin).
- **P1** FastAPI + MongoDB: `/api/orders`, `/api/orders/:id/status`, `/api/manifest`, `/api/deliveries`, `/api/prices`, `/api/staff/reports`, `/api/b2b/quotas`. Persist all state.
- **P1** Real camera (`getUserMedia`) + Cloudflare R2 storage for evidence/PoD photos.
- **P1** Real QR scanning via `html5-qrcode`; cashier QR carries real order ID for production/courier decoders.
- **P1** Wire pricing changes from Admin → Cashier so kasir sees latest tier prices live.
- **P2** Customer DB with phone/name autocomplete replacing 2-option dropdown.
- **P2** SLA timer per order (red badge if stuck >30 min at a station).
- **P2** Daily sales dashboard (revenue per tab Kiloan/Satuan/Sepatu/Showcase).
- **P2** Map view with driver location & customer pin on delivery cards.
- **P2** Thermal printer bridge (ESC/POS) for real receipts.
- **P2** Add/Delete pricing rows in Admin (currently non-functional).
- **P3** WhatsApp/SMS notification when status = READY / kurir on the way.
- **P3** Split AdminDashboard.jsx into /components/admin/ subfolder (770 lines).
