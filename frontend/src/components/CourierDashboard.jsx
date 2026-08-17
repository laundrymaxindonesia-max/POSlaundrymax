import { useState, useRef, useEffect } from "react";
import {
  Camera,
  ScanLine,
  Truck,
  Bike,
  MapPin,
  Phone,
  CheckCircle2,
  Package,
  X,
  User as UserIcon,
  Clock,
  Wallet,
  Receipt,
  PackageCheck,
  MessageCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import HeaderNav from "@/components/HeaderNav";
import CameraCapture from "@/components/CameraCapture";
import {
  getPendingOrders,
  removePendingOrder,
  subscribePendingOrders,
} from "@/lib/orderStore";
import {
  fetchOrders,
  fetchOrderById,
  fetchReceiptSettings,
  patchOrderStatus,
  uploadPod,
  parseQrPayload,
} from "@/lib/api";
import { getActorTag, getCurrentStaff } from "@/lib/staffSession";
import { printReceipt } from "@/lib/receiptPrinter";
import QrScanner from "@/components/QrScanner";
import { Printer as PrinterIcon, FileText, ClipboardList, Tag } from "lucide-react";

function mapBackendOrder(o) {
  const eta = Math.max(3, Math.min(30, Math.round((o.weight_kg || 3) * 2))) + " menit";
  const itemsDesc = o.items_detail
    ? o.items_detail
    : `${o.weight_kg?.toFixed?.(1) || o.weight_kg} kg · ${o.source}`;
  return {
    id: o.order_id,
    customer: o.customer_name,
    address: o.customer_address || "—",
    phone: o.customer_phone,
    eta,
    items: itemsDesc,
    total:
      "Rp " +
      (Number(o.total_price) || 0).toLocaleString("id-ID").replace(/,/g, "."),
    paymentStatus: o.payment_status === "Lunas" ? "lunas" : "nanti",
    _raw: o,
  };
}

/** Build a receiptPrinter-compatible payload from a Courier order row.
 *  Uses `_raw` (backend record) when available to pull speedTier + subtotal;
 *  falls back to string-total for offline-cached rows. */
function buildCourierPrintPayload(order) {
  const raw = order._raw || {};
  const detail = raw.items_detail || order.items || "";
  const speed = /express/i.test(detail)
    ? "express"
    : /flash/i.test(detail)
      ? "flash"
      : "reguler";
  const totalNum =
    Number(raw.total_price) ||
    Number(String(order.total || "").replace(/[^\d]/g, "")) ||
    0;
  return {
    id: order.id,
    customer: order.customer,
    phone: order.phone,
    dateLabel: new Date().toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    speedTier: speed,
    serviceLabel: detail || "-",
    items_detail: detail,
    weight_kg: raw.weight_kg || undefined,
    notes: raw.notes || "",
    qrPayload: order.id,
    paymentStatus: order.paymentStatus,
    bagIndex: 1,
    bagTotal: 1,
    items: [{ name: detail || "Cucian", qty: raw.weight_kg ? `${raw.weight_kg} kg` : "1", subtotal: totalNum }],
    subtotal: totalNum,
    discount: 0,
    total: totalNum,
  };
}

export default function CourierDashboard() {
  const [activeTab, setActiveTab] = useState("pickup");
  const [manifest, setManifest] = useState([]);
  const [readyOrders, setReadyOrders] = useState([]);
  const [onMotorOrders, setOnMotorOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentStaff = getCurrentStaff();

  // Pickup / motor-load scanner (reused)
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMode, setScanMode] = useState("pickup"); // pickup | motor
  const scanTimerRef = useRef(null);

  // Delivery proof-of-delivery
  const [podOpen, setPodOpen] = useState(false);
  const [podOrder, setPodOrder] = useState(null);
  const [podCaptured, setPodCaptured] = useState(false);
  const [podPaymentCaptured, setPodPaymentCaptured] = useState(false);
  const [podSubmitting, setPodSubmitting] = useState(false);

  // Reprint receipt (mini-modal, shared between ready & on-motor cards)
  const [receiptSettings, setReceiptSettings] = useState(null);
  const [reprintOrder, setReprintOrder] = useState(null);
  useEffect(() => {
    fetchReceiptSettings().then(setReceiptSettings);
  }, []);
  // Which live-camera panel is currently open (null when the outer PoD dialog
  // is showing the two "step" buttons).
  const [activeCameraKind, setActiveCameraKind] = useState(null);
  const podDeliveryBlobRef = useRef(null);
  const podPaymentBlobRef = useRef(null);
  const podDeliveryCoordsRef = useRef(null);
  const [podDeliveryPreview, setPodDeliveryPreview] = useState(null);
  const [podPaymentPreview, setPodPaymentPreview] = useState(null);

  useEffect(() => {
    return () => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, []);

  const loadCourierData = async () => {
    setLoading(true);
    try {
      const [packing, otw] = await Promise.all([
        fetchOrders({ status: "Packing", limit: 100 }),
        fetchOrders({ status: "OTW", limit: 100 }),
      ]);
      setReadyOrders((packing || []).map(mapBackendOrder));
      setOnMotorOrders((otw || []).map(mapBackendOrder));
    } catch (e) {
      toast.error(`Gagal memuat order: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourierData();
  }, []);

  // Sync orders optimistically pushed from Cashier (Anter Jemput) — keep
  // client-side cache for offline-first UX even when backend is temporarily slow
  useEffect(() => {
    const sync = () => {
      const stored = getPendingOrders();
      if (stored.length === 0) return;
      setReadyOrders((prev) => {
        const existing = new Set(prev.map((o) => o.id));
        const fresh = stored.filter((o) => !existing.has(o.id));
        if (fresh.length === 0) return prev;
        return [...fresh, ...prev];
      });
    };
    sync();
    return subscribePendingOrders(sync);
  }, []);

  const handleScanPickup = () => {
    setScanMode("pickup");
    setScanOpen(true);
  };

  const handleScanMotorLoad = () => {
    if (readyOrders.length === 0) {
      toast.error("Tidak ada order menunggu di outlet");
      return;
    }
    setScanMode("motor");
    setScanOpen(true);
  };

  const busyRef = useRef(false);

  const handleQrDecoded = async (decoded) => {
    if (busyRef.current) return;
    const orderId = parseQrPayload(decoded);
    if (!orderId) {
      toast.error("QR tidak dikenali");
      return;
    }
    busyRef.current = true;

    if (scanMode === "pickup") {
      // JEMPUT — add scanned bag to the courier manifest live from DB
      try {
        const order = await fetchOrderById(orderId);
        setManifest((prev) => {
          if (prev.some((m) => m.id === order.order_id)) return prev;
          return [
            {
              id: order.order_id,
              customer: order.customer_name || "-",
              weight: order.weight_kg ? `${order.weight_kg.toFixed(1)} kg` : "-",
              time: new Date().toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
            ...prev,
          ];
        });
        toast.success(`Bag ${order.order_id} masuk manifest`);
      } catch (e) {
        if (e.status === 404) {
          toast.error(`Order ${orderId} tidak ditemukan di database`);
        } else {
          toast.error(`Gagal memuat order: ${e.message}`);
        }
      } finally {
        setScanOpen(false);
        setTimeout(() => (busyRef.current = false), 700);
      }
      return;
    }

    // ANTAR — flip ready-order to OTW
    try {
      const target = readyOrders.find((o) => o.id === orderId);
      if (!target) {
        toast.error(`Bag ${orderId} bukan di daftar Menunggu di Outlet`);
        return;
      }
      const actor = getActorTag() || "kurir";
      await patchOrderStatus(orderId, "OTW", actor);
      setReadyOrders((prev) => prev.filter((o) => o.id !== orderId));
      setOnMotorOrders((prev) =>
        prev.some((m) => m.id === orderId) ? prev : [target, ...prev]
      );
      toast.success(`Order ${orderId} masuk motor`, {
        description: `Status: Sedang Diantar · oleh ${currentStaff?.name || "kurir"}`,
      });
      setScanOpen(false);
    } catch (e) {
      toast.error(`Gagal update status: ${e.message}`);
    } finally {
      setTimeout(() => (busyRef.current = false), 700);
    }
  };

  const handleCloseScan = (open) => {
    if (!open && scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    setScanOpen(open);
  };

  const handleAngkutSemua = () => {
    if (manifest.length === 0) {
      toast.error("Manifest kosong");
      return;
    }
    toast.success(`${manifest.length} bag berhasil diangkut`, {
      description: "Menuju gudang produksi...",
    });
    setManifest([]);
  };

  const openPoD = (order) => {
    setPodOrder(order);
    setPodCaptured(false);
    setPodPaymentCaptured(false);
    setActiveCameraKind(null);
    setPodDeliveryPreview(null);
    setPodPaymentPreview(null);
    podDeliveryBlobRef.current = null;
    podPaymentBlobRef.current = null;
    podDeliveryCoordsRef.current = null;
    setPodOpen(true);
  };

  const capturePhoto = (kind) => {
    setActiveCameraKind(kind);
  };

  const handleCameraCapture = async ({ blob, dataUrl, coords }) => {
    if (activeCameraKind === "delivery") {
      podDeliveryBlobRef.current = blob;
      podDeliveryCoordsRef.current = coords || null;
      setPodDeliveryPreview(dataUrl);
      setPodCaptured(true);
    } else if (activeCameraKind === "payment") {
      podPaymentBlobRef.current = blob;
      setPodPaymentPreview(dataUrl);
      setPodPaymentCaptured(true);
    }
    setActiveCameraKind(null);
  };

  const podPaymentRequired = podOrder?.paymentStatus === "nanti";
  const podReady = podCaptured && (!podPaymentRequired || podPaymentCaptured);

  const confirmDelivery = async () => {
    if (!podReady || !podOrder || podSubmitting) return;
    setPodSubmitting(true);
    try {
      const actor = getActorTag();
      const deliveryBlob = podDeliveryBlobRef.current;
      const coords = podDeliveryCoordsRef.current;
      if (deliveryBlob) {
        const file = new File([deliveryBlob], `pod_${podOrder.id}.jpg`, {
          type: "image/jpeg",
        });
        await uploadPod(podOrder.id, {
          actor,
          kind: "delivery",
          photo: file,
          lat: coords?.lat,
          lng: coords?.lng,
        });
      }
      if (podPaymentRequired && podPaymentBlobRef.current) {
        const payFile = new File(
          [podPaymentBlobRef.current],
          `pay_${podOrder.id}.jpg`,
          { type: "image/jpeg" }
        );
        await uploadPod(podOrder.id, { actor, kind: "payment", photo: payFile });
      }
      await patchOrderStatus(podOrder.id, "Selesai", actor);

      setOnMotorOrders((prev) => prev.filter((d) => d.id !== podOrder.id));
      removePendingOrder(podOrder.id);
      toast.success("Order Selesai Diantar!", {
        description: `${podOrder.id} · ${podOrder.customer}`,
      });
      setPodOpen(false);
      setPodOrder(null);
      setPodCaptured(false);
      setPodPaymentCaptured(false);
      setActiveCameraKind(null);
      setPodDeliveryPreview(null);
      setPodPaymentPreview(null);
      podDeliveryBlobRef.current = null;
      podPaymentBlobRef.current = null;
      podDeliveryCoordsRef.current = null;
    } catch (e) {
      toast.error(`Gagal konfirmasi pengiriman: ${e.message}`);
    } finally {
      setPodSubmitting(false);
    }
  };

  const handleClosePod = (open) => {
    if (!open) {
      setPodOrder(null);
      setPodCaptured(false);
      setPodPaymentCaptured(false);
      setActiveCameraKind(null);
      setPodDeliveryPreview(null);
      setPodPaymentPreview(null);
    }
    setPodOpen(open);
  };

  return (
    <div
      className="relative min-h-screen text-white font-body max-w-md mx-auto md:border-x md:border-white/5"
      data-testid="courier-screen"
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 glass-strong border-b border-white/10 px-4 py-3 flex items-center justify-between gap-2"
        data-testid="courier-header"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFD700] flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.35)]">
            <Truck size={18} className="text-black" strokeWidth={2.5} />
          </div>
          <div>
            <div
              className="font-heading font-extrabold text-[#FFD700] text-base leading-none tracking-tight"
              data-testid="courier-title"
            >
              LaundryMax
            </div>
            <div className="text-white/50 text-[10px] uppercase tracking-[0.15em] mt-0.5">
              Courier
            </div>
          </div>
        </div>
        <HeaderNav />
      </header>

      <main
        className={`px-4 pt-5 space-y-5 ${
          activeTab === "pickup" ? "pb-40" : "pb-8"
        }`}
      >
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList
            className="w-full h-auto p-1.5 glass rounded-2xl grid grid-cols-2 gap-1"
            data-testid="courier-tabs-list"
          >
            <TabsTrigger
              value="pickup"
              data-testid="tab-pickup"
              className="flex items-center justify-center gap-2 py-3.5 px-2 rounded-xl text-white/60 text-sm font-heading font-bold data-[state=active]:bg-[#FFD700] data-[state=active]:text-black data-[state=active]:shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all"
            >
              <Truck size={18} strokeWidth={2.5} />
              <span>JEMPUT</span>
            </TabsTrigger>
            <TabsTrigger
              value="delivery"
              data-testid="tab-delivery"
              className="flex items-center justify-center gap-2 py-3.5 px-2 rounded-xl text-white/60 text-sm font-heading font-bold data-[state=active]:bg-[#FFD700] data-[state=active]:text-black data-[state=active]:shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all"
            >
              <Bike size={18} strokeWidth={2.5} />
              <span>ANTAREUN</span>
            </TabsTrigger>
          </TabsList>

          {/* ============= PICKUP TAB ============= */}
          <TabsContent value="pickup" className="mt-5 space-y-5">
            {/* Massive scan button */}
            <button
              onClick={handleScanPickup}
              data-testid="scan-pickup-button"
              className="w-full rounded-3xl border-2 border-dashed border-[#FFD700]/50 bg-[#FFD700]/5 hover:bg-[#FFD700]/15 hover:border-[#FFD700] transition-all active:scale-[0.98] p-8 flex flex-col items-center gap-4 pulse-yellow animate-fade-up"
            >
              <div className="w-20 h-20 rounded-full bg-[#FFD700]/20 border border-[#FFD700]/40 flex items-center justify-center">
                <Camera
                  size={38}
                  strokeWidth={2.25}
                  className="text-[#FFD700]"
                />
              </div>
              <div className="text-center">
                <div className="font-heading font-black text-[#FFD700] text-xl tracking-tight">
                  SCAN BARANG PICKUP
                </div>
                <div className="text-[#FFD700]/70 text-[11px] uppercase tracking-widest font-medium mt-1.5">
                  Scan QR tag setiap bag
                </div>
              </div>
            </button>

            {/* Manifest Angkutan */}
            <section className="animate-fade-up" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading font-bold text-white text-lg tracking-tight">
                  Manifest Angkutan
                </h2>
                <div
                  className="px-2.5 py-1 rounded-full bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700] text-[10px] font-heading font-bold uppercase tracking-widest"
                  data-testid="manifest-count-badge"
                >
                  {manifest.length} Bags
                </div>
              </div>

              {manifest.length === 0 ? (
                <div
                  className="glass rounded-2xl p-8 flex flex-col items-center gap-2 text-white/40 text-sm"
                  data-testid="manifest-empty"
                >
                  <Package size={32} strokeWidth={1.5} />
                  <span>Belum ada bag yang discan</span>
                </div>
              ) : (
                <div className="space-y-2" data-testid="manifest-list">
                  {manifest.map((bag, idx) => (
                    <div
                      key={`${bag.id}-${idx}`}
                      data-testid={`manifest-row-${bag.id}`}
                      className="glass rounded-2xl p-4 flex items-center justify-between animate-fade-up"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/25 flex items-center justify-center flex-shrink-0">
                          <Package
                            size={16}
                            className="text-[#FFD700]"
                            strokeWidth={2.25}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-heading font-bold text-white text-sm tracking-tight">
                            {bag.id}
                          </div>
                          <div className="text-white/40 text-[11px]">
                            {bag.customer} · {bag.time}
                          </div>
                        </div>
                      </div>
                      <span className="font-heading font-bold text-[#FFD700] text-sm">
                        {bag.weight}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          {/* ============= DELIVERY TAB ============= */}
          <TabsContent value="delivery" className="mt-5 space-y-5">
            {/* Massive scan-to-motor button */}
            <button
              onClick={handleScanMotorLoad}
              disabled={readyOrders.length === 0}
              data-testid="scan-motor-button"
              className={`w-full rounded-3xl border-2 border-dashed transition-all active:scale-[0.98] p-6 flex flex-col items-center gap-3 animate-fade-up ${
                readyOrders.length === 0
                  ? "border-white/10 bg-white/[0.02] text-white/30 cursor-not-allowed"
                  : "border-[#FFD700]/50 bg-[#FFD700]/5 hover:bg-[#FFD700]/15 hover:border-[#FFD700] text-[#FFD700] pulse-yellow"
              }`}
            >
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  readyOrders.length === 0
                    ? "bg-white/5"
                    : "bg-[#FFD700]/20 border border-[#FFD700]/40"
                }`}
              >
                <PackageCheck size={30} strokeWidth={2.25} />
              </div>
              <div className="text-center">
                <div className="font-heading font-black text-lg tracking-tight">
                  SCAN BARANG MASUK MOTOR
                </div>
                <div
                  className={`text-[10px] uppercase tracking-widest font-medium mt-1 ${
                    readyOrders.length === 0 ? "text-white/30" : "text-[#FFD700]/70"
                  }`}
                >
                  {readyOrders.length === 0
                    ? "Semua order sudah dimuat"
                    : `${readyOrders.length} order menunggu dimuat`}
                </div>
              </div>
            </button>

            {/* SECTION 1: Menunggu di Outlet */}
            <section
              className="animate-fade-up"
              style={{ animationDelay: "100ms" }}
              data-testid="section-ready"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-5 rounded-full bg-[#FFD700]" />
                  <h2 className="font-heading font-bold text-white text-base tracking-tight">
                    Menunggu di Outlet
                  </h2>
                </div>
                <div
                  className="px-2.5 py-1 rounded-full bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700] text-[10px] font-heading font-bold uppercase tracking-widest"
                  data-testid="ready-count-badge"
                >
                  {readyOrders.length} Order
                </div>
              </div>

              {readyOrders.length === 0 ? (
                <div
                  className="glass rounded-2xl p-6 flex flex-col items-center gap-2 text-white/40 text-xs"
                  data-testid="ready-empty"
                >
                  <Package size={24} strokeWidth={1.5} />
                  <span>Outlet kosong — scan order yang siap</span>
                </div>
              ) : (
                <div className="space-y-2" data-testid="ready-list">
                  {readyOrders.map((order, idx) => (
                    <div
                      key={order.id}
                      data-testid={`ready-card-${order.id}`}
                      className="glass rounded-2xl p-3 flex items-center justify-between gap-3 animate-fade-up"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/25 flex items-center justify-center flex-shrink-0">
                          <Package
                            size={16}
                            className="text-[#FFD700]"
                            strokeWidth={2.25}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-heading font-bold text-white text-sm tracking-tight">
                              {order.id}
                            </span>
                            <span
                              className={`px-1.5 py-0 rounded text-[8px] font-heading font-bold uppercase tracking-wider border ${
                                order.paymentStatus === "lunas"
                                  ? "bg-[#7DF08F]/15 text-[#B4F5BF] border-[#7DF08F]/30"
                                  : "bg-[#FF8A3D]/15 text-[#FFB98C] border-[#FF8A3D]/30"
                              }`}
                            >
                              {order.paymentStatus === "lunas" ? "Lunas" : "Nanti"}
                            </span>
                          </div>
                          <div className="text-white/60 text-xs mt-0.5 truncate font-medium">
                            {order.customer}
                          </div>
                          <div className="text-white/40 text-[10px] truncate">
                            {order.items}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <div className="font-mono text-[#FFD700] text-xs font-heading font-bold">
                          {order.total}
                        </div>
                        <div className="text-white/30 text-[9px] uppercase tracking-wider">
                          {order.eta}
                        </div>
                        <button
                          onClick={() => setReprintOrder(order)}
                          data-testid={`reprint-ready-${order.id}`}
                          title="Cetak ulang nota"
                          className="mt-0.5 h-7 px-2 rounded-lg bg-white/5 border border-white/10 hover:border-[#FFD700]/40 hover:bg-[#FFD700]/10 text-white/70 hover:text-[#FFD700] flex items-center gap-1 transition-colors"
                        >
                          <PrinterIcon size={11} strokeWidth={2.25} />
                          <span className="text-[9px] font-heading font-bold tracking-wider uppercase">Cetak</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* SECTION 2: Di Atas Motor */}
            <section
              className="animate-fade-up"
              style={{ animationDelay: "180ms" }}
              data-testid="section-on-motor"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-5 rounded-full bg-[#7DF08F]" />
                  <h2 className="font-heading font-bold text-white text-base tracking-tight">
                    Di Atas Motor
                  </h2>
                  <span className="text-white/40 text-[10px] uppercase tracking-widest">
                    Sedang Diantar
                  </span>
                </div>
                <div
                  className="px-2.5 py-1 rounded-full bg-[#7DF08F]/15 border border-[#7DF08F]/30 text-[#B4F5BF] text-[10px] font-heading font-bold uppercase tracking-widest"
                  data-testid="motor-count-badge"
                >
                  {onMotorOrders.length} Order
                </div>
              </div>

              {onMotorOrders.length === 0 ? (
                <div
                  className="glass rounded-2xl p-8 flex flex-col items-center gap-2 text-white/40 text-xs"
                  data-testid="motor-empty"
                >
                  <Bike size={28} strokeWidth={1.5} />
                  <span className="text-white/50 font-heading font-bold text-sm">
                    Motor kosong
                  </span>
                  <span>Scan order untuk mulai pengantaran</span>
                </div>
              ) : (
                <div className="space-y-3" data-testid="motor-list">
                  {onMotorOrders.map((order, idx) => (
                    <div
                      key={order.id}
                      data-testid={`motor-card-${order.id}`}
                      className="glass rounded-2xl p-4 space-y-3 animate-fade-up border-white/10"
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-heading font-extrabold text-white text-base tracking-tight">
                              {order.id}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-[#7DF08F]/15 border border-[#7DF08F]/30 text-[#B4F5BF] text-[9px] font-heading font-bold uppercase tracking-widest">
                              Sedang Diantar
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-heading font-bold uppercase tracking-widest border ${
                                order.paymentStatus === "lunas"
                                  ? "bg-[#7DF08F]/15 text-[#B4F5BF] border-[#7DF08F]/30"
                                  : "bg-[#FF8A3D]/15 text-[#FFB98C] border-[#FF8A3D]/30"
                              }`}
                              data-testid={`motor-payment-${order.id}`}
                            >
                              {order.paymentStatus === "lunas" ? (
                                <>
                                  <Wallet size={9} className="inline mr-0.5 -mt-0.5" />
                                  Lunas
                                </>
                              ) : (
                                <>
                                  <Clock size={9} className="inline mr-0.5 -mt-0.5" />
                                  Bayar Nanti
                                </>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-white/80 text-sm mt-1.5 font-medium">
                            <UserIcon size={13} className="text-[#FFD700]" />
                            {order.customer}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-1 text-[#FFD700] text-xs font-heading font-bold">
                            <Clock size={12} />
                            {order.eta}
                          </div>
                          <div className="text-white/40 text-[10px] mt-0.5">
                            {order.items}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-start gap-2 text-white/60">
                          <MapPin size={13} className="mt-0.5 flex-shrink-0 text-white/40" />
                          <span className="leading-snug">{order.address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/60">
                          <Phone size={13} className="text-white/40" />
                          <span>{order.phone}</span>
                        </div>
                        {order.paymentStatus === "nanti" && (
                          <div className="flex items-center gap-2 text-[#FFB98C] text-[11px] font-medium">
                            <Receipt size={12} />
                            <span>Wajib tagih + foto bukti bayar saat serah terima</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
                        <button
                          onClick={() => setReprintOrder(order)}
                          data-testid={`reprint-motor-${order.id}`}
                          title="Cetak ulang nota"
                          className="h-12 w-12 rounded-xl border border-white/10 bg-white/5 hover:border-[#FFD700]/40 hover:bg-[#FFD700]/10 text-white/70 hover:text-[#FFD700] flex items-center justify-center transition-all active:scale-[0.97]"
                        >
                          <PrinterIcon size={16} strokeWidth={2.25} />
                        </button>
                        <button
                          onClick={() => {
                            const phone = (order.phone || "").replace(/\D/g, "");
                            const msg = `Halo ${order.customer}, kurir LaundryMax sedang OTW ke ${order.address}. Mohon disiapkan tanda terimanya ya!`;
                            window.open(
                              `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
                              "_blank",
                              "noopener"
                            );
                          }}
                          data-testid={`chat-wa-button-${order.id}`}
                          className="h-12 rounded-xl border-2 border-[#25D366]/40 bg-[#25D366]/10 hover:bg-[#25D366]/20 hover:border-[#25D366]/70 text-[#25D366] font-heading font-extrabold text-xs tracking-wide flex items-center justify-center gap-1.5 transition-all active:scale-[0.97]"
                        >
                          <MessageCircle size={15} strokeWidth={2.5} />
                          CHAT WA
                        </button>
                        <button
                          onClick={() => openPoD(order)}
                          data-testid={`pod-button-${order.id}`}
                          className="h-12 rounded-xl bg-[#FFD700] text-black font-heading font-extrabold text-xs tracking-wide flex items-center justify-center gap-1.5 hover:bg-[#ffdf33] transition-all active:scale-[0.97] shadow-[0_6px_20px_rgba(255,215,0,0.25)]"
                        >
                          <CheckCircle2 size={15} strokeWidth={2.5} />
                          DITERIMA
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </main>

      {/* Sticky bottom bar — only for pickup tab */}
      {activeTab === "pickup" && (
        <div
          className="fixed bottom-0 inset-x-0 max-w-md mx-auto z-40 glass-strong border-t border-white/10 rounded-t-3xl px-4 pt-4 pb-5 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
          data-testid="pickup-sticky-bar"
        >
          <button
            onClick={handleAngkutSemua}
            disabled={manifest.length === 0}
            data-testid="angkut-semua-button"
            className="w-full h-14 rounded-2xl bg-[#FFD700] text-black font-heading font-extrabold text-base tracking-wide flex items-center justify-center gap-2.5 transition-all active:scale-[0.97] hover:bg-[#ffdf33] disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_8px_30px_rgba(255,215,0,0.3)]"
          >
            <Truck size={20} strokeWidth={2.5} />
            ANGKUT SEMUA ({manifest.length} BAGS)
          </button>
        </div>
      )}

      {/* Real QR Scanner — shared between JEMPUT (pickup) & ANTAR (motor) */}
      <QrScanner
        open={scanOpen}
        onOpenChange={handleCloseScan}
        onScan={handleQrDecoded}
        title={scanMode === "motor" ? "Scan Barang Masuk Motor" : "Scan Bag Pickup"}
        helper={
          scanMode === "motor"
            ? "Sorot QR code pada bag siap antar (status Packing)"
            : "Sorot QR code pada bag jemputan pelanggan"
        }
      />

      {/* Proof of Delivery Modal */}
      <Dialog open={podOpen} onOpenChange={handleClosePod}>
        <DialogContent
          className="bg-[#111111] border-white/10 text-white max-w-sm rounded-3xl"
          data-testid="pod-modal"
        >
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-[#FFD700]">
              Bukti Terima
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              {podOrder
                ? `${podOrder.id} · ${podOrder.customer}`
                : "Ambil foto bukti serah terima ke pelanggan."}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Delivery photo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-xs font-heading font-bold uppercase tracking-widest flex items-center gap-1.5">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    podCaptured
                      ? "bg-[#FFD700] text-black"
                      : "bg-white/10 text-white/60 border border-white/15"
                  }`}
                >
                  1
                </span>
                Foto Serah Terima
              </span>
              {podCaptured && (
                <span className="text-[#FFD700] text-[10px] font-heading font-bold uppercase tracking-widest">
                  ✓ Tersimpan
                </span>
              )}
            </div>
            <button
              onClick={() => capturePhoto("delivery")}
              disabled={podCaptured}
              data-testid="pod-capture-delivery"
              className={`w-full aspect-[2/1] rounded-2xl border-2 border-dashed flex items-center justify-center gap-3 overflow-hidden transition-all active:scale-[0.98] ${
                podCaptured
                  ? "border-[#FFD700]/40 bg-[#FFD700]/10 text-[#FFD700] cursor-default"
                  : "border-[#FFD700]/50 bg-[#FFD700]/5 hover:bg-[#FFD700]/15 text-[#FFD700]"
              }`}
            >
              {podCaptured && podDeliveryPreview ? (
                <img
                  src={podDeliveryPreview}
                  alt="Bukti pengiriman"
                  className="w-full h-full object-cover"
                />
              ) : podCaptured ? (
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={28} strokeWidth={2} />
                  <div className="text-left">
                    <div className="font-heading font-bold text-sm">
                      Foto delivery tersimpan
                    </div>
                    <div className="text-[10px] text-white/50 font-mono">
                      pod_{podOrder?.id}.jpg
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <Camera size={24} strokeWidth={2.25} />
                  <span className="font-heading font-bold text-sm tracking-wide">
                    AMBIL FOTO BUKTI
                  </span>
                </div>
              )}
            </button>
          </div>

          {/* Step 2: Payment proof (only for bayar nanti) */}
          {podPaymentRequired && (
            <div className="space-y-2 mt-3" data-testid="pod-payment-section">
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-xs font-heading font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      podPaymentCaptured
                        ? "bg-[#7DF08F] text-black"
                        : "bg-white/10 text-white/60 border border-white/15"
                    }`}
                  >
                    2
                  </span>
                  Foto Bukti Bayar
                </span>
                {podPaymentCaptured ? (
                  <span className="text-[#7DF08F] text-[10px] font-heading font-bold uppercase tracking-widest">
                    ✓ Tersimpan
                  </span>
                ) : (
                  <span className="text-[#FFB98C] text-[10px] font-heading font-bold uppercase tracking-widest">
                    Wajib · Bayar Nanti
                  </span>
                )}
              </div>
              <button
                onClick={() => capturePhoto("payment")}
                disabled={!podCaptured || podPaymentCaptured}
                data-testid="pod-capture-payment"
                className={`w-full aspect-[2/1] rounded-2xl border-2 border-dashed flex items-center justify-center gap-3 overflow-hidden transition-all active:scale-[0.98] ${
                  podPaymentCaptured
                    ? "border-[#7DF08F]/40 bg-[#7DF08F]/10 text-[#7DF08F] cursor-default"
                    : !podCaptured
                    ? "border-white/10 bg-white/[0.02] text-white/30 cursor-not-allowed"
                    : "border-[#7DF08F]/50 bg-[#7DF08F]/5 hover:bg-[#7DF08F]/15 text-[#7DF08F]"
                }`}
              >
                {podPaymentCaptured && podPaymentPreview ? (
                  <img
                    src={podPaymentPreview}
                    alt="Bukti bayar"
                    className="w-full h-full object-cover"
                  />
                ) : podPaymentCaptured ? (
                  <div className="flex items-center gap-2.5">
                    <Receipt size={28} strokeWidth={2} />
                    <div className="text-left">
                      <div className="font-heading font-bold text-sm">
                        Bukti bayar tersimpan
                      </div>
                      <div className="text-[10px] text-white/50 font-mono">
                        {podOrder?.total}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <Receipt size={24} strokeWidth={2.25} />
                    <span className="font-heading font-bold text-sm tracking-wide">
                      {!podCaptured
                        ? "Selesaikan foto serah terima dulu"
                        : "FOTO BUKTI BAYAR"}
                    </span>
                  </div>
                )}
              </button>
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <button
              onClick={() => handleClosePod(false)}
              data-testid="pod-cancel-button"
              className="flex-1 h-12 rounded-xl bg-white/5 border border-white/10 text-white/80 font-medium hover:bg-white/10 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={confirmDelivery}
              disabled={!podReady}
              data-testid="pod-confirm-button"
              className="flex-1 h-12 rounded-xl bg-[#FFD700] text-black font-heading font-extrabold hover:bg-[#ffdf33] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
            >
              <CheckCircle2 size={16} /> Selesai
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reprint mini-modal — shared between ready-card & motor-card
          "Cetak" buttons. Offers the same 3 templates as POS. */}
      <Dialog
        open={reprintOrder !== null}
        onOpenChange={(o) => !o && setReprintOrder(null)}
      >
        <DialogContent
          className="bg-[#111111] border-white/10 text-white max-w-xs rounded-3xl"
          data-testid="reprint-modal"
        >
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-[#FFD700] text-lg flex items-center gap-2">
              <PrinterIcon size={18} /> Cetak Ulang Nota
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              {reprintOrder?.id} · {reprintOrder?.customer}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: "customer", label: "Nota Pelanggan", desc: "Detail + harga + QR", Icon: FileText },
              { id: "production", label: "Slip Produksi", desc: "Tanpa harga · fokus item", Icon: ClipboardList },
              { id: "bagtag", label: "Label Bag / Pack", desc: "Minimal · tempel di tas", Icon: Tag },
            ].map(({ id, label, desc, Icon }) => (
              <button
                key={id}
                onClick={() => {
                  const payload = buildCourierPrintPayload(reprintOrder);
                  const w = printReceipt(payload, id, receiptSettings);
                  if (!w) {
                    toast.error("Pop-up diblokir browser", {
                      description: "Izinkan pop-up untuk domain ini.",
                    });
                  } else {
                    toast.success(`Nota ${label} dicetak`);
                    setReprintOrder(null);
                  }
                }}
                data-testid={`reprint-model-${id}`}
                className="text-left rounded-xl border border-white/10 hover:border-[#FFD700]/40 bg-white/[0.03] hover:bg-[#FFD700]/[0.06] p-3 transition-all flex items-center gap-3 active:scale-[0.98]"
              >
                <div className="w-9 h-9 rounded-lg bg-[#FFD700]/15 border border-[#FFD700]/30 flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className="text-[#FFD700]" strokeWidth={2.25} />
                </div>
                <div className="min-w-0">
                  <div className="font-heading font-bold text-white text-sm">
                    {label}
                  </div>
                  <div className="text-white/40 text-[10px]">{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Live camera modal — reused for both delivery + payment photos.
          Delivery requires geotag; payment is a plain photo. */}
      <CameraCapture
        open={activeCameraKind !== null}
        onClose={() => setActiveCameraKind(null)}
        onCapture={handleCameraCapture}
        facing="environment"
        requireGeotag={activeCameraKind === "delivery"}
        title={
          activeCameraKind === "delivery"
            ? "Foto Bukti Serah Terima"
            : "Foto Bukti Bayar"
        }
        helper={
          activeCameraKind === "delivery"
            ? "Foto customer + paket · GPS akan terekam"
            : "Foto uang / struk transfer sebagai bukti"
        }
        ctaLabel={activeCameraKind === "delivery" ? "Simpan PoD" : "Simpan Bukti"}
      />
    </div>
  );
}
