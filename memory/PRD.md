# LaundryMax — PRD

## Original Problem Statement
Mobile-first three-role ops app + Admin Command Center for a laundry business "LaundryMax". Strict Wolverine theme (#FFD700 + #111111), glassmorphism, micro-animations. React + Tailwind + shadcn UI.

## Architecture
- **Frontend only**. React 19 + react-router-dom, Tailwind, shadcn UI (Tabs/Select/Dialog), Sonner toasts, lucide-react, qrcode.react, recharts.
- Routes: `/` Cashier · `/production` Production · `/courier` Courier · `/admin` Admin.
- Shared `HeaderNav` 4-pill group on every screen with active-route highlight.
- Typography: Outfit (headings) + Poppins (body).

## User Personas
- **Kasir** — input order cucian di konter (Walk-in / Member Kostunpad −10%).
- **Pekerja produksi** — scan QR per stasiun Wash/Dry/Iron/Pack untuk update status.
- **Kurir** — jemput bag pickup ke gudang + antar order selesai dengan bukti foto.
- **Superadmin** — monitor KPI, atur multi-tier pricing, lihat laporan pegawai, monitor kuota B2B.

## What's Been Implemented
### Segment 1 — Cashier POS (/) — iter_1, iter_5, iter_6, iter_7, iter_9 100%
4-tab order input (Kiloan/Satuan/Sepatu&Karpet/Showcase). **MAJOR UX OVERHAUL (iter_5)** + **Membership Integration (iter_6/7)** + **Regular Customer Save (iter_9)**:
- Top **search bar** with autocomplete → tracking modal with horizontal stepper.
- **Nama Pelanggan** + **Sumber Order** select; Kosan = 10% discount.
- Kiloan **manually typable** + ±0.5 kg buttons; min kg per source (Walk-in 2.0 / Anter Jemput 3.0).
- **Hitung Detail Item** collapsible · **Multi-photo evidence** · **Payment toggle** Lunas/Bayar Nanti with mandatory bukti for Lunas.
- **Membership system**: 3 seeded members; auto-deduct kiloan total → Rp 0; receipt shows "SISA KUOTA ANDA: X KG (Hangus pada [date])".
- **Member Registration Modal** (DAFTAR MEMBER BARU): Nama / WA / Sumber × 3 tier cards.
- **Regular Customer Save Modal** (SIMPAN PELANGGAN REGULER, outline button): Nama / WA / Alamat all required → autofills cashier name + saves to in-memory regular registry. When sumberOrder='anter' the order is pushed via `lib/orderStore.js` (localStorage + custom event) into the Courier "Menunggu di Outlet" list with full address + phone.
- Save validation: name → items → payment proof (only if total>0 + Lunas + non-member).

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
