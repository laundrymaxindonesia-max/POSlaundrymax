import { useState, useMemo, useEffect } from "react";
import {
  Minus,
  Plus,
  Camera,
  QrCode,
  User,
  Shirt,
  Scale,
  Footprints,
  ShoppingBag,
  X,
  CheckCircle2,
  Search,
  Package,
  ChevronDown,
  ChevronUp,
  Wallet,
  Clock,
  Receipt,
  Calendar,
  Trash2,
  Sparkles,
  Crown,
  Star,
  MapPin,
  Phone,
  NotebookPen,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import HeaderNav from "@/components/HeaderNav";
import { pushPendingOrder } from "@/lib/orderStore";
import {
  createOrder,
  deductQuota,
  fetchPrices,
  searchCustomers,
  createCustomer,
} from "@/lib/api";
import { getActorTag, getCurrentStaff } from "@/lib/staffSession";
import {
  KILOAN_PRICE,
  SATUAN_ITEMS,
  SEPATU_ITEMS,
  SHOWCASE_ITEMS,
  KILOAN_DETAIL_ITEMS,
  SOURCE_OPTIONS,
  MOCK_ORDERS,
  STAGES,
  INITIAL_MEMBERS,
  TIER_STYLE,
  formatIDR,
} from "@/components/pos/data";
import MembershipModal from "@/components/pos/MembershipModal";
import RegularCustomerModal from "@/components/pos/RegularCustomerModal";
import TrackingModal from "@/components/pos/TrackingModal";
import QrReceiptModal from "@/components/pos/QrReceiptModal";


const CounterBtn = ({ onClick, children, testid, variant = "default", disabled = false }) => (
  <button
    onClick={onClick}
    data-testid={testid}
    disabled={disabled}
    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed ${
      variant === "primary"
        ? "bg-[#FFD700] text-black hover:bg-[#ffdf33] shadow-[0_0_20px_rgba(255,215,0,0.35)]"
        : "bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-[#FFD700]/40"
    }`}
  >
    {children}
  </button>
);

const ItemRow = ({ item, count, onInc, onDec, idx }) => (
  <div
    className="glass rounded-2xl p-4 flex items-center justify-between animate-fade-up"
    style={{ animationDelay: `${idx * 40}ms` }}
    data-testid={`item-row-${item.id}`}
  >
    <div className="flex-1 min-w-0">
      <div className="font-heading font-semibold text-white text-lg truncate">
        {item.name}
      </div>
      <div className="text-white/50 text-xs mt-0.5">
        {formatIDR(item.price)} / pcs
      </div>
    </div>
    <div className="flex items-center gap-3 ml-2">
      <CounterBtn onClick={onDec} testid={`item-counter-decrease-${item.id}`}>
        <Minus size={18} />
      </CounterBtn>
      <div
        className="min-w-[2rem] text-center font-heading font-bold text-2xl text-[#FFD700]"
        data-testid={`item-count-${item.id}`}
      >
        {count}
      </div>
      <CounterBtn
        onClick={onInc}
        testid={`item-counter-increase-${item.id}`}
        variant={count > 0 ? "primary" : "default"}
      >
        <Plus size={18} />
      </CounterBtn>
    </div>
  </div>
);

export default function POSScreen() {
  // Customer
  const [customerName, setCustomerName] = useState("");
  const [sumberOrder, setSumberOrder] = useState("walkin");

  // Tabs
  const [activeTab, setActiveTab] = useState("kiloan");

  // Kiloan
  const [kiloanKg, setKiloanKg] = useState(2.0);
  const [kiloanInput, setKiloanInput] = useState("2.0");
  const [showKiloanDetail, setShowKiloanDetail] = useState(false);
  const [kiloanDetail, setKiloanDetail] = useState({});

  // Other tabs
  const [satuanCounts, setSatuanCounts] = useState({});
  const [sepatuCounts, setSepatuCounts] = useState({});
  const [showcaseCounts, setShowcaseCounts] = useState({});

  // Evidence photos (multi)
  const [evidencePhotos, setEvidencePhotos] = useState([]);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Payment
  const [paymentStatus, setPaymentStatus] = useState("lunas");
  const [paymentProof, setPaymentProof] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentUploading, setPaymentUploading] = useState(false);

  // QR / save
  const [qrOpen, setQrOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [receiptRemainingKg, setReceiptRemainingKg] = useState(0);
  const [receiptUsedMembership, setReceiptUsedMembership] = useState(false);
  const [receiptMemberSnapshot, setReceiptMemberSnapshot] = useState(null);

  // Search / tracking
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [trackOrder, setTrackOrder] = useState(null);

  // Membership
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regName, setRegName] = useState("");
  const [regWa, setRegWa] = useState("");
  const [regSource, setRegSource] = useState("tamel");
  const [regSelectedTier, setRegSelectedTier] = useState("Gold");

  // Regular (non-member) customers — needed so kurir can deliver
  const [regularCustomers, setRegularCustomers] = useState([]);
  const [regCustOpen, setRegCustOpen] = useState(false);
  const [regCustName, setRegCustName] = useState("");
  const [regCustWa, setRegCustWa] = useState("");
  const [regCustAddress, setRegCustAddress] = useState("");

  // Live prices from backend (falls back to the hardcoded defaults on failure)
  const [livePrices, setLivePrices] = useState(null);
  // Memoised current staff so we can tag orders with the correct actor
  const currentStaff = getCurrentStaff();

  useEffect(() => {
    (async () => {
      try {
        const rows = await fetchPrices();
        if (Array.isArray(rows) && rows.length > 0) {
          const map = Object.fromEntries(rows.map((p) => [p.service_id, p]));
          setLivePrices(map);
        }
      } catch (e) {
        console.warn("Gagal sync harga dari backend:", e.message);
      }
    })();
  }, []);

  // Initial customer directory sync from the backend so the POS search modal
  // sees what Admin/previous POS sessions already created.
  useEffect(() => {
    (async () => {
      try {
        const rows = await searchCustomers("");
        if (!Array.isArray(rows)) return;
        // Split into members vs regulars
        const apiMembers = [];
        const apiRegulars = [];
        for (const c of rows) {
          if (c.type === "Member") {
            apiMembers.push({
              id: c.id,
              name: c.name,
              wa: c.phone,
              tier: c.member_tier || "Silver",
              quotaKg: c.remaining_quota_kg ?? 0,
              remainingKg: c.remaining_quota_kg ?? 0,
              expiry: c.quota_expiry_date
                ? new Date(c.quota_expiry_date).toLocaleDateString("id-ID")
                : "—",
              source: "umum",
            });
          } else {
            apiRegulars.push({
              id: c.id,
              name: c.name,
              wa: c.phone,
              address: c.address || "",
            });
          }
        }
        if (apiMembers.length > 0) {
          setMembers((prev) => {
            const existing = new Set(prev.map((m) => m.name.toLowerCase()));
            const fresh = apiMembers.filter(
              (m) => !existing.has(m.name.toLowerCase())
            );
            return [...prev, ...fresh];
          });
        }
        if (apiRegulars.length > 0) {
          setRegularCustomers((prev) => {
            const existing = new Set(prev.map((c) => c.name.toLowerCase()));
            const fresh = apiRegulars.filter(
              (c) => !existing.has(c.name.toLowerCase())
            );
            return [...prev, ...fresh];
          });
        }
      } catch (e) {
        console.warn("Gagal sync customers dari backend:", e.message);
      }
    })();
  }, []);

  const activeMember = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    if (!q) return null;
    return (
      members.find((m) => m.name.toLowerCase() === q && m.remainingKg > 0) ||
      null
    );
  }, [customerName, members]);

  // Combined profile lookup for the typed customer name (member OR regular)
  const customerProfile = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    if (!q) return null;
    const member = members.find((m) => m.name.toLowerCase() === q);
    if (member) {
      return { name: member.name, wa: member.wa, address: "", kind: "member" };
    }
    const reg = regularCustomers.find((c) => c.name.toLowerCase() === q);
    if (reg) {
      return { ...reg, kind: "regular" };
    }
    return null;
  }, [customerName, members, regularCustomers]);

  const selectedSource = SOURCE_OPTIONS.find((s) => s.id === sumberOrder);
  const minKg = selectedSource?.minKg ?? 0;
  const isMember = sumberOrder === "kosan";
  const discountRate = isMember ? 0.1 : 0;

  // Adjust kiloan when source changes
  useEffect(() => {
    if (kiloanKg < minKg) {
      setKiloanKg(minKg);
      setKiloanInput(minKg.toFixed(1));
    }
  }, [minKg, kiloanKg]);

  const bumpCount = (setter) => (id, delta) => {
    setter((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const updateKiloanKg = (newVal) => {
    const clamped = Math.max(minKg, Math.max(0, newVal));
    setKiloanKg(clamped);
    setKiloanInput(clamped.toFixed(1));
  };

  const handleKiloanInputChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    setKiloanInput(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      setKiloanKg(parsed);
    }
  };

  const handleKiloanInputBlur = () => {
    const parsed = parseFloat(kiloanInput);
    if (isNaN(parsed) || parsed < minKg) {
      setKiloanKg(minKg);
      setKiloanInput(minKg.toFixed(1));
      if (parsed < minKg) {
        toast.error(`Minimum ${minKg.toFixed(1)} kg untuk ${selectedSource.label}`);
      }
    } else {
      setKiloanKg(parsed);
      setKiloanInput(parsed.toFixed(1));
    }
  };

  const subtotal = useMemo(() => {
    let sum = kiloanKg * KILOAN_PRICE;
    SATUAN_ITEMS.forEach((i) => {
      sum += (satuanCounts[i.id] || 0) * i.price;
    });
    SEPATU_ITEMS.forEach((i) => {
      sum += (sepatuCounts[i.id] || 0) * i.price;
    });
    SHOWCASE_ITEMS.forEach((i) => {
      sum += (showcaseCounts[i.id] || 0) * i.price;
    });
    return sum;
  }, [kiloanKg, satuanCounts, sepatuCounts, showcaseCounts]);

  const kiloanCost = kiloanKg * KILOAN_PRICE;
  const usingMembership = !!activeMember && kiloanKg > 0;
  // Auto-deduct: if active member, kiloan cost is covered by quota
  const membershipDeduction = usingMembership ? kiloanCost : 0;
  const discount = (subtotal - membershipDeduction) * discountRate;
  const total = Math.max(0, subtotal - membershipDeduction - discount);

  const totalItemsCount =
    (kiloanKg > 0 ? 1 : 0) +
    Object.values(satuanCounts).filter((v) => v > 0).length +
    Object.values(sepatuCounts).filter((v) => v > 0).length +
    Object.values(showcaseCounts).filter((v) => v > 0).length;

  // Photo evidence (multi)
  const handleTakePhoto = () => {
    setPhotoModalOpen(true);
    setPhotoUploading(true);
    setTimeout(() => {
      const newPhoto = {
        id: `evidence_${Date.now()}`,
        thumbnail: `hsl(${Math.random() * 60 + 30}, 80%, 55%)`,
      };
      setEvidencePhotos((prev) => [...prev, newPhoto]);
      setPhotoUploading(false);
      toast.success(`Foto ${evidencePhotos.length + 1} tersimpan`);
    }, 900);
  };

  const handleClosePhotoModal = (open) => {
    if (!open) {
      setPhotoUploading(false);
    }
    setPhotoModalOpen(open);
  };

  const removeEvidencePhoto = (id) => {
    setEvidencePhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Payment proof
  const handlePaymentPhoto = () => {
    setPaymentModalOpen(true);
    setPaymentUploading(true);
    setTimeout(() => {
      setPaymentProof({
        id: `payment_${Date.now()}`,
        method: "Cash",
        amount: total,
      });
      setPaymentUploading(false);
      toast.success("Bukti bayar tersimpan");
    }, 900);
  };

  const handleClosePaymentModal = (open) => {
    if (!open) setPaymentUploading(false);
    setPaymentModalOpen(open);
  };

  // Save validation
  const saveBlockedReason = useMemo(() => {
    if (!customerName.trim()) return "Isi nama pelanggan terlebih dahulu";
    if (totalItemsCount <= 0) return "Tambahkan item terlebih dahulu";
    if (total > 0 && paymentStatus === "lunas" && !paymentProof)
      return "Upload bukti pembayaran dulu";
    return null;
  }, [customerName, totalItemsCount, total, paymentStatus, paymentProof]);

  const handleSave = () => {
    if (saveBlockedReason) {
      toast.error(saveBlockedReason);
      return;
    }
    const id =
      "LND-" +
      new Date()
        .toISOString()
        .replace(/[-:T.Z]/g, "")
        .slice(2, 14) +
      "-" +
      Math.floor(Math.random() * 900 + 100);
    setOrderId(id);

    // Snapshot membership state BEFORE state mutation so receipt shows correct post-order remaining
    if (usingMembership && activeMember) {
      const remainingAfter = Math.max(0, activeMember.remainingKg - kiloanKg);
      setReceiptRemainingKg(remainingAfter);
      setReceiptUsedMembership(true);
      setReceiptMemberSnapshot({ ...activeMember });
      setMembers((prev) =>
        prev.map((m) =>
          m.name === activeMember.name
            ? { ...m, remainingKg: remainingAfter }
            : m
        )
      );
      // Fire-and-forget: deduct quota on the server too, so other clients see it
      if (activeMember.id) {
        deductQuota(activeMember.id, kiloanKg, `order ${id}`).catch((err) => {
          console.warn("Deduct quota gagal:", err.message);
          toast.warning("Sinkronisasi quota ke server gagal", {
            description: "Quota lokal diupdate, retry server di background.",
          });
        });
      }
    } else {
      setReceiptUsedMembership(false);
      setReceiptMemberSnapshot(null);
    }

    // For Anter Jemput orders, push the order to the courier pipeline so kurir
    // sees it in the "Menunggu di Outlet" list with the right address + WA.
    if (sumberOrder === "anter") {
      const itemsLabelParts = [];
      if (kiloanKg > 0) itemsLabelParts.push(`${kiloanKg.toFixed(1)} kg Kiloan`);
      const satuanCount = Object.values(satuanCounts).reduce((a, b) => a + b, 0);
      if (satuanCount > 0) itemsLabelParts.push(`${satuanCount} pcs Satuan`);
      const sepatuCount = Object.values(sepatuCounts).reduce((a, b) => a + b, 0);
      if (sepatuCount > 0) itemsLabelParts.push(`${sepatuCount} pcs Sepatu/Karpet`);
      const showcaseCount = Object.values(showcaseCounts).reduce((a, b) => a + b, 0);
      if (showcaseCount > 0) itemsLabelParts.push(`${showcaseCount} pcs Showcase`);

      pushPendingOrder({
        id,
        customer: customerName.trim(),
        address: customerProfile?.address || "Alamat belum tercatat",
        phone: customerProfile?.wa || "—",
        eta: "—",
        items: itemsLabelParts.join(" · ") || "Order",
        total: usingMembership ? "Rp 0 · Membership" : formatIDR(total),
        paymentStatus: usingMembership ? "lunas" : paymentStatus,
      });
    }

    // Persist to backend as the source of truth — optimistic cache is the UI
    // and `orderStore.js` for the courier; errors surface via toast but don't
    // block the receipt.
    const sourceMap = {
      walkin: "Walk-in",
      tamel: "Tamel",
      anter: "Anter",
      kosan: "Kosan",
    };
    const itemsSummary = [];
    if (kiloanKg > 0) itemsSummary.push(`${kiloanKg.toFixed(1)}kg kiloan`);
    Object.entries(satuanCounts).forEach(([k, v]) => { if (v > 0) itemsSummary.push(`${v}× ${k}`); });
    Object.entries(sepatuCounts).forEach(([k, v]) => { if (v > 0) itemsSummary.push(`${v}× ${k}`); });
    Object.entries(showcaseCounts).forEach(([k, v]) => { if (v > 0) itemsSummary.push(`${v}× ${k}`); });

    const payload = {
      order_id: id,
      customer_name: customerName.trim() || "Walk-in",
      customer_phone: customerProfile?.wa || activeMember?.wa || "-",
      customer_address: customerProfile?.address || null,
      source: sourceMap[sumberOrder] || "Walk-in",
      weight_kg: Number(kiloanKg) || 0,
      items_detail: itemsSummary.join(", ") || null,
      total_price: usingMembership ? 0 : Math.round(total || 0),
      payment_status: usingMembership ? "Lunas" : (paymentStatus === "lunas" ? "Lunas" : "Nanti"),
      order_status: "Antrian",
      actor: getActorTag() || `kasir-${(currentStaff?.name || "unknown").toLowerCase()}`,
    };
    createOrder(payload).catch((err) => {
      console.error("Gagal menyimpan order ke backend:", err.message);
      toast.error("Simpan ke server gagal", {
        description: `Order tersimpan lokal. Detail: ${err.message}`,
      });
    });

    setQrOpen(true);
  };

  // Snapshot of remaining kg AFTER deduction (live preview in kiloan helper, before save)
  const memberRemainingAfter = activeMember
    ? Math.max(0, activeMember.remainingKg - (usingMembership ? kiloanKg : 0))
    : 0;

  const resetAll = () => {
    setCustomerName("");
    setSumberOrder("walkin");
    setKiloanKg(2.0);
    setKiloanInput("2.0");
    setShowKiloanDetail(false);
    setKiloanDetail({});
    setSatuanCounts({});
    setSepatuCounts({});
    setShowcaseCounts({});
    setEvidencePhotos([]);
    setPaymentStatus("lunas");
    setPaymentProof(null);
    setQrOpen(false);
  };

  const qrPayload = JSON.stringify({
    order_id: orderId,
    customer: customerName,
    source: sumberOrder,
    total,
    items: totalItemsCount,
    paid: paymentStatus === "lunas",
    ts: Date.now(),
  });

  // Search
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return MOCK_ORDERS.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [searchQuery]);

  return (
    <div
      className="relative min-h-screen text-white font-body max-w-md mx-auto md:border-x md:border-white/5"
      data-testid="pos-screen"
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 glass-strong border-b border-white/10 px-4 py-3 flex items-center justify-between gap-2"
        data-testid="pos-header"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFD700] flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.4)]">
            <Shirt size={18} className="text-black" strokeWidth={2.5} />
          </div>
          <div>
            <div
              className="font-heading font-extrabold text-[#FFD700] text-base leading-none tracking-tight"
              data-testid="header-title"
            >
              LaundryMax
            </div>
            <div className="text-white/50 text-[10px] uppercase tracking-[0.15em] mt-0.5">
              Cashier
            </div>
          </div>
        </div>
        <HeaderNav />
      </header>

      <main className="px-5 pt-4 pb-44 space-y-4">
        {/* Search bar */}
        <section className="relative animate-fade-up" data-testid="search-section">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
              placeholder="Cari Orderan (ID / nama)..."
              data-testid="search-input"
              className="w-full h-12 pl-11 pr-11 rounded-2xl glass text-white placeholder-white/40 text-sm font-medium focus:border-[#FFD700]/50 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchOpen(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {searchOpen && searchResults.length > 0 && (
            <div
              className="absolute top-14 inset-x-0 z-30 glass-strong border border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] animate-fade-up"
              data-testid="search-results"
            >
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setTrackOrder(r);
                    setSearchOpen(false);
                  }}
                  data-testid={`search-result-${r.id}`}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/5 border-b border-white/5 last:border-0 text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/25 flex items-center justify-center flex-shrink-0">
                      <Package size={14} className="text-[#FFD700]" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-heading font-bold text-white text-sm">
                        {r.customer}
                      </div>
                      <div className="text-white/40 text-[11px] flex items-center gap-1.5">
                        <span className="font-mono">{r.id}</span>
                        <span>·</span>
                        <span>{r.kg} kg</span>
                        <span>·</span>
                        <span>{r.date}</span>
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700] text-[9px] font-heading font-bold uppercase tracking-wider flex-shrink-0">
                    {STAGES[r.stage]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Customer block */}
        <section className="animate-fade-up space-y-3" style={{ animationDelay: "60ms" }}>
          <div>
            <label className="text-white/50 text-xs uppercase tracking-widest mb-2 block font-medium">
              Nama Pelanggan
            </label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FFD700]"
              />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Masukkan nama pelanggan"
                data-testid="customer-name-input"
                className="w-full h-14 pl-11 pr-4 rounded-2xl glass text-white placeholder-white/40 text-base font-medium focus:border-[#FFD700]/50 focus:outline-none transition-colors"
              />
            </div>

            {/* Membership Active Badge */}
            {activeMember && (
              <div
                className={`mt-2 rounded-2xl border p-3 animate-fade-up ${TIER_STYLE[activeMember.tier].bg} ${TIER_STYLE[activeMember.tier].border}`}
                data-testid="member-active-badge"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${TIER_STYLE[activeMember.tier].badge}`}
                  >
                    {activeMember.tier === "Platinum" ? (
                      <Crown size={16} strokeWidth={2.25} />
                    ) : activeMember.tier === "Gold" ? (
                      <Sparkles size={16} strokeWidth={2.25} />
                    ) : (
                      <Star size={16} strokeWidth={2.25} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-heading font-bold text-white/50">
                      Member Aktif
                      <span
                        className={`px-1.5 py-0 rounded-md ${TIER_STYLE[activeMember.tier].badge} border`}
                      >
                        {activeMember.tier}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-0.5 text-sm">
                      <span className="text-white/60">Sisa Kuota:</span>
                      <span
                        className={`font-heading font-bold ${TIER_STYLE[activeMember.tier].text}`}
                        data-testid="member-quota-remaining"
                      >
                        {activeMember.remainingKg.toFixed(1)} kg
                      </span>
                    </div>
                    <div className="text-white/40 text-[10px] mt-0.5 flex items-center gap-1">
                      <Calendar size={10} />
                      Berlaku s/d {activeMember.expiry}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Daftar Member button + Save Regular Customer button */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setRegName(customerName || "");
                  setRegisterOpen(true);
                }}
                data-testid="register-member-button"
                className="h-11 rounded-xl border border-[#FFD700]/40 bg-gradient-to-r from-[#FFD700]/15 to-[#FFD700]/5 hover:from-[#FFD700]/25 hover:to-[#FFD700]/10 text-[#FFD700] font-heading font-bold text-xs tracking-wide flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <Sparkles size={14} strokeWidth={2.5} />
                DAFTAR MEMBER BARU
              </button>
              <button
                onClick={() => {
                  setRegCustName(customerName || "");
                  setRegCustWa("");
                  setRegCustAddress("");
                  setRegCustOpen(true);
                }}
                data-testid="register-regular-button"
                className="h-11 rounded-xl border-2 border-[#FFD700]/40 bg-transparent hover:bg-[#FFD700]/5 hover:border-[#FFD700]/70 text-[#FFD700]/90 hover:text-[#FFD700] font-heading font-bold text-xs tracking-wide flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <NotebookPen size={14} strokeWidth={2.5} />
                SIMPAN PELANGGAN REGULER
              </button>
            </div>

            {/* Saved-regular-customer hint (when typed name matches saved regular) */}
            {customerProfile?.kind === "regular" && (
              <div
                className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 flex items-start gap-2"
                data-testid="regular-customer-hint"
              >
                <NotebookPen size={13} className="text-[#FFD700] mt-0.5 flex-shrink-0" />
                <div className="text-[11px] text-white/60 leading-snug min-w-0">
                  <span className="font-heading font-bold text-white/80">
                    Pelanggan reguler tersimpan
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-white/50">
                    <Phone size={10} />
                    <span className="font-mono">{customerProfile.wa}</span>
                  </div>
                  <div className="flex items-start gap-1.5 mt-0.5 text-white/50">
                    <MapPin size={10} className="mt-0.5 flex-shrink-0" />
                    <span className="truncate">{customerProfile.address}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-white/50 text-xs uppercase tracking-widest mb-2 block font-medium">
              Sumber Order
            </label>
            <Select value={sumberOrder} onValueChange={setSumberOrder}>
              <SelectTrigger
                data-testid="sumber-order-dropdown"
                className="w-full h-14 glass text-white font-medium text-base rounded-2xl border-white/10 hover:border-[#FFD700]/50 transition-colors focus:ring-[#FFD700] focus:ring-offset-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
                {SOURCE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.id}
                    value={opt.id}
                    data-testid={`sumber-option-${opt.id}`}
                    className="focus:bg-[#FFD700]/10 focus:text-[#FFD700] py-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <opt.Icon size={15} />
                      <div>
                        <div className="font-medium">{opt.label}</div>
                        <div className="text-[10px] text-white/40">{opt.sub}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isMember && (
              <div
                className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] text-xs font-semibold"
                data-testid="member-badge"
              >
                <CheckCircle2 size={12} />
                Diskon Kosan Kerjasama 10% aktif
              </div>
            )}
            {minKg > 0 && (
              <div className="mt-2 text-white/40 text-[11px]" data-testid="min-kg-hint">
                Min. kiloan untuk {selectedSource.label}: {minKg.toFixed(1)} kg
              </div>
            )}
          </div>
        </section>

        {/* Tabs */}
        <section className="animate-fade-up" style={{ animationDelay: "120ms" }}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList
              className="w-full h-auto p-1.5 glass rounded-2xl grid grid-cols-4 gap-1"
              data-testid="tabs-list"
            >
              {[
                { v: "kiloan", label: "Kiloan", icon: Scale, testid: "tab-kiloan" },
                { v: "satuan", label: "Satuan", icon: Shirt, testid: "tab-satuan" },
                {
                  v: "sepatu",
                  label: "Sepatu",
                  icon: Footprints,
                  testid: "tab-sepatu-karpet",
                },
                {
                  v: "showcase",
                  label: "Showcase",
                  icon: ShoppingBag,
                  testid: "tab-showcase",
                },
              ].map((t) => (
                <TabsTrigger
                  key={t.v}
                  value={t.v}
                  data-testid={t.testid}
                  className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-white/60 text-[11px] font-semibold data-[state=active]:bg-[#FFD700] data-[state=active]:text-black data-[state=active]:shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all"
                >
                  <t.icon size={18} strokeWidth={2.25} />
                  <span>{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Kiloan */}
            <TabsContent
              value="kiloan"
              className="mt-4 glass rounded-2xl p-6 animate-fade-up"
            >
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-heading font-bold text-xl text-white">
                  Cuci Kiloan
                </h3>
                <span className="text-[#FFD700] font-semibold text-sm">
                  {formatIDR(KILOAN_PRICE)}/kg
                </span>
              </div>
              <p className="text-white/50 text-xs mb-5">
                Atur berat cucian · min {minKg.toFixed(1)} kg
              </p>
              <div className="flex items-center justify-between gap-3">
                <CounterBtn
                  onClick={() => updateKiloanKg(kiloanKg - 0.5)}
                  testid="kiloan-decrease"
                  disabled={kiloanKg <= minKg}
                >
                  <Minus size={22} />
                </CounterBtn>
                <div className="flex-1 text-center">
                  <div className="relative flex items-baseline justify-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={kiloanInput}
                      onChange={handleKiloanInputChange}
                      onBlur={handleKiloanInputBlur}
                      data-testid="kiloan-manual-input"
                      className="w-28 bg-transparent text-center font-heading font-black text-[#FFD700] text-5xl leading-none tracking-tight focus:outline-none border-b-2 border-transparent focus:border-[#FFD700]/40 transition-colors"
                    />
                    <span className="font-heading font-bold text-white/40 text-lg">kg</span>
                  </div>
                  <div
                    className="text-white/50 text-[10px] uppercase tracking-widest mt-1.5"
                    data-testid="kiloan-kg-display"
                  >
                    Kilogram
                  </div>
                </div>
                <CounterBtn
                  onClick={() => updateKiloanKg(kiloanKg + 0.5)}
                  testid="kiloan-increase"
                  variant="primary"
                >
                  <Plus size={22} />
                </CounterBtn>
              </div>
              <div className="mt-5 pt-4 border-t border-white/5 flex justify-between items-center">
                <span className="text-white/60 text-sm">Subtotal kiloan</span>
                <span
                  className="font-heading font-bold text-white text-lg"
                  data-testid="kiloan-subtotal"
                >
                  {formatIDR(kiloanKg * KILOAN_PRICE)}
                </span>
              </div>

              {usingMembership && (
                <div
                  className={`mt-3 p-3 rounded-xl border ${TIER_STYLE[activeMember.tier].bg} ${TIER_STYLE[activeMember.tier].border}`}
                  data-testid="membership-helper"
                >
                  <div className="flex items-start gap-2.5">
                    {activeMember.tier === "Platinum" ? (
                      <Crown size={14} className={TIER_STYLE[activeMember.tier].text} />
                    ) : activeMember.tier === "Gold" ? (
                      <Sparkles size={14} className={TIER_STYLE[activeMember.tier].text} />
                    ) : (
                      <Star size={14} className={TIER_STYLE[activeMember.tier].text} />
                    )}
                    <div className="flex-1 text-xs leading-relaxed">
                      <span className="text-white/70">
                        Akan memotong sisa kuota membership.
                      </span>{" "}
                      <span className={`font-heading font-bold ${TIER_STYLE[activeMember.tier].text}`}>
                        −{kiloanKg.toFixed(1)} kg
                      </span>
                      <div className="text-white/40 text-[10px] mt-0.5">
                        Sisa setelah order: {memberRemainingAfter.toFixed(1)} kg
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Optional detail */}
              <div className="mt-4 pt-4 border-t border-white/5">
                <button
                  onClick={() => setShowKiloanDetail((v) => !v)}
                  data-testid="toggle-kiloan-detail"
                  className="w-full flex items-center justify-between px-3 h-11 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#FFD700]/30 text-sm transition-all"
                >
                  <span className="flex items-center gap-2 text-white/80 font-medium">
                    <Package size={14} className="text-[#FFD700]" />
                    Hitung Detail Item (Opsional)
                  </span>
                  {showKiloanDetail ? (
                    <ChevronUp size={16} className="text-white/50" />
                  ) : (
                    <ChevronDown size={16} className="text-white/50" />
                  )}
                </button>
                {showKiloanDetail && (
                  <div
                    className="mt-3 p-3 rounded-xl bg-black/30 border border-white/5 space-y-2 animate-fade-up"
                    data-testid="kiloan-detail-list"
                  >
                    <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium px-1">
                      Catat isi bag · tidak mempengaruhi harga
                    </p>
                    {KILOAN_DETAIL_ITEMS.map((item) => {
                      const c = kiloanDetail[item.id] || 0;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between px-2 py-1.5"
                          data-testid={`kiloan-detail-${item.id}`}
                        >
                          <span className="text-white/80 text-sm">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => bumpCount(setKiloanDetail)(item.id, -1)}
                              data-testid={`kiloan-detail-dec-${item.id}`}
                              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
                            >
                              <Minus size={14} />
                            </button>
                            <span
                              className="min-w-[1.5rem] text-center font-heading font-bold text-[#FFD700] text-sm"
                              data-testid={`kiloan-detail-count-${item.id}`}
                            >
                              {c}
                            </span>
                            <button
                              onClick={() => bumpCount(setKiloanDetail)(item.id, 1)}
                              data-testid={`kiloan-detail-inc-${item.id}`}
                              className={`w-8 h-8 rounded-lg border flex items-center justify-center active:scale-90 transition-all ${
                                c > 0
                                  ? "bg-[#FFD700] text-black border-[#FFD700]"
                                  : "bg-white/5 border-white/10 hover:bg-white/10"
                              }`}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="satuan" className="mt-4 space-y-2.5">
              {SATUAN_ITEMS.map((item, i) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  count={satuanCounts[item.id] || 0}
                  onInc={() => bumpCount(setSatuanCounts)(item.id, 1)}
                  onDec={() => bumpCount(setSatuanCounts)(item.id, -1)}
                  idx={i}
                />
              ))}
            </TabsContent>
            <TabsContent value="sepatu" className="mt-4 space-y-2.5">
              {SEPATU_ITEMS.map((item, i) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  count={sepatuCounts[item.id] || 0}
                  onInc={() => bumpCount(setSepatuCounts)(item.id, 1)}
                  onDec={() => bumpCount(setSepatuCounts)(item.id, -1)}
                  idx={i}
                />
              ))}
            </TabsContent>
            <TabsContent value="showcase" className="mt-4 space-y-2.5">
              {SHOWCASE_ITEMS.map((item, i) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  count={showcaseCounts[item.id] || 0}
                  onInc={() => bumpCount(setShowcaseCounts)(item.id, 1)}
                  onDec={() => bumpCount(setShowcaseCounts)(item.id, -1)}
                  idx={i}
                />
              ))}
            </TabsContent>
          </Tabs>
        </section>

        {/* Evidence photos (multi) */}
        <section className="animate-fade-up" style={{ animationDelay: "200ms" }}>
          <button
            onClick={handleTakePhoto}
            data-testid="photo-upload-button"
            className={`w-full p-5 rounded-2xl border-2 border-dashed flex items-center justify-center gap-3 transition-all duration-300 active:scale-[0.98] ${
              evidencePhotos.length > 0
                ? "border-[#FFD700] bg-[#FFD700]/15 text-[#FFD700]"
                : "border-[#FFD700]/50 bg-[#FFD700]/5 text-[#FFD700] hover:bg-[#FFD700]/15 hover:border-[#FFD700] pulse-yellow"
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-[#FFD700]/20 flex items-center justify-center">
              <Camera size={22} strokeWidth={2.25} />
            </div>
            <div className="text-left">
              <div className="font-heading font-extrabold text-base tracking-tight">
                {evidencePhotos.length > 0
                  ? `+ TAMBAH FOTO CUCIAAN`
                  : `AMBIL FOTO CUCIAAN`}
              </div>
              <div className="text-[10px] text-[#FFD700]/70 mt-0.5 uppercase tracking-widest font-medium">
                {evidencePhotos.length > 0
                  ? `${evidencePhotos.length} foto tersimpan`
                  : "Bisa lebih dari 1 foto"}
              </div>
            </div>
          </button>

          {evidencePhotos.length > 0 && (
            <div
              className="mt-3 grid grid-cols-4 gap-2"
              data-testid="evidence-thumbnails"
            >
              {evidencePhotos.map((p, idx) => (
                <div
                  key={p.id}
                  className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group"
                  data-testid={`evidence-thumb-${idx}`}
                  style={{
                    background: `linear-gradient(135deg, ${p.thumbnail}, rgba(0,0,0,0.3))`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-white/70">
                    <Camera size={18} />
                  </div>
                  <div className="absolute bottom-1 left-1 text-[9px] font-mono text-white/80 font-bold bg-black/40 px-1 rounded">
                    #{idx + 1}
                  </div>
                  <button
                    onClick={() => removeEvidencePhoto(p.id)}
                    data-testid={`evidence-remove-${idx}`}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white/80 hover:bg-[#FF6B6B] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Hapus foto"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Payment status */}
        <section className="animate-fade-up" style={{ animationDelay: "260ms" }}>
          <div className="text-white/50 text-xs uppercase tracking-widest mb-2 block font-medium">
            Status Pembayaran
          </div>
          <div
            className="glass rounded-2xl p-1.5 grid grid-cols-2 gap-1"
            data-testid="payment-toggle"
          >
            <button
              onClick={() => setPaymentStatus("lunas")}
              data-testid="payment-lunas"
              className={`h-11 rounded-xl flex items-center justify-center gap-2 font-heading font-bold text-sm tracking-wide transition-all ${
                paymentStatus === "lunas"
                  ? "bg-[#7DF08F] text-black shadow-[0_0_15px_rgba(125,240,143,0.3)]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Wallet size={15} strokeWidth={2.5} />
              LUNAS
            </button>
            <button
              onClick={() => {
                setPaymentStatus("nanti");
                setPaymentProof(null);
              }}
              data-testid="payment-nanti"
              className={`h-11 rounded-xl flex items-center justify-center gap-2 font-heading font-bold text-sm tracking-wide transition-all ${
                paymentStatus === "nanti"
                  ? "bg-[#FF8A3D] text-black shadow-[0_0_15px_rgba(255,138,61,0.3)]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Clock size={15} strokeWidth={2.5} />
              BAYAR NANTI
            </button>
          </div>

          {paymentStatus === "lunas" && (
            <div className="mt-3 animate-fade-up">
              {!paymentProof ? (
                <button
                  onClick={handlePaymentPhoto}
                  data-testid="payment-proof-button"
                  className="w-full h-12 rounded-xl border-2 border-dashed border-[#7DF08F]/50 bg-[#7DF08F]/5 hover:bg-[#7DF08F]/15 hover:border-[#7DF08F] text-[#7DF08F] font-heading font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <Receipt size={16} strokeWidth={2.5} />
                  UPLOAD BUKTI BAYAR
                  <span className="text-[#7DF08F]/60 text-[10px]">* wajib</span>
                </button>
              ) : (
                <div
                  className="p-3 rounded-xl bg-[#7DF08F]/10 border border-[#7DF08F]/30 flex items-center gap-3"
                  data-testid="payment-proof-thumbnail"
                >
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#7DF08F]/30 to-[#FFD700]/20 border border-[#7DF08F]/40 flex items-center justify-center flex-shrink-0">
                    <Receipt size={24} className="text-[#7DF08F]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-bold text-[#7DF08F] text-sm">
                      Bukti bayar tersimpan
                    </div>
                    <div className="text-white/50 text-[11px] font-mono truncate">
                      {paymentProof.method} · {formatIDR(paymentProof.amount)}
                    </div>
                  </div>
                  <button
                    onClick={() => setPaymentProof(null)}
                    data-testid="payment-proof-remove"
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-[#FF6B6B] hover:border-[#FF6B6B]/30 transition-colors flex-shrink-0"
                    aria-label="Hapus bukti bayar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Sticky bottom bar */}
      <div
        className="fixed bottom-0 inset-x-0 max-w-md mx-auto z-50 glass-strong border-t border-white/10 rounded-t-3xl px-5 pt-4 pb-5 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
        data-testid="sticky-bottom-bar"
      >
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-white/50 text-[11px] uppercase tracking-widest font-medium">
              Total Harga
              {usingMembership && (
                <span
                  className="ml-1.5 text-[#FFD700] normal-case tracking-normal"
                  data-testid="total-membership-note"
                >
                  (membership cover)
                </span>
              )}
              {!usingMembership && isMember && subtotal > 0 && (
                <span className="ml-1.5 text-[#FFD700] normal-case tracking-normal">
                  (−{formatIDR(discount)})
                </span>
              )}
            </div>
            <div
              className="font-heading font-black text-[#FFD700] text-3xl leading-none tracking-tight mt-1"
              data-testid="total-price-display"
            >
              {formatIDR(total)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-white/50 text-[11px] uppercase tracking-widest font-medium">
              Item
            </div>
            <div className="font-heading font-bold text-white text-lg mt-1">
              {totalItemsCount}
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          data-testid="save-print-button"
          disabled={!!saveBlockedReason}
          className="w-full h-14 rounded-2xl bg-[#FFD700] text-black font-heading font-extrabold text-base tracking-wide flex items-center justify-center gap-2.5 transition-all active:scale-[0.97] hover:bg-[#ffdf33] disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_8px_30px_rgba(255,215,0,0.3)]"
        >
          <QrCode size={20} strokeWidth={2.5} />
          SIMPAN & CETAK QR CODE
        </button>
        {saveBlockedReason && (
          <div
            className="text-center text-[11px] text-[#FF8A3D] mt-2 font-medium"
            data-testid="save-blocked-hint"
          >
            {saveBlockedReason}
          </div>
        )}
      </div>

      {/* Evidence photo modal */}
      <Dialog open={photoModalOpen} onOpenChange={handleClosePhotoModal}>
        <DialogContent className="bg-[#111111] border-white/10 text-white max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-[#FFD700]">
              Kamera Bukti Cucian
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              Foto sedang diunggah ke object storage sebagai bukti terima.
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-square rounded-2xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 flex items-center justify-center overflow-hidden relative">
            {photoUploading ? (
              <div className="flex flex-col items-center gap-3 text-white/60">
                <div className="w-16 h-16 rounded-full border-4 border-[#FFD700]/40 border-t-[#FFD700] animate-spin" />
                <div className="text-xs uppercase tracking-widest">
                  Mengunggah ke R2...
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-[#FFD700]">
                <CheckCircle2 size={56} strokeWidth={2} />
                <div className="font-heading font-bold">Tersimpan</div>
                <div className="text-[11px] text-white/50 font-mono">
                  {evidencePhotos.length} foto total
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setPhotoModalOpen(false)}
            className="w-full h-12 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            data-testid="close-photo-modal"
          >
            <X size={16} /> Tutup
          </button>
        </DialogContent>
      </Dialog>

      {/* Payment proof modal */}
      <Dialog open={paymentModalOpen} onOpenChange={handleClosePaymentModal}>
        <DialogContent className="bg-[#111111] border-white/10 text-white max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-[#7DF08F]">
              Foto Bukti Bayar
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              Ambil foto struk / uang diterima sebagai bukti pembayaran.
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-square rounded-2xl bg-gradient-to-br from-[#7DF08F]/10 to-white/0 border border-white/10 flex items-center justify-center overflow-hidden relative">
            {paymentUploading ? (
              <div className="flex flex-col items-center gap-3 text-white/60">
                <div className="w-16 h-16 rounded-full border-4 border-[#7DF08F]/40 border-t-[#7DF08F] animate-spin" />
                <div className="text-xs uppercase tracking-widest">
                  Memverifikasi pembayaran...
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-[#7DF08F]">
                <Receipt size={56} strokeWidth={2} />
                <div className="font-heading font-bold">Bukti tersimpan</div>
                <div className="text-[11px] text-white/50 font-mono">
                  {formatIDR(total)}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setPaymentModalOpen(false)}
            className="w-full h-12 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            data-testid="close-payment-modal"
          >
            <X size={16} /> Tutup
          </button>
        </DialogContent>
      </Dialog>

      {/* Tracking modal */}
      <TrackingModal order={trackOrder} onClose={() => setTrackOrder(null)} />

      {/* QR modal */}
      <QrReceiptModal
        open={qrOpen}
        onOpenChange={setQrOpen}
        orderId={orderId}
        customerName={customerName}
        sumberOrder={sumberOrder}
        totalItemsCount={totalItemsCount}
        total={total}
        paymentStatus={paymentStatus}
        receiptUsedMembership={receiptUsedMembership}
        receiptMemberSnapshot={receiptMemberSnapshot}
        receiptRemainingKg={receiptRemainingKg}
        qrPayload={qrPayload}
        onNewOrder={resetAll}
      />

      {/* Membership Registration Modal */}
      <MembershipModal
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        regName={regName}
        setRegName={setRegName}
        regWa={regWa}
        setRegWa={setRegWa}
        regSource={regSource}
        setRegSource={setRegSource}
        regSelectedTier={regSelectedTier}
        setRegSelectedTier={setRegSelectedTier}
        onRegister={(newMember) => {
          setMembers((prev) => [...prev, newMember]);
          setCustomerName(newMember.name);
          setRegisterOpen(false);
          setRegWa("");
        }}
      />

      {/* Regular Customer Save Modal */}
      <RegularCustomerModal
        open={regCustOpen}
        onOpenChange={setRegCustOpen}
        name={regCustName}
        setName={setRegCustName}
        wa={regCustWa}
        setWa={setRegCustWa}
        address={regCustAddress}
        setAddress={setRegCustAddress}
        onSave={(entry) => {
          setRegularCustomers((prev) => {
            const idx = prev.findIndex((c) => c.name.toLowerCase() === entry.name.toLowerCase());
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = entry;
              return copy;
            }
            return [...prev, entry];
          });
          setCustomerName(entry.name);
          setRegCustOpen(false);
          // Persist to backend — swallow 409 (duplicate phone) silently
          createCustomer({
            name: entry.name,
            phone: entry.wa || "",
            address: entry.address || null,
            type: "Regular",
          }).catch((err) => {
            if (!/409/.test(err.message)) {
              console.warn("Gagal simpan customer ke backend:", err.message);
            }
          });
        }}
      />
    </div>
  );
}
