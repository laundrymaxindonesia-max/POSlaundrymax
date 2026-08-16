import { useState, useMemo, useEffect } from "react";
import {
  Camera,
  QrCode,
  Shirt,
  X,
  CheckCircle2,
  Search,
  Wallet,
  Clock,
  Receipt,
  Trash2,
  Sparkles,
  Crown,
  Star,
  Timer,
  Hourglass,
  Zap,
} from "lucide-react";
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
  uploadPod,
} from "@/lib/api";
import { getActorTag, getCurrentStaff } from "@/lib/staffSession";
import {
  KILOAN_PRICE,
  SATUAN_ITEMS,
  SEPATU_ITEMS,
  SHOWCASE_ITEMS,
  SOURCE_OPTIONS,
  MOCK_ORDERS,
  INITIAL_MEMBERS,
  formatIDR,
  SPEED_TIERS,
  SPEED_TIER_LABEL,
} from "@/components/pos/data";
import MembershipModal from "@/components/pos/MembershipModal";
import RegularCustomerModal from "@/components/pos/RegularCustomerModal";
import TrackingModal from "@/components/pos/TrackingModal";
import QrReceiptModal from "@/components/pos/QrReceiptModal";
import CustomerSelection from "@/components/pos/CustomerSelection";
import OrderSource from "@/components/pos/OrderSource";
import ServiceTabs from "@/components/pos/ServiceTabs";
import CartSummary from "@/components/pos/CartSummary";
import CameraCapture from "@/components/CameraCapture";


export default function POSScreen() {
  // Customer
  const [customerName, setCustomerName] = useState("");
  const [sumberOrder, setSumberOrder] = useState("walkin");

  // Tabs
  const [activeTab, setActiveTab] = useState("kiloan");

  // Kiloan
  const [kiloanKg, setKiloanKg] = useState(0);
  const [kiloanInput, setKiloanInput] = useState("0.0");
  const [showKiloanDetail, setShowKiloanDetail] = useState(false);
  const [kiloanDetail, setKiloanDetail] = useState({});

  // Service speed (Durasi Pengerjaan) — applies to Kiloan, Satuan, Sepatu.
  // Showcase keeps its flat retail price (no speed tier).
  const [speedTier, setSpeedTier] = useState("reguler"); // 'reguler' | 'flash' | 'express'

  // Other tabs
  const [satuanCounts, setSatuanCounts] = useState({});
  const [sepatuCounts, setSepatuCounts] = useState({});
  const [showcaseCounts, setShowcaseCounts] = useState({});

  // Evidence photos (multi) — each item: { id, blob, dataUrl }
  const [evidencePhotos, setEvidencePhotos] = useState([]);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  // Payment
  const [paymentStatus, setPaymentStatus] = useState("lunas");
  const [paymentProof, setPaymentProof] = useState(null); // { blob, dataUrl, method?, amount? }
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

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

  // Map POS source → backend price column.
  // walkin & anter → general public (umum); tamel → outlet partner; kosan → member.
  const SOURCE_PRICE_COL = {
    walkin: "umum",
    tamel: "tamel",
    anter: "umum",
    kosan: "member",
  };
  const sourcePriceCol = SOURCE_PRICE_COL[sumberOrder] || "umum";

  // Active speed-tier definition (Reguler / Flash / Express).
  const speedTierDef =
    SPEED_TIERS.find((t) => t.id === speedTier) || SPEED_TIERS[0];
  const speedMultiplier = speedTierDef.multiplier;

  // Kiloan rate (per kg) — read from backend by speed tier + source column.
  // Fallback to hardcoded KILOAN_PRICE if backend data not yet loaded.
  const kiloanRow = livePrices?.[`kiloan_${speedTier}`];
  const kiloanRate =
    kiloanRow && typeof kiloanRow[sourcePriceCol] === "number"
      ? kiloanRow[sourcePriceCol]
      : KILOAN_PRICE;

  // Adjust kiloan when source changes — but only if customer is ALREADY doing
  // Kiloan (>0). Allow standalone Satuan / Sepatu / Showcase orders with 0 kg.
  useEffect(() => {
    if (kiloanKg > 0 && kiloanKg < minKg) {
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
    // Allow 0 (no kiloan). If positive but below minKg, snap up to minKg so
    // the cashier never accidentally bills below the source's minimum.
    if (newVal <= 0) {
      setKiloanKg(0);
      setKiloanInput("0.0");
      return;
    }
    const clamped = Math.max(minKg, newVal);
    setKiloanKg(clamped);
    setKiloanInput(clamped.toFixed(1));
  };

  const handleKiloanIncrement = () => {
    if (kiloanKg <= 0) {
      // Jump straight to the source's minimum (e.g. 2.0 kg) on the first +
      const start = minKg > 0 ? minKg : 0.5;
      setKiloanKg(start);
      setKiloanInput(start.toFixed(1));
      return;
    }
    updateKiloanKg(kiloanKg + 0.5);
  };

  const handleKiloanDecrement = () => {
    // Step down by 0.5 until we hit minKg, then one more press goes to 0.
    if (kiloanKg <= minKg) {
      setKiloanKg(0);
      setKiloanInput("0.0");
      return;
    }
    updateKiloanKg(kiloanKg - 0.5);
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
    let sum = kiloanKg * kiloanRate;
    SATUAN_ITEMS.forEach((i) => {
      sum += (satuanCounts[i.id] || 0) * i.price * speedMultiplier;
    });
    SEPATU_ITEMS.forEach((i) => {
      sum += (sepatuCounts[i.id] || 0) * i.price * speedMultiplier;
    });
    SHOWCASE_ITEMS.forEach((i) => {
      // Showcase keeps its flat retail price (no speed tier).
      sum += (showcaseCounts[i.id] || 0) * i.price;
    });
    return sum;
  }, [kiloanKg, kiloanRate, satuanCounts, sepatuCounts, showcaseCounts, speedMultiplier]);

  const kiloanCost = kiloanKg * kiloanRate;
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

  // Photo evidence (multi) — live camera capture
  const handleTakePhoto = () => {
    setPhotoModalOpen(true);
  };

  const handleEvidenceCaptured = async ({ blob, dataUrl }) => {
    const newPhoto = {
      id: `evidence_${Date.now()}`,
      blob,
      dataUrl,
    };
    setEvidencePhotos((prev) => [...prev, newPhoto]);
    setPhotoModalOpen(false);
    toast.success(`Foto ${evidencePhotos.length + 1} tersimpan`);
  };

  const removeEvidencePhoto = (id) => {
    setEvidencePhotos((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone?.dataUrl) URL.revokeObjectURL(gone.dataUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  // Payment proof (live camera)
  const handlePaymentPhoto = () => {
    setPaymentModalOpen(true);
  };

  const handlePaymentCaptured = async ({ blob, dataUrl }) => {
    setPaymentProof({
      id: `payment_${Date.now()}`,
      blob,
      dataUrl,
      method: "Cash",
      amount: total,
    });
    setPaymentModalOpen(false);
    toast.success("Bukti bayar tersimpan");
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
      if (kiloanKg > 0)
        itemsLabelParts.push(
          `${kiloanKg.toFixed(1)} kg Kiloan ${SPEED_TIER_LABEL[speedTier] || ""}`.trim()
        );
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
    const speedLabel = SPEED_TIER_LABEL[speedTier] || speedTier;
    if (kiloanKg > 0) {
      itemsSummary.push(`Cuci Kiloan - ${speedLabel} - ${kiloanKg.toFixed(1)}kg`);
    }
    Object.entries(satuanCounts).forEach(([k, v]) => {
      if (v > 0) itemsSummary.push(`${v}× ${k} (${speedLabel})`);
    });
    Object.entries(sepatuCounts).forEach(([k, v]) => {
      if (v > 0) itemsSummary.push(`${v}× ${k} (${speedLabel})`);
    });
    Object.entries(showcaseCounts).forEach(([k, v]) => {
      if (v > 0) itemsSummary.push(`${v}× ${k}`); // Showcase: no speed tier
    });

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
    createOrder(payload)
      .then(async () => {
        // Upload evidence photos + payment proof to R2 via /orders/{id}/pod.
        // We fire-and-await AFTER order creation so backend has the row.
        try {
          const actor = payload.actor;
          for (const p of evidencePhotos) {
            if (!p.blob) continue;
            const file = new File([p.blob], `evidence_${id}.jpg`, {
              type: p.blob.type || "image/jpeg",
            });
            await uploadPod(id, { actor, kind: "evidence", photo: file });
          }
          if (paymentProof?.blob) {
            const file = new File([paymentProof.blob], `payment_${id}.jpg`, {
              type: paymentProof.blob.type || "image/jpeg",
            });
            await uploadPod(id, { actor, kind: "payment", photo: file });
          }
        } catch (upErr) {
          console.error("Photo upload gagal:", upErr);
          toast.warning("Order tersimpan, tapi upload foto gagal", {
            description: upErr.message,
          });
        }
      })
      .catch((err) => {
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
    setKiloanKg(0);
    setKiloanInput("0.0");
    setShowKiloanDetail(false);
    setKiloanDetail({});
    setSatuanCounts({});
    setSepatuCounts({});
    setShowcaseCounts({});
    setEvidencePhotos([]);
    setPaymentStatus("lunas");
    setPaymentProof(null);
    setQrOpen(false);
    setSpeedTier("reguler");
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

  // Rich payload for thermal print (Model A/B/C) — snapshot of current form.
  // Recomputed on each render so the SIMPAN → print click always uses fresh
  // state; the modal caches it internally after open.
  const printPayload = useMemo(() => {
    const speedLabel = SPEED_TIER_LABEL[speedTier] || "";
    const items = [];
    if (kiloanKg > 0) {
      items.push({
        name: `Cuci Kiloan · ${speedLabel}`,
        qty: `${kiloanKg.toFixed(1)} kg`,
        subtotal: kiloanKg * kiloanRate,
      });
    }
    const pushCountedItems = (source, defs, multiplier) => {
      defs.forEach((d) => {
        const c = source[d.id] || 0;
        if (c > 0) {
          items.push({
            name: `${d.name}${multiplier !== 1 ? ` (${speedLabel})` : ""}`,
            qty: `${c} pcs`,
            subtotal: c * d.price * multiplier,
          });
        }
      });
    };
    pushCountedItems(satuanCounts, SATUAN_ITEMS, speedMultiplier);
    pushCountedItems(sepatuCounts, SEPATU_ITEMS, speedMultiplier);
    pushCountedItems(showcaseCounts, SHOWCASE_ITEMS, 1);
    return {
      id: orderId,
      customer: customerName,
      phone: customerProfile?.wa || activeMember?.wa || "",
      cashier: (getCurrentStaff()?.name) || "-",
      dateLabel: new Date().toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      speedTier,
      serviceLabel:
        kiloanKg > 0 ? `Cuci Kiloan · ${speedLabel}` : "Satuan / Sepatu",
      items_detail: items.map((i) => `${i.qty} ${i.name}`).join(", "),
      weight_kg: kiloanKg || null,
      notes: "",
      qrPayload: orderId,
      paymentStatus,
      bagIndex: 1,
      bagTotal: 1,
      items,
      subtotal,
      discount,
      total,
    };
  }, [
    orderId,
    customerName,
    customerProfile,
    activeMember,
    kiloanKg,
    kiloanRate,
    satuanCounts,
    sepatuCounts,
    showcaseCounts,
    speedTier,
    speedMultiplier,
    subtotal,
    discount,
    total,
    paymentStatus,
  ]);

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

  // Customer-name autocomplete (live search against /api/customers?q=)
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);

  // Debounced fetch as the cashier types
  useEffect(() => {
    const q = customerName.trim();
    if (q.length < 2) {
      setCustomerSearchResults([]);
      setCustomerSearchLoading(false);
      return;
    }
    setCustomerSearchLoading(true);
    const handle = setTimeout(async () => {
      try {
        const rows = await searchCustomers(q);
        setCustomerSearchResults(Array.isArray(rows) ? rows.slice(0, 8) : []);
      } catch (e) {
        console.warn("customer search failed:", e.message);
        setCustomerSearchResults([]);
      } finally {
        setCustomerSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [customerName]);

  const pickCustomerFromSearch = (apiCustomer) => {
    setCustomerName(apiCustomer.name);
    setCustomerSearchOpen(false);
    if (apiCustomer.type === "Member") {
      setMembers((prev) => {
        if (prev.some((m) => m.name.toLowerCase() === apiCustomer.name.toLowerCase())) return prev;
        return [
          ...prev,
          {
            id: apiCustomer.id,
            name: apiCustomer.name,
            wa: apiCustomer.phone,
            tier: apiCustomer.member_tier || "Silver",
            quotaKg: apiCustomer.remaining_quota_kg ?? 0,
            remainingKg: apiCustomer.remaining_quota_kg ?? 0,
            expiry: apiCustomer.quota_expiry_date
              ? new Date(apiCustomer.quota_expiry_date).toLocaleDateString("id-ID")
              : "—",
            source: "umum",
          },
        ];
      });
    } else {
      setRegularCustomers((prev) => {
        if (prev.some((c) => c.name.toLowerCase() === apiCustomer.name.toLowerCase())) return prev;
        return [
          ...prev,
          {
            id: apiCustomer.id,
            name: apiCustomer.name,
            wa: apiCustomer.phone,
            address: apiCustomer.address || "",
          },
        ];
      });
    }
    toast.success(`Pelanggan dipilih: ${apiCustomer.name}`);
  };

  return (
    <div
      className="relative min-h-screen text-white font-body max-w-md mx-auto md:border-x md:border-white/5"
      data-testid="pos-screen"
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 glass-strong border-b border-white/10 px-3 py-3 flex items-center justify-between gap-2"
        data-testid="pos-header"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#FFD700] flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.4)] flex-shrink-0">
            <Shirt size={18} className="text-black" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div
              className="font-heading font-extrabold text-[#FFD700] text-base leading-none tracking-tight truncate"
              data-testid="header-title"
            >
              LaundryMax
            </div>
            <div className="text-white/50 text-[10px] uppercase tracking-[0.15em] mt-0.5">
              Cashier
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-shrink overflow-hidden">
          <HeaderNav />
        </div>
      </header>

      <main className="px-5 pt-4 pb-44 space-y-4">
        {/* Customer + Source */}
        <section className="animate-fade-up space-y-3" style={{ animationDelay: "60ms" }}>
          <CustomerSelection
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerSearchOpen={customerSearchOpen}
            setCustomerSearchOpen={setCustomerSearchOpen}
            customerSearchLoading={customerSearchLoading}
            customerSearchResults={customerSearchResults}
            pickCustomerFromSearch={pickCustomerFromSearch}
            activeMember={activeMember}
            customerProfile={customerProfile}
            onOpenRegisterMember={() => {
              setRegName(customerName || "");
              setRegisterOpen(true);
            }}
            onOpenRegisterRegular={() => {
              setRegCustName(customerName || "");
              setRegCustWa("");
              setRegCustAddress("");
              setRegCustOpen(true);
            }}
          />

          <OrderSource
            sumberOrder={sumberOrder}
            setSumberOrder={setSumberOrder}
            isMember={isMember}
            minKg={minKg}
            selectedSource={selectedSource}
          />
        </section>

        {/* Durasi Pengerjaan — service speed selector. Applies to Kiloan,
            Satuan & Sepatu. Showcase items keep flat retail price. */}
        <section
          className="animate-fade-up space-y-2"
          style={{ animationDelay: "100ms" }}
          data-testid="speed-tier-section"
        >
          <div className="flex items-center justify-between">
            <label className="text-white/50 text-xs uppercase tracking-widest font-medium">
              Durasi Pengerjaan
            </label>
            <span className="text-white/30 text-[10px] uppercase tracking-widest">
              Wajib pilih
            </span>
          </div>
          <div
            className="glass rounded-2xl p-1.5 grid grid-cols-3 gap-1"
            role="radiogroup"
            aria-label="Pilih durasi pengerjaan"
          >
            {SPEED_TIERS.map((tier) => {
              const Icon =
                tier.id === "reguler" ? Timer : tier.id === "flash" ? Zap : Hourglass;
              const active = speedTier === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSpeedTier(tier.id)}
                  data-testid={`speed-tier-${tier.id}`}
                  className={`relative h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-[0.97] ${
                    active
                      ? "text-black font-extrabold shadow-[0_4px_18px_rgba(0,0,0,0.4)]"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                  style={
                    active
                      ? {
                          backgroundColor: tier.accent,
                          boxShadow: `0 0 20px ${tier.accent}55`,
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-1.5">
                    <Icon size={14} strokeWidth={2.5} />
                    <span className="font-heading text-sm tracking-tight">
                      {tier.label}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] tracking-wider ${
                      active ? "text-black/70" : "text-white/40"
                    }`}
                  >
                    {tier.sub}
                    {tier.multiplier > 1 ? ` · ×${tier.multiplier}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <div
            className="text-white/40 text-[11px]"
            data-testid="speed-tier-hint"
          >
            {speedTier === "reguler"
              ? "Tarif standar — selesai dalam 3 hari kerja."
              : speedTier === "flash"
                ? "Prioritas Flash — selesai dalam 1 hari (Satuan & Sepatu ×1.5)."
                : "Express kilat — selesai dalam 5 jam (Satuan & Sepatu ×2.0)."}{" "}
            Tarif Showcase tidak terpengaruh.
          </div>
        </section>

        <ServiceTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          kiloanKg={kiloanKg}
          kiloanInput={kiloanInput}
          kiloanRate={kiloanRate}
          minKg={minKg}
          speedTierDef={speedTierDef}
          speedMultiplier={speedMultiplier}
          handleKiloanIncrement={handleKiloanIncrement}
          handleKiloanDecrement={handleKiloanDecrement}
          handleKiloanInputChange={handleKiloanInputChange}
          handleKiloanInputBlur={handleKiloanInputBlur}
          showKiloanDetail={showKiloanDetail}
          setShowKiloanDetail={setShowKiloanDetail}
          kiloanDetail={kiloanDetail}
          bumpKiloanDetail={bumpCount(setKiloanDetail)}
          satuanCounts={satuanCounts}
          bumpSatuan={bumpCount(setSatuanCounts)}
          sepatuCounts={sepatuCounts}
          bumpSepatu={bumpCount(setSepatuCounts)}
          showcaseCounts={showcaseCounts}
          bumpShowcase={bumpCount(setShowcaseCounts)}
          usingMembership={usingMembership}
          activeMember={activeMember}
          memberRemainingAfter={memberRemainingAfter}
        />

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
                  className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group bg-black"
                  data-testid={`evidence-thumb-${idx}`}
                >
                  {p.dataUrl ? (
                    <img
                      src={p.dataUrl}
                      alt={`Bukti ${idx + 1}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/70">
                      <Camera size={18} />
                    </div>
                  )}
                  <div className="absolute bottom-1 left-1 text-[9px] font-mono text-white/90 font-bold bg-black/60 px-1 rounded">
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
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-[#7DF08F]/40 flex items-center justify-center flex-shrink-0 bg-black">
                    {paymentProof.dataUrl ? (
                      <img
                        src={paymentProof.dataUrl}
                        alt="Bukti bayar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Receipt size={24} className="text-[#7DF08F]" />
                    )}
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
      <CartSummary
        total={total}
        totalItemsCount={totalItemsCount}
        usingMembership={usingMembership}
        isMember={isMember}
        subtotal={subtotal}
        discount={discount}
        saveBlockedReason={saveBlockedReason}
        onSave={handleSave}
      />

      {/* Evidence photo capture — live camera */}
      <CameraCapture
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        onCapture={handleEvidenceCaptured}
        facing="environment"
        title="Foto Bukti Cucian"
        helper="Ambil foto keadaan cucian saat terima"
        ctaLabel="Simpan Foto"
      />

      {/* Payment proof capture — live camera */}
      <CameraCapture
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onCapture={handlePaymentCaptured}
        facing="environment"
        title="Foto Bukti Bayar"
        helper="Ambil foto struk / uang diterima"
        ctaLabel="Simpan Bukti Bayar"
      />

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
        printPayload={printPayload}
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
