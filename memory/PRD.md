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
### Segment 1 — Cashier POS (/) — iter_1, iter_5, iter_6, iter_7 100%
4-tab order input (Kiloan/Satuan/Sepatu&Karpet/Showcase). **MAJOR UX OVERHAUL (iter_5)** + **Membership Integration (iter_6/7)**:
- Top **search bar** with autocomplete → tracking modal with horizontal stepper (Antrian→Cuci→Kering→Setrika→Packing→OTW).
- **Nama Pelanggan** text input + **Sumber Order** select (Walk-in/Outlet Tamel/Anter Jemput/Kosan Kerjasama); Kosan = 10% discount.
- Kiloan **manually typable** number input + ±0.5 kg buttons; min kg per source (Walk-in 2.0 / Anter Jemput 3.0).
- **Hitung Detail Item** collapsible inside Kiloan (does not affect price).
- **Multi-photo evidence** with thumbnail grid + remove buttons.
- **Payment toggle** Lunas / Bayar Nanti; Lunas → mandatory UPLOAD BUKTI BAYAR.
- **Membership system**: 3 seeded members (Budi/Siti/Andi); typing recognized name → Active Member badge (tier · sisa kuota · expiry); auto-deduct in Kiloan tab → total Rp 0 + helper "Akan memotong sisa kuota membership"; receipt shows "SISA KUOTA ANDA: X KG (Hangus pada [date])" snapshot post-deduction.
- **Member Registration Modal** via "DAFTAR MEMBER BARU" button: Nama / WA / Sumber (Tamel: 15/21/30 kg; Umum: 20/25/35 kg) × 3 tiers (Silver Rp120k / Gold Rp150k / Platinum Rp200k with Free Cuci Sepatu+Bedcover benefits).
- Save validation: name → items → payment proof (only if total>0 + Lunas + non-member).

### Segment 2 — Production Scanner (/production) — iter_2 100%
2×2 chunky station grid (WASH/DRY/IRON/PACK), animated scanner modal (1.5s mock), Recent Scans list with colored badges.

### Segment 3 — Courier Dashboard (/courier) — iter_3 100%
2 tabs: JEMPUT (scan→manifest, ANGKUT SEMUA CTA) + ANTAREUN (delivery cards with PoD photo modal). Shared HeaderNav added.

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
