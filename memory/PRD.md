# LaundryMax — PRD

## Original Problem Statement
Mobile-first POS/Input Order screen + Production Scanner Dashboard for a laundry app "LaundryMax". Strict "Wolverine" theme: Bright Yellow (#FFD700) + Deep Black (#111111/#1A1A1A). Built with React + Tailwind + shadcn UI.

## Architecture
- **Frontend only**. React 19 + react-router-dom, Tailwind, shadcn UI (Tabs/Select/Dialog), Sonner toasts, lucide-react, qrcode.react.
- Routes: `/` → Cashier POS · `/production` → Production Scanner.
- Typography: Outfit (headings) + Poppins (body) from Google Fonts.

## User Personas
- **Kasir** (cashier) — input order cucian di konter.
- **Pekerja produksi** — scan QR untuk update status (Wash → Dry → Iron → Pack).

## Core Requirements (Static)
- Wolverine palette; glassmorphism cards; kebab-case `data-testid` on every interactive element.
- Mobile-first (`max-w-md mx-auto`), sticky elements must never overlap scroll content.

## What's Been Implemented
### 2026-02 · Segment 1 — Cashier POS (/)
- Header (brand + Production quick-jump + avatar).
- Customer dropdown with 10% Member Kostunpad discount badge.
- 4-tab order input: Kiloan ±0.5kg @Rp6.000/kg, Satuan @Rp15.000, Sepatu&Karpet @Rp30.000, Showcase @Rp20.000.
- Massive "AMBIL FOTO CUCIAAN" evidence button (MOCKED R2 upload 900 ms).
- Sticky bottom total bar + "SIMPAN & CETAK QR CODE" → QR modal (qrcode.react) with generated `LM-YYMMDDHHMMSS-###` order ID, print toast, and Order Baru reset.
- Testing iteration_1 = 100% pass (14 flows).

### 2026-02 · Segment 2 — Production Scanner (/production)
- Header with back button, brand badge, live active-orders counter.
- 2×2 chunky tactile station grid (WASH blue, DRY orange, IRON yellow, PACK green) with distinct icon colors, ambient glow, corner-blink indicator, active:scale tap anim.
- Scanner modal: dark viewport with animated scanning line (CSS `animate-scan-line`), QR corner brackets, LIVE indicator, camera noise overlay. Auto-confirm in 1.5s → sonner success toast "Order LND-XXX Status Updated!" and prepended row in Recent Scans. Cancel button aborts timer cleanly.
- Recent Scans list: 5 seeded mock orders with colored status badges.
- Accessibility: added `DialogDescription` to all 3 dialogs.
- Testing iteration_2 = 100% pass (9 flows).

## MOCKED / Not Real
- Camera / R2 upload (setTimeout simulation).
- QR scanner (setTimeout 1.5s with random order ID).
- Receipt printing (toast only).
- Orders in Production list are client-side state only.

## Backlog
- **P1** FastAPI + MongoDB: `/api/orders` (create, list, update-status by order_id from QR), replace all client-side mocks.
- **P1** Real camera: `getUserMedia` + object-storage (R2) for evidence photos; `jsQR` / `html5-qrcode` for real scanning.
- **P2** Customer DB with autocomplete (phone/name) replacing 2-option dropdown.
- **P2** Daily sales dashboard (revenue per tab Kiloan/Satuan/Sepatu/Showcase).
- **P2** Auth (cashier vs worker roles) + multi-outlet support.
- **P2** Thermal printer (ESC/POS) for actual receipts.
- **P3** Push notification to customer when status = READY.
