import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User,
  Phone,
  MapPin,
  PackageCheck,
  Wallet,
  CheckCircle2,
  Clock,
  Loader2,
  Camera,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { markOrderPaid, patchOrderStatus, uploadPod } from "@/lib/api";
import { getActorTag } from "@/lib/staffSession";
import CameraCapture from "@/components/CameraCapture";

const STATUS_LABEL = {
  Antrian: "Dalam Antrean",
  Cuci: "Sedang Dicuci",
  Kering: "Sedang Dikeringkan",
  Setrika: "Antrean Setrika",
  Packing: "Sudah Disetrika · Siap Diambil",
  OTW: "Dalam Pengantaran",
  Selesai: "Sudah Diambil",
};

const STATUS_STYLE = {
  Antrian: "bg-white/10 text-white/70 border-white/20",
  Cuci: "bg-[#3DA5FF]/15 text-[#7FC1FF] border-[#3DA5FF]/30",
  Kering: "bg-[#FF8A3D]/15 text-[#FFB98C] border-[#FF8A3D]/30",
  Setrika: "bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/30",
  Packing: "bg-[#7DF08F]/15 text-[#B4F5BF] border-[#7DF08F]/30",
  OTW: "bg-[#B36BFF]/15 text-[#D8B4FF] border-[#B36BFF]/30",
  Selesai: "bg-white/10 text-white/70 border-white/20",
};

const READY_STATUSES = new Set(["Packing", "OTW"]);

const formatIDR = (n) =>
  "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID").replace(/,/g, ".");

/**
 * ScanOrderDetailModal — post-QR-scan detail sheet used at the POS.
 *
 * Two operator flows:
 *  (1) "Cucian Sudah Diambil" — flips order_status to Selesai when the order
 *      is Packing/OTW. Hidden for still-processing orders (Antrian/Cuci/…).
 *  (2) "Bayar Sekarang"       — opens CameraCapture for the payment proof
 *      photo. After the photo uploads to R2 the payment_status is flipped
 *      to Lunas server-side.
 *
 * Props
 * -----
 * order          the freshly-fetched Order document (or null while loading)
 * loading        boolean — show a spinner while we GET /api/orders/{id}
 * error          optional string — shown if the order lookup failed (404 etc)
 * onOpenChange   dialog dismiss handler
 * onOrderUpdated (updatedOrder) => void — parent updates its cache
 */
export default function ScanOrderDetailModal({
  open,
  onOpenChange,
  order,
  loading,
  error,
  onOrderUpdated,
}) {
  const [busy, setBusy] = useState(false);
  const [payCamOpen, setPayCamOpen] = useState(false);

  const handleMarkTaken = async () => {
    if (!order) return;
    setBusy(true);
    try {
      const updated = await patchOrderStatus(
        order.order_id,
        "Selesai",
        getActorTag() || "kasir"
      );
      toast.success(`${order.order_id} · Cucian sudah diambil pelanggan`);
      onOrderUpdated?.(updated);
    } catch (e) {
      toast.error("Gagal update status", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const handlePaymentCapture = async ({ blob, lat, lng }) => {
    if (!order) return;
    setPayCamOpen(false);
    setBusy(true);
    try {
      const photo = new File([blob], `payment-${order.order_id}.jpg`, {
        type: "image/jpeg",
      });
      await uploadPod(order.order_id, {
        actor: getActorTag() || "kasir",
        kind: "payment",
        photo,
        lat,
        lng,
      });
      const updated = await markOrderPaid(
        order.order_id,
        getActorTag() || "kasir"
      );
      toast.success(`${order.order_id} · Pembayaran tercatat LUNAS`);
      onOrderUpdated?.(updated);
    } catch (e) {
      toast.error("Gagal simpan bukti bayar", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const status = order?.order_status;
  const isReadyForPickup = status && READY_STATUSES.has(status);
  const isDone = status === "Selesai";
  const isProcessing = status && !isReadyForPickup && !isDone;
  const isUnpaid = order?.payment_status === "Nanti";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="bg-[#111111] border-white/10 text-white max-w-sm rounded-3xl"
          data-testid="scan-order-modal"
        >
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-[#FFD700] flex items-center gap-2">
              <PackageCheck size={18} />
              Detail Order
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              Hasil pindai QR nota pelanggan.
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div
              className="flex items-center justify-center gap-2 py-8 text-white/60"
              data-testid="scan-order-loading"
            >
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Memuat order dari server...</span>
            </div>
          )}

          {!loading && error && (
            <div
              className="rounded-xl border border-[#FF6B6B]/40 bg-[#FF6B6B]/10 p-4 flex items-start gap-2 text-[#FFB0B0] text-sm"
              data-testid="scan-order-error"
            >
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {!loading && !error && order && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white/50 text-[10px] uppercase tracking-widest">
                    No. Order
                  </div>
                  <div className="font-heading font-black text-white text-lg tracking-widest">
                    {order.order_id}
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-heading font-bold uppercase tracking-widest border ${STATUS_STYLE[status] || "border-white/10"}`}
                  data-testid="scan-order-status-badge"
                >
                  {STATUS_LABEL[status] || status}
                </span>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-white/80">
                  <User size={13} className="text-[#FFD700]" />
                  {order.customer_name || "-"}
                </div>
                {order.customer_phone && (
                  <div className="flex items-center gap-2 text-white/60 text-xs">
                    <Phone size={12} className="text-white/40" />
                    <span className="font-mono">{order.customer_phone}</span>
                  </div>
                )}
                {order.customer_address && (
                  <div className="flex items-start gap-2 text-white/60 text-xs">
                    <MapPin size={12} className="text-white/40 mt-0.5" />
                    <span>{order.customer_address}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-white/40 text-[10px] uppercase tracking-wider">
                    Total
                  </div>
                  <div className="font-heading font-black text-[#FFD700] text-lg mt-0.5">
                    {formatIDR(order.total_price)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-white/40 text-[10px] uppercase tracking-wider">
                    Pembayaran
                  </div>
                  <div
                    className={`font-heading font-bold text-sm mt-0.5 flex items-center gap-1 ${
                      order.payment_status === "Lunas"
                        ? "text-[#B4F5BF]"
                        : "text-[#FFB98C]"
                    }`}
                  >
                    {order.payment_status === "Lunas" ? (
                      <>
                        <Wallet size={12} /> LUNAS
                      </>
                    ) : (
                      <>
                        <Clock size={12} /> BAYAR NANTI
                      </>
                    )}
                  </div>
                </div>
              </div>

              {isProcessing && (
                <div
                  className="rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 p-3 text-[#FFD700] text-sm"
                  data-testid="scan-order-not-ready"
                >
                  ⏳ Cucian belum selesai — {STATUS_LABEL[status] || status}.
                  Minta pelanggan datang lagi setelah status jadi "Sudah
                  Disetrika".
                </div>
              )}

              {isDone && (
                <div
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white/60 text-sm"
                  data-testid="scan-order-already-done"
                >
                  Order ini sudah diambil sebelumnya.
                </div>
              )}

              <div className="space-y-2 pt-1">
                {isReadyForPickup && (
                  <button
                    onClick={handleMarkTaken}
                    disabled={busy}
                    data-testid="mark-taken-button"
                    className="w-full h-12 rounded-xl bg-[#FFD700] text-black font-heading font-extrabold tracking-wide flex items-center justify-center gap-2 hover:bg-[#ffdf33] active:scale-[0.97] transition-all disabled:opacity-60 shadow-[0_6px_20px_rgba(255,215,0,0.25)]"
                  >
                    {busy ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} strokeWidth={2.5} />
                    )}
                    CUCIAN SUDAH DIAMBIL
                  </button>
                )}

                {isUnpaid && (
                  <button
                    onClick={() => setPayCamOpen(true)}
                    disabled={busy}
                    data-testid="pay-now-button"
                    className="w-full h-12 rounded-xl bg-[#25D366] text-white font-heading font-extrabold tracking-wide flex items-center justify-center gap-2 hover:bg-[#20b856] active:scale-[0.97] transition-all disabled:opacity-60 shadow-[0_6px_20px_rgba(37,211,102,0.35)]"
                  >
                    <Camera size={16} strokeWidth={2.5} />
                    BAYAR SEKARANG (FOTO BUKTI)
                  </button>
                )}

                <button
                  onClick={() => onOpenChange(false)}
                  className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 font-medium hover:bg-white/10 transition-colors"
                  data-testid="scan-order-close"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CameraCapture
        open={payCamOpen}
        onClose={() => setPayCamOpen(false)}
        onCapture={handlePaymentCapture}
        facing="environment"
        requireGeotag={false}
        title="Foto Bukti Bayar"
        helper="Foto uang / struk transfer / notifikasi transfer"
        ctaLabel="Simpan Bukti Bayar"
      />
    </>
  );
}
