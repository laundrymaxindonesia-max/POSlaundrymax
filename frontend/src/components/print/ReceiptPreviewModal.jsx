import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  ClipboardList,
  Tag,
  Loader2,
  Bluetooth,
  Printer,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  buildReceiptTextLines,
  printReceipt,
} from "@/lib/receiptPrinter";
import {
  isWebBluetoothSupported,
  requestPrinter,
  connectPrinter,
  buildEscPosPayload,
  writeToPrinter,
} from "@/lib/bluetoothPrinter";

const MODEL_META = {
  customer: {
    label: "Nota Pelanggan",
    desc: "Detail + harga + QR",
    Icon: FileText,
  },
  production: {
    label: "Slip Produksi",
    desc: "Tanpa harga · fokus item",
    Icon: ClipboardList,
  },
  bagtag: {
    label: "Label Bag / Pack",
    desc: "Minimal · tempel di tas",
    Icon: Tag,
  },
};

/**
 * ReceiptPreviewModal — one-stop UI for previewing a receipt AND printing
 * it either via the OS/browser print dialog OR directly to a paired
 * Bluetooth thermal printer.
 *
 * Props
 * -----
 * order    — the receipt payload (same shape used by receiptPrinter)
 * model    — 'customer' | 'production' | 'bagtag'
 * settings — receipt settings doc (header order + logo etc.)
 * onClose  — called when the operator dismisses the modal
 */
export default function ReceiptPreviewModal({ order, model, settings, onClose }) {
  const meta = MODEL_META[model] || MODEL_META.customer;
  const { header, body, footer } = buildReceiptTextLines(order, model, settings);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const handleBrowserPrint = () => {
    const w = printReceipt(order, model, settings);
    if (!w) {
      toast.error("Pop-up diblokir browser", {
        description: "Izinkan pop-up untuk mencetak.",
      });
    } else {
      toast.success(`Cetak ${meta.label} via browser`);
      onClose?.();
    }
  };

  const handleBluetoothPrint = async () => {
    if (!isWebBluetoothSupported()) {
      toast.error("Browser tidak mendukung Web Bluetooth", {
        description: "Pakai Chrome/Edge di Android atau macOS + HTTPS.",
      });
      return;
    }
    setBusy(true);
    setStatus("Membuka picker Bluetooth...");
    try {
      const device = await requestPrinter();
      setStatus(`Menghubungkan ke ${device.name || "printer"}...`);
      const { characteristic } = await connectPrinter(device);
      setStatus("Mengirim data ke printer...");
      const payload = buildEscPosPayload(header, body, footer);
      await writeToPrinter(characteristic, payload);
      setStatus("");
      toast.success(`Nota terkirim ke ${device.name || "printer"}`);
      onClose?.();
    } catch (e) {
      // NotFoundError = user cancelled the device picker
      if (e?.name === "NotFoundError") {
        setStatus("");
        toast.info("Pemilihan printer dibatalkan");
      } else {
        setStatus("");
        toast.error("Gagal cetak via Bluetooth", {
          description: e?.message || String(e),
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent
        className="bg-[#111111] border-white/10 text-white max-w-sm rounded-3xl"
        data-testid="receipt-preview-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-heading font-bold text-[#FFD700] flex items-center gap-2">
            <meta.Icon size={16} />
            Preview — {meta.label}
          </DialogTitle>
          <DialogDescription className="text-white/50 text-xs">
            {meta.desc} · Lebar {settings?.paper_width || "58mm"}
          </DialogDescription>
        </DialogHeader>

        {/* Preview area — monospace, styled like a physical thermal receipt */}
        <div
          data-testid="receipt-preview-body"
          className="rounded-xl border border-white/10 bg-[#0a0a0a] p-3 font-mono text-[10px] leading-4 text-white/85 max-h-72 overflow-y-auto whitespace-pre"
        >
          {header.map((line, i) => (
            <div key={`h${i}`} className="text-center font-bold text-[#FFD700]">
              {line}
            </div>
          ))}
          <div className="my-1" />
          {body.map((line, i) => (
            <div key={`b${i}`}>{line || " "}</div>
          ))}
          <div className="my-1" />
          {footer.map((line, i) => (
            <div key={`f${i}`} className="text-center text-white/60">
              {line}
            </div>
          ))}
        </div>

        {status && (
          <div
            className="flex items-center gap-2 text-white/70 text-xs"
            data-testid="preview-status"
          >
            <Loader2 size={12} className="animate-spin text-[#FFD700]" />
            {status}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={handleBluetoothPrint}
            disabled={busy}
            data-testid="print-bluetooth-button"
            className="h-12 rounded-xl bg-[#3DA5FF]/15 border border-[#3DA5FF]/40 hover:bg-[#3DA5FF]/25 hover:border-[#3DA5FF]/70 text-[#7FC1FF] font-heading font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-[0.97]"
          >
            <Bluetooth size={14} strokeWidth={2.5} />
            {busy ? "Menghubungkan..." : "Cari Printer Bluetooth"}
          </button>
          <button
            onClick={handleBrowserPrint}
            disabled={busy}
            data-testid="print-browser-button"
            className="h-12 rounded-xl bg-[#FFD700]/15 border border-[#FFD700]/40 hover:bg-[#FFD700]/25 hover:border-[#FFD700]/70 text-[#FFD700] font-heading font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-[0.97]"
          >
            <Printer size={14} strokeWidth={2.5} />
            Cetak Standar (Browser)
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            data-testid="print-preview-close"
            className="h-11 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 font-medium hover:bg-white/10 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <X size={13} /> Batal
          </button>
          {!isWebBluetoothSupported() && (
            <div className="text-[10px] text-white/40 text-center">
              Bluetooth tidak tersedia di browser ini — pakai tombol Cetak Standar.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
