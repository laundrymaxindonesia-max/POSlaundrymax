import { QrCode } from "lucide-react";
import { formatIDR } from "@/components/pos/data";

/**
 * CartSummary — sticky bottom bar showing Total Harga + Item count and the
 * yellow SIMPAN & CETAK QR CODE primary action.
 *
 * `usingMembership` shows the "(membership cover)" annotation; when the order
 * is non-membership but applies a Kosan 10% discount, the discount amount is
 * surfaced inline. `saveBlockedReason` displays an inline warning under the
 * button when present and disables the action.
 */
export default function CartSummary({
  total,
  totalItemsCount,
  usingMembership,
  isMember,
  subtotal,
  discount,
  saveBlockedReason,
  onSave,
}) {
  return (
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
        onClick={onSave}
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
  );
}
