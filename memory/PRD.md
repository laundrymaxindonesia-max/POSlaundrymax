# LaundryMax — PRD

## Original Problem Statement
Mobile-first three-role ops app for a laundry business "LaundryMax": Cashier POS, Production Scanner, and Courier Dashboard. Strict Wolverine theme (#FFD700 + #111111), glassmorphism, micro-animations. React + Tailwind + shadcn UI.

## Architecture
- **Frontend only**. React 19, react-router-dom, Tailwind, shadcn UI (Tabs/Select/Dialog), Sonner toasts, lucide-react, qrcode.react.
- Routes: `/` Cashier · `/production` Production · `/courier` Courier.
- Shared `HeaderNav` pill group (Cashier/Produksi/Kurir) on every screen with active-route highlight.
- Typography: Outfit (headings) + Poppins (body) from Google Fonts.

## User Personas
- **Kasir** — input order cucian di konter (Walk-in / Member Kostunpad −10%).
- **Pekerja produksi** — scan QR per stasiun Wash/Dry/Iron/Pack untuk update status.
- **Kurir** — jemput bag pickup ke gudang + antar order selesai ke pelanggan dengan bukti foto.

## Core Requirements (Static)
- Wolverine palette only; glassmorphism cards; `data-testid` kebab-case on every interactive element.
- Mobile-first `max-w-md mx-auto`; sticky bars must not overlap scroll content.
- Cross-view nav via shared HeaderNav on all routes.

## What's Been Implemented
### 2026-02 · Segment 1 — Cashier POS (/)
- Header (brand + shared HeaderNav).
- Customer dropdown (Walk-in vs Member Kostunpad with live 10% discount badge).
- 4-tab order input: Kiloan ±0.5kg @Rp6.000/kg, Satuan @Rp15.000, Sepatu&Karpet @Rp30.000, Showcase @Rp20.000.
- "AMBIL FOTO CUCIAAN" evidence button (MOCK R2 upload 900 ms).
- Sticky bottom total + "SIMPAN & CETAK QR CODE" → QR modal (qrcode.react) + Order Baru reset.
- Iteration_1 = 100%.

### 2026-02 · Segment 2 — Production Scanner (/production)
- Header (brand with live active-orders count + HeaderNav).
- 2×2 tactile station grid (WASH blue, DRY orange, IRON yellow, PACK green) with ambient glow, corner-blink LEDs, and active:scale taps.
- Scanner modal: animated scan line, QR corner brackets, LIVE indicator; auto-confirms in 1.5s → sonner toast "Order LND-XXX Status Updated!" and prepends to Recent Scans.
- Recent Scans list (5 seeded) with colored status badges.
- Iteration_2 = 100%.

### 2026-02 · Segment 3 — Courier Dashboard (/courier)
- Shared HeaderNav added to all 3 routes (nav-cashier / nav-production / nav-courier pills).
- 2 big tabs: JEMPUT (Pickup) + ANTAREUN (Delivery).
- **Pickup**: massive "SCAN BARANG PICKUP" button with pulse animation → scanner modal (1.5s mock) prepends bag to "Manifest Angkutan" list · 3 seeded Tamel bags · sticky bottom "ANGKUT SEMUA (N BAGS)" CTA clears manifest with toast.
- **Delivery**: 3 seeded "Siap Antar" order cards with customer, address, phone, ETA · "BUKTI TERIMA (SELESAI)" button opens PoD photo modal (900 ms spinner → "Foto tersimpan" → Selesai button triggers "Order Selesai Diantar!" toast and removes row from list).
- Iteration_3 = 100%.

## MOCKED / Not Real
- Camera / R2 upload (setTimeout simulation).
- QR scanner (setTimeout 1.5s + random LND-### ID).
- Receipt printing + ESC/POS (toast only).
- All orders/manifest/deliveries/scans stored in client-side React state only.

## Backlog
- **P1** FastAPI + MongoDB backend: `/api/orders` (CRUD), `/api/orders/:id/status`, `/api/manifest`, `/api/deliveries` — persist all client state.
- **P1** Real camera + object-storage: `getUserMedia` for photo evidence/PoD, `html5-qrcode` for QR scanning, Cloudflare R2 (or S3) for image storage.
- **P1** Wire Cashier QR codes to carry real order ID → decoded by Production/Courier scanners.
- **P2** Customer DB with phone/name autocomplete replacing the 2-option dropdown.
- **P2** SLA timer per order (red badge if stuck at a station >30 min).
- **P2** Daily sales dashboard (revenue per tab Kiloan/Satuan/Sepatu/Showcase).
- **P2** Thermal printer bridge (ESC/POS) for real receipts.
- **P2** Auth & roles (cashier vs worker vs courier) with role-based route guards.
- **P3** Push/WhatsApp notification to customer when status = READY / when courier is en route.
