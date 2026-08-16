import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { Printer, Clock, Tag, ClipboardList, FileText } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { SOURCE_OPTIONS, TIER_STYLE, formatIDR } from "@/components/pos/data";
import { fetchReceiptSettings } from "@/lib/api";
import { printReceipt } from "@/lib/receiptPrinter";

export default function QrReceiptModal({
  open,
  onOpenChange,
  orderId,
  customerName,
  sumberOrder,
  totalItemsCount,
  total,
  paymentStatus,
  receiptUsedMembership,
  receiptMemberSnapshot,
  receiptRemainingKg,
  qrPayload,
  onNewOrder,
  // Optional rich snapshot for real receipt printing (falls back to
  // just showing the QR modal if the caller doesn't provide it).
  printPayload,
}) {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    if (open) fetchReceiptSettings().then(setSettings);
  }, [open]);

  const handlePrint = (model) => {
    if (!printPayload) {
      toast.error("Data cetak belum siap");
      return;
    }
    const w = printReceipt(printPayload, model, settings);
    if (!w) {
      toast.error("Pop-up diblokir browser", {
        description: "Izinkan pop-up untuk domain ini.",
      });
    } else {
      const label = model === "customer" ? "pelanggan" : model === "production" ? "produksi" : "bag tag";
      toast.success(`Nota ${label} dicetak`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111111] border-white/10 text-white max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-heading font-bold text-[#FFD700] text-xl">
            Order Tersimpan
          </DialogTitle>
          <DialogDescription className="text-white/50 text-xs">
            Scan QR code berikut di stasiun produksi untuk memperbarui status.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="bg-white p-4 rounded-2xl shadow-[0_0_40px_rgba(255,215,0,0.2)]">
            <QRCodeCanvas
              value={qrPayload || "LAUNDRYMAX"}
              size={200}
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="M"
              data-testid="qr-code-canvas"
            />
          </div>
          <div className="text-center space-y-1">
            <div
              className="font-mono text-[#FFD700] text-sm tracking-wider"
              data-testid="order-id-display"
            >
              {orderId}
            </div>
            <div className="text-white/50 text-xs">
              {customerName} ·{" "}
              {SOURCE_OPTIONS.find((s) => s.id === sumberOrder)?.label} ·{" "}
              {totalItemsCount} item
            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-heading font-bold uppercase tracking-widest border ${
                  paymentStatus === "lunas" || receiptUsedMembership
                    ? "bg-[#7DF08F]/15 text-[#B4F5BF] border-[#7DF08F]/30"
                    : "bg-[#FF8A3D]/15 text-[#FFB98C] border-[#FF8A3D]/30"
                }`}
              >
                {receiptUsedMembership
                  ? "Membership"
                  : paymentStatus === "lunas"
                  ? "Lunas"
                  : "Bayar Nanti"}
              </span>
            </div>
            <div className="font-heading font-bold text-white text-2xl pt-1">
              {formatIDR(total)}
            </div>

            {receiptUsedMembership && receiptMemberSnapshot && (
              <div
                className={`mt-3 mx-2 p-3 rounded-xl border-2 border-dashed ${TIER_STYLE[receiptMemberSnapshot.tier].border} ${TIER_STYLE[receiptMemberSnapshot.tier].bg}`}
                data-testid="receipt-membership-line"
              >
                <div className="text-[10px] uppercase tracking-widest text-white/50 font-medium">
                  Sisa Kuota Anda
                </div>
                <div
                  className={`font-heading font-black text-2xl tracking-tight ${TIER_STYLE[receiptMemberSnapshot.tier].text}`}
                >
                  {receiptRemainingKg.toFixed(1)} KG
                </div>
                <div className="text-white/40 text-[10px] mt-0.5 flex items-center justify-center gap-1">
                  <Clock size={10} />
                  Hangus pada {receiptMemberSnapshot.expiry}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handlePrint("customer")}
            data-testid="print-customer-button"
            className="h-16 rounded-xl bg-[#FFD700] text-black font-heading font-bold text-[10px] tracking-wider hover:bg-[#ffdf33] transition-colors flex flex-col items-center justify-center gap-1 active:scale-95"
          >
            <FileText size={16} />
            NOTA<br />PELANGGAN
          </button>
          <button
            onClick={() => handlePrint("production")}
            data-testid="print-production-button"
            className="h-16 rounded-xl bg-white/5 border border-white/15 text-white font-heading font-bold text-[10px] tracking-wider hover:border-[#FFD700]/40 hover:bg-[#FFD700]/10 transition-colors flex flex-col items-center justify-center gap-1 active:scale-95"
          >
            <ClipboardList size={16} />
            SLIP<br />PRODUKSI
          </button>
          <button
            onClick={() => handlePrint("bagtag")}
            data-testid="print-bagtag-button"
            className="h-16 rounded-xl bg-white/5 border border-white/15 text-white font-heading font-bold text-[10px] tracking-wider hover:border-[#FFD700]/40 hover:bg-[#FFD700]/10 transition-colors flex flex-col items-center justify-center gap-1 active:scale-95"
          >
            <Tag size={16} />
            LABEL<br />BAG
          </button>
        </div>
        <button
          onClick={() => {
            onNewOrder();
            toast.success("Transaksi baru siap");
          }}
          className="w-full h-11 mt-2 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 font-medium hover:bg-white/10 hover:text-white transition-colors"
          data-testid="new-order-button"
        >
          Mulai Order Baru
        </button>
      </DialogContent>
    </Dialog>
  );
}
