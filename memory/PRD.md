# LaundryMax Cashier POS — PRD

## Original Problem Statement
Modern, mobile-first Point of Sale (POS) / Input Order screen for a laundry app named "LaundryMax", built with React + Tailwind. Strict "Wolverine" theme: Bright Yellow (#FFD700) accents + Deep Black (#111111/#1A1A1A) backgrounds, glassmorphism cards, micro-animations. Features: header, customer dropdown (Walk-in vs Member Kostunpad −10%), 4 tabs (Kiloan Rp6.000/kg, Satuan Rp15.000, Sepatu&Karpet Rp30.000, Showcase Rp20.000), massive photo-evidence button, sticky bottom action bar with dynamic total + "SIMPAN & CETAK QR CODE".

## Architecture
- **Frontend only**: React 19, Tailwind, shadcn UI (Tabs, Select, Dialog), Sonner toasts, lucide-react icons, qrcode.react for QR generation.
- Single-component app (`POSScreen.jsx`) rendered by `App.js`. No backend / DB.
- Fonts: Outfit (headings) + Poppins (body), loaded via Google Fonts.

## User Personas
- **Kasir laundry** on mobile tablet/phone — needs fast tap-friendly input + photo evidence + QR receipt.

## Core Requirements (Static)
- Wolverine palette only (yellow/black/white).
- All interactive elements have kebab-case `data-testid`.
- Mobile-first (`max-w-md mx-auto`) with sticky bottom bar that never overlaps scroll content (`pb-40`).

## What's Been Implemented (2026-02)
- Header with app brand + avatar.
- Customer-type shadcn Select with live 10% member-discount badge.
- 4-tab order input (Kiloan/Satuan/Sepatu&Karpet/Showcase) with big ±0.5kg and ±1 pcs counters.
- Dynamic subtotal/discount/total computed via `useMemo`.
- Photo-evidence button with MOCKED R2 upload modal (900ms spinner → success state).
- QR-code modal (qrcode.react) with generated order ID `LM-YYMMDDHHMMSS-###`, print toast, and "Order Baru" full-state reset.
- Glassmorphism, grain overlay, pulse-yellow CTA animation, active:scale micro-interactions.
- Testing agent iteration_1: 100% frontend pass.

## MOCKED / Not Real
- Camera / Cloudflare R2 upload (setTimeout simulation only).
- Receipt printing (toast success only).
- Order ID issuance (client-side, not server-authoritative).

## Backlog
- **P1**: Add FastAPI + MongoDB backend to persist orders; wire save button to POST /api/orders.
- **P1**: Real camera (`getUserMedia`) + actual R2 / object-storage upload.
- **P2**: Customer database (autocomplete by phone/name instead of 2-option dropdown).
- **P2**: Order history / daily sales report screen.
- **P2**: ESC/POS receipt printer bridge + thermal-print layout.
- **P3**: Auth + multi-outlet support.
