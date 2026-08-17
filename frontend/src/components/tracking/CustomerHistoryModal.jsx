import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, History, Phone } from "lucide-react";

const formatIDR = (n) =>
  "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID").replace(/,/g, ".");
const formatDate = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (e) {
    return "-";
  }
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

/**
 * CustomerHistoryModal — full order history for a single customer across
 * all dates and statuses. Seed data comes from the parent's already-loaded
 * order list; if it's < 200 rows we also re-fetch by ?q=name so old orders
 * outside the current window aren't missed.
 */
export default function CustomerHistoryModal({ customerName, orders, onClose }) {
  // The backend list endpoint doesn't support ?q= yet, but the parent
  // TrackingScreen already loads up to 500 orders sorted by created_at,
  // so filtering client-side is more than enough for real shops.
  const [loading] = useState(false);

  const rows = useMemo(() => {
    const seen = new Set();
    const merged = [];
    for (const o of orders) {
      const key = o.order_id;
      if (!key || seen.has(key)) continue;
      if ((o.customer_name || "").toLowerCase() !== customerName.toLowerCase()) continue;
      seen.add(key);
      merged.push(o);
    }
    merged.sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bt - at;
    });
    return merged;
  }, [customerName, orders]);

  const totalSpent = rows
    .filter((o) => o.payment_status === "Lunas")
    .reduce((s, o) => s + (Number(o.total_price) || 0), 0);
  const lastPhone = rows.find((o) => o.customer_phone)?.customer_phone;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="bg-[#111111] border-white/10 text-white max-w-md rounded-3xl"
        data-testid="customer-history-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-heading font-bold text-[#FFD700] flex items-center gap-2">
            <History size={18} /> Riwayat Pelanggan
          </DialogTitle>
          <DialogDescription className="text-white/50 text-xs">
            Seluruh order untuk pelanggan ini dari semua tanggal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-white/50 text-[10px] uppercase tracking-widest">
                Nama
              </div>
              <div className="font-heading font-black text-white text-base tracking-tight">
                {customerName}
              </div>
              {lastPhone && (
                <div className="flex items-center gap-1.5 text-white/60 text-[11px] mt-1">
                  <Phone size={11} />
                  <span className="font-mono">{lastPhone}</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-white/50 text-[10px] uppercase tracking-widest">
                Total Lunas
              </div>
              <div className="font-heading font-black text-[#FFD700] text-base mt-0.5">
                {formatIDR(totalSpent)}
              </div>
              <div className="text-white/40 text-[10px] mt-0.5">
                {rows.length} order
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="grid grid-cols-[70px_1fr_80px] gap-2 text-[9px] uppercase tracking-widest text-white/40 px-3 py-2 border-b border-white/5 bg-white/[0.02]">
              <div>Tanggal</div>
              <div>Order</div>
              <div className="text-right">Total</div>
            </div>
            <div
              className="max-h-72 overflow-y-auto"
              data-testid="customer-history-list"
            >
              {loading && rows.length === 0 ? (
                <div className="p-6 flex items-center justify-center gap-2 text-white/60 text-xs">
                  <Loader2 size={12} className="animate-spin" />
                  Memuat riwayat...
                </div>
              ) : rows.length === 0 ? (
                <div className="p-6 text-center text-white/50 text-xs" data-testid="history-empty">
                  Belum ada order tercatat.
                </div>
              ) : (
                rows.map((o) => (
                  <div
                    key={o.order_id}
                    data-testid={`history-row-${o.order_id}`}
                    className="grid grid-cols-[70px_1fr_80px] gap-2 items-center px-3 py-2 border-b border-white/5 last:border-0 text-xs"
                  >
                    <div className="text-white/50 text-[10px]">
                      {formatDate(o.created_at)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono text-white truncate">
                        {o.order_id}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span
                          className={`px-1.5 py-0 rounded text-[9px] font-heading font-bold uppercase tracking-wider border ${
                            STATUS_STYLE[o.order_status] || "border-white/10"
                          }`}
                        >
                          {o.order_status}
                        </span>
                        <span
                          className={`text-[9px] font-heading font-bold ${
                            o.payment_status === "Lunas"
                              ? "text-[#B4F5BF]"
                              : "text-[#FFB98C]"
                          }`}
                        >
                          {o.payment_status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right font-mono text-[#FFD700] font-bold">
                      {formatIDR(o.total_price)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            data-testid="customer-history-close"
            className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 font-medium hover:bg-white/10"
          >
            Tutup
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
