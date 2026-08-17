import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, ScanLine, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * QrScanner — full-screen live QR reader powered by html5-qrcode.
 *
 * Props
 * -----
 * open          controls dialog visibility
 * onOpenChange  parent setter (fires when the dialog closes)
 * onScan        (decodedText) => void — invoked on a successful decode. The
 *               parent decides whether to close the scanner or keep it open
 *               (e.g., production scanner scans one bag then keeps going).
 * title         short heading rendered above the viewfinder
 * helper        one-line description under the title
 * fps           optional decode rate (default 12)
 * qrBox         optional pixel size of the target box (default 250)
 *
 * The component:
 * - Requests the **environment** (back) camera. Falls back to whatever
 *   camera is available if envfacing fails.
 * - Cleans up the video track on close so the phone LED turns off.
 * - Debounces successive scans of the same code (300ms) so a single tap on
 *   the trigger only fires onScan once.
 */
export default function QrScanner({
  open,
  onOpenChange,
  onScan,
  title = "Pindai QR Code",
  helper = "Arahkan kamera ke label tas / nota pelanggan",
  fps = 12,
  qrBox = 250,
}) {
  const scannerRef = useRef(null);
  const containerId = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`);
  const lastScanRef = useRef({ text: "", ts: 0 });
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError("");
    setStarting(true);

    const start = async () => {
      try {
        const instance = new Html5Qrcode(containerId.current, {
          verbose: false,
        });
        scannerRef.current = instance;
        await instance.start(
          { facingMode: { ideal: "environment" } },
          { fps, qrbox: { width: qrBox, height: qrBox }, aspectRatio: 1.0 },
          (decoded) => {
            const now = Date.now();
            if (
              decoded === lastScanRef.current.text &&
              now - lastScanRef.current.ts < 300
            ) {
              return; // debounce identical rapid re-decodes
            }
            lastScanRef.current = { text: decoded, ts: now };
            onScan(decoded);
          },
          () => {} // ignore per-frame decode errors
        );
        if (!cancelled) setStarting(false);
      } catch (e) {
        if (cancelled) return;
        setStarting(false);
        setError(
          e?.message ||
            "Gagal akses kamera. Pastikan izin kamera diberikan & pakai HTTPS."
        );
      }
    };

    start();

    return () => {
      cancelled = true;
      const inst = scannerRef.current;
      scannerRef.current = null;
      if (inst) {
        inst
          .stop()
          .catch(() => {})
          .finally(() => inst.clear().catch(() => {}));
      }
    };
  }, [open, fps, qrBox, onScan]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-black border-white/10 text-white max-w-md p-0 overflow-hidden rounded-3xl"
        data-testid="qr-scanner-modal"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{helper}</DialogDescription>

        <div className="relative">
          <div
            id={containerId.current}
            className="w-full aspect-square bg-black"
            data-testid="qr-scanner-viewport"
          />
          {/* Corner frames overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative w-56 h-56">
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-[#FFD700] rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-[#FFD700] rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-[#FFD700] rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-[#FFD700] rounded-br-lg" />
              {!error && !starting && (
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.9)] animate-pulse" />
              )}
            </div>
          </div>
          {/* Shadcn Dialog renders its own <DialogClose> as an "X" in the
              top-right corner — we intentionally don't add a duplicate one
              here to avoid overlapping test IDs and pointer-event traps. */}
        </div>

        <div className="px-4 py-3 space-y-2 bg-[#111111] border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center">
              <ScanLine size={14} className="text-[#FFD700]" />
            </div>
            <div className="min-w-0">
              <div className="font-heading font-bold text-white text-sm truncate">
                {title}
              </div>
              <div className="text-white/50 text-[11px] truncate">
                {helper}
              </div>
            </div>
          </div>

          {starting && (
            <div className="flex items-center gap-2 text-white/60 text-xs">
              <Camera size={12} className="text-[#FFD700] animate-pulse" />
              Menyalakan kamera...
            </div>
          )}
          {error && (
            <div
              className="flex items-start gap-2 rounded-lg border border-[#FF6B6B]/40 bg-[#FF6B6B]/10 p-2 text-[#FFB0B0] text-[11px]"
              data-testid="qr-scanner-error"
            >
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
