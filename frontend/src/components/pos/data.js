import {
  Store,
  Building2,
  Bike,
  Truck,
  Star,
  Sparkles,
  Crown,
} from "lucide-react";

export const KILOAN_PRICE = 6000;

export const SATUAN_ITEMS = [
  { id: "kemeja", name: "Kemeja", price: 15000 },
  { id: "celana", name: "Celana", price: 15000 },
  { id: "jas", name: "Jas", price: 15000 },
  { id: "kaos", name: "Kaos", price: 15000 },
  { id: "jaket", name: "Jaket", price: 15000 },
];

export const SEPATU_ITEMS = [
  { id: "sepatu", name: "Sepatu", price: 30000 },
  { id: "karpet", name: "Karpet", price: 30000 },
  { id: "tas", name: "Tas", price: 30000 },
];

export const SHOWCASE_ITEMS = [
  { id: "gas", name: "Gas Isi", price: 20000 },
  { id: "air", name: "Air Mineral", price: 20000 },
  { id: "detergen", name: "Detergen Kiloan", price: 20000 },
];

export const KILOAN_DETAIL_ITEMS = [
  { id: "kemeja", name: "Kemeja" },
  { id: "celana", name: "Celana" },
  { id: "kaos", name: "Kaos" },
  { id: "celana_dalam", name: "Celana Dalam" },
  { id: "kaos_kaki", name: "Kaos Kaki" },
];

export const SOURCE_OPTIONS = [
  {
    id: "walkin",
    label: "Walk-in",
    sub: "Langsung datang ke outlet",
    Icon: Store,
    minKg: 2.0,
  },
  {
    id: "tamel",
    label: "Outlet Tamel",
    sub: "Pickup dari Hotel Tamel",
    Icon: Building2,
    minKg: 0,
  },
  {
    id: "anter",
    label: "Anter Jemput",
    sub: "Dijemput kurir ke lokasi",
    Icon: Bike,
    minKg: 3.0,
  },
  {
    id: "kosan",
    label: "Kosan Kerjasama",
    sub: "B2B — diskon 10%",
    Icon: Truck,
    minKg: 0,
  },
];

export const MOCK_ORDERS = [
  { id: "LND-001", customer: "Budi Santoso", kg: 4.5, date: "28 Feb 2026", stage: 3 },
  { id: "LND-002", customer: "Siti Rahayu", kg: 2.0, date: "28 Feb 2026", stage: 2 },
  { id: "LND-003", customer: "Andi Wijaya", kg: 6.5, date: "28 Feb 2026", stage: 1 },
  { id: "LND-004", customer: "Ratna Dewi", kg: 3.0, date: "27 Feb 2026", stage: 4 },
  { id: "LND-005", customer: "Rudi Hartono", kg: 5.5, date: "27 Feb 2026", stage: 5 },
  { id: "LND-006", customer: "Dina Kurniawan", kg: 1.5, date: "27 Feb 2026", stage: 0 },
];

export const STAGES = [
  "Antrian",
  "Cuci",
  "Kering",
  "Setrika",
  "Packing",
  "OTW/Diambil",
];

// Membership packages — pricing depends on registration source
export const MEMBER_PACKAGES = {
  tamel: [
    {
      tier: "Silver",
      kg: 15,
      price: 120000,
      Icon: Star,
      accent: "#A0A0A0",
      benefits: ["Cuci kiloan 15 kg", "Setrika gratis", "Pickup outlet"],
    },
    {
      tier: "Gold",
      kg: 21,
      price: 150000,
      Icon: Sparkles,
      accent: "#FFD700",
      benefits: ["Cuci kiloan 21 kg", "Setrika gratis", "Free 1× cuci jas"],
    },
    {
      tier: "Platinum",
      kg: 30,
      price: 200000,
      Icon: Crown,
      accent: "#E0BBFF",
      benefits: [
        "Cuci kiloan 30 kg",
        "Free Cuci Sepatu",
        "Free Cuci Bedcover",
        "Priority pickup",
      ],
    },
  ],
  umum: [
    {
      tier: "Silver",
      kg: 20,
      price: 120000,
      Icon: Star,
      accent: "#A0A0A0",
      benefits: ["Cuci kiloan 20 kg", "Setrika gratis", "Antar gratis ≥5 kg"],
    },
    {
      tier: "Gold",
      kg: 25,
      price: 150000,
      Icon: Sparkles,
      accent: "#FFD700",
      benefits: ["Cuci kiloan 25 kg", "Setrika gratis", "Free 1× cuci jas"],
    },
    {
      tier: "Platinum",
      kg: 35,
      price: 200000,
      Icon: Crown,
      accent: "#E0BBFF",
      benefits: [
        "Cuci kiloan 35 kg",
        "Free Cuci Sepatu",
        "Free Cuci Bedcover",
        "Priority antar-jemput",
      ],
    },
  ],
};

export const MEMBER_SOURCE_OPTIONS = [
  { id: "tamel", label: "Outlet Tamel" },
  { id: "umum", label: "Umum / Lainnya" },
];

export const INITIAL_MEMBERS = [];

export const TIER_STYLE = {
  Silver: {
    bg: "bg-white/5",
    border: "border-white/20",
    text: "text-white/80",
    badge: "bg-white/10 text-white border-white/20",
  },
  Gold: {
    bg: "bg-[#FFD700]/10",
    border: "border-[#FFD700]/40",
    text: "text-[#FFD700]",
    badge: "bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/40",
  },
  Platinum: {
    bg: "bg-[#E0BBFF]/10",
    border: "border-[#E0BBFF]/40",
    text: "text-[#E0BBFF]",
    badge: "bg-[#E0BBFF]/15 text-[#E0BBFF] border-[#E0BBFF]/40",
  },
};

export const formatIDR = (n) =>
  "Rp " + Math.round(n).toLocaleString("id-ID").replace(/,/g, ".");

// Service speed tiers (Durasi Pengerjaan).
// `multiplier` is applied to Satuan & Sepatu base prices client-side.
// For Kiloan, the price is read directly from the backend (one row per tier).
export const SPEED_TIERS = [
  {
    id: "reguler",
    label: "Reguler",
    sub: "3 hari",
    multiplier: 1.0,
    accent: "#FFD700",
  },
  {
    id: "flash",
    label: "Flash",
    sub: "1 hari",
    multiplier: 1.5,
    accent: "#7DF08F",
  },
  {
    id: "express",
    label: "Express",
    sub: "5 jam",
    multiplier: 2.0,
    accent: "#FF6B6B",
  },
];

export const SPEED_TIER_LABEL = {
  reguler: "Reguler (3 Hari)",
  flash: "Flash (1 Hari)",
  express: "Express (5 Jam)",
};
