import { useEffect, useState } from "react";
import { AlertCircle, MessageCircle, Loader2, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { fetchOrders } from "@/lib/api";

const formatIDR = (n) =>
  "Rp " + Math.round(n).toLocaleString("id-ID").replace(/,/g, ".");

function daysBetween(iso) {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}

/**
 * OverdueWidget — "Daftar Piutang" card on Admin → Overview.
 *
 * Lives off the real backend: fetches every order with `payment_status=Nanti`
 * and treats them as outstanding debt regardless of production stage.
 * Empty state renders a friendly "tidak ada piutang" card so ops know the
 * data source is real.
 */
export default function OverdueWidget() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchOrders({
          payment_status: "Nanti",
          limit: 200,
        });
        const mapped = (rows || []).map((o) => ({
          id: o.order_id,
          customer: o.customer_name,
          phone: o.customer_phone || "",
          amount: Number(o.total_price) || 0,
          daysOverdue: daysBetween(o.created_at),
        }));
        setOrders(mapped);
      } catch (e) {
        toast.error("Gagal memuat daftar piutang", { description: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalPiutang = orders.reduce((s, o) => s + o.amount, 0);

  const handleWaTagihan = (order) => {
    const phone = (order.phone || "").replace(/\D/g, "");
    const msg = `Halo ${order.customer}, cucian LaundryMax (Order ${order.id}) sudah selesai. Total tagihan ${formatIDR(
      order.amount
    )}. Mohon segera dilunasi ya.`;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener"
    );
  };

  return (
    <div
      className="glass rounded-2xl p-5 md:p-6 animate-fade-up"
      style={{ animationDelay: "400ms" }}
      data-testid="piutang-widget"
    >
      <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF8A3D]/15 border border-[#FF8A3D]/40 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={18} className="text-[#FF8A3D]" strokeWidth={2.25} />
          </div>
          <div>
            <h2 className="font-heading font-bold text-white text-lg tracking-tight">
              Daftar Piutang
            </h2>
            <p className="text-white/40 text-xs mt-0.5">
              Order dengan status pembayaran "Bayar Nanti" · live dari database
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-white/50 text-[10px] uppercase tracking-widest font-medium">
            Total Piutang
          </div>
          <div
            className="font-heading font-extrabold text-[#FF8A3D] text-xl mt-0.5"
            data-testid="piutang-total"
          >
            {formatIDR(totalPiutang)}
          </div>
        </div>
      </div>

      {loading ? (
        <div
          className="mt-5 flex items-center justify-center gap-2 py-6 text-white/60"
          data-testid="piutang-loading"
        >
          <Loader2 size={14} className="animate-spin" />
          <span className="text-xs">Memuat piutang...</span>
        </div>
      ) : orders.length === 0 ? (
        <div
          className="mt-5 flex flex-col items-center justify-center gap-1 py-8 text-white/50"
          data-testid="piutang-empty"
        >
          <CheckCheck size={22} className="text-[#7DF08F]" />
          <div className="font-heading font-bold text-white/70 text-sm mt-1">
            Semua order lunas
          </div>
          <div className="text-xs">Tidak ada piutang aktif saat ini.</div>
        </div>
      ) : (
        <div className="mt-5 space-y-2" data-testid="piutang-list">
          {orders.slice(0, 10).map((order, i) => (
            <div
              key={order.id}
              data-testid={`piutang-row-${order.id}`}
              className="rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#FFD700]/30 hover:bg-white/[0.05] transition-colors p-3 flex items-center justify-between gap-3 animate-fade-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#FF8A3D]/10 border border-[#FF8A3D]/25 flex items-center justify-center text-[#FFB98C] font-heading font-bold text-sm flex-shrink-0">
                  {(order.customer || "?")[0]}
                </div>
                <div className="min-w-0">
                  <div className="font-heading font-bold text-white text-sm truncate">
                    {order.customer}
                  </div>
                  <div className="flex items-center gap-1.5 text-white/40 text-[11px] mt-0.5">
                    <span className="font-mono">{order.id}</span>
                    <span>·</span>
                    <span
                      className={
                        order.daysOverdue > 5
                          ? "text-[#FF6B6B]"
                          : "text-white/40"
                      }
                    >
                      {order.daysOverdue} hari overdue
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right hidden sm:block">
                  <div className="font-heading font-bold text-[#FFD700] text-sm">
                    {formatIDR(order.amount)}
                  </div>
                </div>
                <button
                  onClick={() => handleWaTagihan(order)}
                  data-testid={`wa-tagihan-${order.id}`}
                  disabled={!order.phone}
                  className="h-9 px-3 rounded-lg bg-[#25D366]/10 border border-[#25D366]/40 hover:bg-[#25D366]/20 hover:border-[#25D366]/70 text-[#25D366] font-heading font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <MessageCircle size={12} strokeWidth={2.5} />
                  <span className="hidden sm:inline">WA Tagihan</span>
                  <span className="sm:hidden">WA</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
