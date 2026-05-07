import { AlertCircle, MessageCircle } from "lucide-react";

const PIUTANG_ORDERS = [
  { id: "LND-006", customer: "Rina Permata", phone: "0821-1122-3344", amount: 30000, daysOverdue: 1 },
  { id: "LND-007", customer: "Apartemen Gateway Pasteur", phone: "0813-9999-1212", amount: 76000, daysOverdue: 2 },
  { id: "LND-009", customer: "Ahmad Subagja", phone: "0856-2233-4455", amount: 45000, daysOverdue: 3 },
  { id: "LND-012", customer: "Citra Wibowo", phone: "0878-7766-8899", amount: 62000, daysOverdue: 5 },
  { id: "LND-014", customer: "Hendra Gunawan", phone: "0822-5544-3322", amount: 28000, daysOverdue: 7 },
];

const formatIDR = (n) =>
  "Rp " + Math.round(n).toLocaleString("id-ID").replace(/,/g, ".");

/**
 * OverdueWidget — "Daftar Piutang" card on Admin → Overview.
 * Lists "Bayar Nanti" orders that haven't been settled, with per-row WA
 * deep-link CTA that opens a billing-reminder template prefilled to the
 * customer's phone number.
 */
export default function OverdueWidget() {
  const totalPiutang = PIUTANG_ORDERS.reduce((s, o) => s + o.amount, 0);

  const handleWaTagihan = (order) => {
    const phone = order.phone.replace(/\D/g, "");
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
              Order dengan status pembayaran "Bayar Nanti"
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

      <div className="mt-5 space-y-2" data-testid="piutang-list">
        {PIUTANG_ORDERS.map((order, i) => (
          <div
            key={order.id}
            data-testid={`piutang-row-${order.id}`}
            className="rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#FFD700]/30 hover:bg-white/[0.05] transition-colors p-3 flex items-center justify-between gap-3 animate-fade-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[#FF8A3D]/10 border border-[#FF8A3D]/25 flex items-center justify-center text-[#FFB98C] font-heading font-bold text-sm flex-shrink-0">
                {order.customer[0]}
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
                      order.daysOverdue > 5 ? "text-[#FF6B6B]" : "text-white/40"
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
                className="h-9 px-3 rounded-lg bg-[#25D366]/10 border border-[#25D366]/40 hover:bg-[#25D366]/20 hover:border-[#25D366]/70 text-[#25D366] font-heading font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
              >
                <MessageCircle size={12} strokeWidth={2.5} />
                <span className="hidden sm:inline">WA Tagihan</span>
                <span className="sm:hidden">WA</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
