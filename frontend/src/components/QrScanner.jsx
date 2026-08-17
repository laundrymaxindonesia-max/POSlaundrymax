import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Camera,
  ScanLine,
  AlertCircle,
  Zap,
  ZapOff,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * QrScanner — hardened live QR reader.
 *
 * Improvements over the naive `facingMode:environment` first draft:
 *  1. Uses `Html5Qrcode.getCameras()` FIRST to enumerate physical devices,
 *     then picks the back camera by label heuristic and falls back to the
 *     last-indexed device (typically the rear cam on Android).
 *  2. Stores the running instance in a ref and awaits `stop()` before
 *     `clear()` on cleanup — prevents the "camera stuck ON" state after
 *     dialog close / route change.
 *  3. Guards double-start (StrictMode + rapid re-render) with an
 *     `isStartingRef` latch.
 *  4. Maps DOMException `.name` to human-readable Indonesian help text so
 *     ops staff can debug on their own phone.
 *  5. UI adds a Switch-Camera button (visible when >1 device is present)
 *     and a Torch toggle (visible when the running track supports it).
 */

const CAMERA_LABEL_RANK = /(back|rear|environment|belakang|world|kamera belakang)/i;

function pickBestCamera(cameras) {
  if (!cameras || cameras.length === 0) return null;
  // Try label heuristic first
  const back = cameras.find((c) => CAMERA_LABEL_RANK.test(c.label || ""));
  if (back) return back;
  // Android often lists rear cameras last
  return cameras[cameras.length - 1];
}

function humanizeCameraError(err) {
  const name = err?.name || "";
  const raw = String(err?.message || err || "").trim();
  const suffix = raw ? ` (${raw})` : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Izin kamera ditolak. Buka pengaturan browser → Site Settings → Camera → Allow, lalu buka ulang halaman ini.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "Kamera tidak ditemukan pada perangkat ini." + suffix;
    case "NotReadableError":
    case "TrackStartError":
      return "Kamera sedang dipakai aplikasi lain (WhatsApp / Zoom / kamera bawaan). Tutup aplikasi tersebut lalu coba lagi.";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "Kamera belakang tidak tersedia — coba tombol Ganti Kamera di bawah.";
    case "NotSupportedError":
      return "Browser tidak mendukung akses kamera. Pakai Chrome/Safari terbaru dan wajib HTTPS.";
    case "AbortError":
      return "Akses kamera dibatalkan. Coba buka ulang scanner.";
    case "SecurityError":
      return "Kamera hanya bisa diakses lewat HTTPS. Buka aplikasi dari URL https://...";
    default:
      return (
        "Gagal akses kamera" +
        (name ? ` [${name}]` : "") +
        (raw ? `: ${raw}` : ". Pastikan izin diberikan dan pakai HTTPS.")
      );
  }
}

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
  const isStartingRef = useRef(false);
  const containerIdRef = useRef(
    `qr-reader-${Math.random().toString(36).slice(2)}`
  );
  const lastScanRef = useRef({ text: "", ts: 0 });

  const [cameras, setCameras] = useState([]);
  const [currentCameraId, setCurrentCameraId] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const config = useMemo(
    () => ({
      fps,
      qrbox: { width: qrBox, height: qrBox },
      aspectRatio: 1.0,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    }),
    [fps, qrBox]
  );

  /** Fully stop + clear the underlying html5-qrcode instance.
   *  Safe to call regardless of current state — guards each transition. */
  const teardown = useCallback(async () => {
    const inst = scannerRef.current;
    scannerRef.current = null;
    if (!inst) return;
    try {
      // getState() === 2 means SCANNING (per html5-qrcode enum). Stop first.
      if (typeof inst.getState === "function" && inst.getState() === 2) {
        await inst.stop();
      }
    } catch (e) { /* ignore stop race */ }
    try {
      await inst.clear();
    } catch (e) { /* ignore clear race */ }
  }, []);

  /** Start scanning on a specific camera id. Any previously running
   *  instance is torn down first so we never end up with two live streams. */
  const startCamera = useCallback(
    async (cameraId) => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;
      setError("");
      setStarting(true);
      setTorchOn(false);
      setTorchSupported(false);
      try {
        await teardown();
        const instance = new Html5Qrcode(containerIdRef.current, {
          verbose: false,
        });
        scannerRef.current = instance;
        await instance.start(
          cameraId,
          config,
          (decoded) => {
            const now = Date.now();
            if (
              decoded === lastScanRef.current.text &&
              now - lastScanRef.current.ts < 300
            ) {
              return;
            }
            lastScanRef.current = { text: decoded, ts: now };
            onScan(decoded);
          },
          () => {} // per-frame decode noise
        );
        // Probe torch capability on the running track
        try {
          const capabilities = instance.getRunningTrackCapabilities?.();
          if (capabilities && "torch" in capabilities) {
            setTorchSupported(Boolean(capabilities.torch));
          }
        } catch (e) { /* silently unsupported */ }
      } catch (e) {
        setError(humanizeCameraError(e));
      } finally {
        isStartingRef.current = false;
        setStarting(false);
      }
    },
    [config, onScan, teardown]
  );

  // Discover cameras + start the preferred one whenever the dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setError("");
      try {
        const devices = await Html5Qrcode.getCameras();
        if (cancelled) return;
        if (!devices || devices.length === 0) {
          setError("Tidak ada kamera terdeteksi di perangkat ini.");
          return;
        }
        setCameras(devices);
        const preferred = pickBestCamera(devices);
        setCurrentCameraId(preferred.id);
        await startCamera(preferred.id);
      } catch (e) {
        if (!cancelled) setError(humanizeCameraError(e));
      }
    })();

    return () => {
      cancelled = true;
      teardown();
    };
    // startCamera + teardown are stable via useCallback
  }, [open, startCamera, teardown]);

  const handleSwitchCamera = async () => {
    if (cameras.length < 2 || !currentCameraId) return;
    const idx = cameras.findIndex((c) => c.id === currentCameraId);
    const next = cameras[(idx + 1) % cameras.length];
    setCurrentCameraId(next.id);
    await startCamera(next.id);
  };

  const handleToggleTorch = async () => {
    const inst = scannerRef.current;
    if (!inst || !torchSupported) return;
    const nextOn = !torchOn;
    try {
      await inst.applyVideoConstraints({
        advanced: [{ torch: nextOn }],
      });
      setTorchOn(nextOn);
    } catch (e) {
      setError(humanizeCameraError(e));
    }
  };

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
            id={containerIdRef.current}
            className="w-full aspect-square bg-black"
            data-testid="qr-scanner-viewport"
          />
          {/* Corner frames */}
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
        </div>

        <div className="px-4 py-3 space-y-2 bg-[#111111] border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center">
              <ScanLine size={14} className="text-[#FFD700]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-heading font-bold text-white text-sm truncate">
                {title}
              </div>
              <div className="text-white/50 text-[11px] truncate">
                {helper}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {torchSupported && (
                <button
                  onClick={handleToggleTorch}
                  data-testid="qr-torch-toggle"
                  title={torchOn ? "Matikan senter" : "Nyalakan senter"}
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center transition ${
                    torchOn
                      ? "bg-[#FFD700]/20 border-[#FFD700]/60 text-[#FFD700]"
                      : "bg-white/5 border-white/15 text-white/70 hover:text-[#FFD700]"
                  }`}
                >
                  {torchOn ? <Zap size={14} /> : <ZapOff size={14} />}
                </button>
              )}
              {cameras.length > 1 && (
                <button
                  onClick={handleSwitchCamera}
                  data-testid="qr-switch-camera"
                  title="Ganti kamera"
                  className="w-9 h-9 rounded-lg border bg-white/5 border-white/15 text-white/70 hover:text-[#FFD700] hover:border-[#FFD700]/40 flex items-center justify-center transition"
                >
                  <RefreshCw size={14} />
                </button>
              )}
            </div>
          </div>

          {starting && !error && (
            <div
              className="flex items-center gap-2 text-white/60 text-xs"
              data-testid="qr-scanner-starting"
            >
              <Camera size={12} className="text-[#FFD700] animate-pulse" />
              Menyalakan kamera...
            </div>
          )}

          {error && (
            <div
              className="flex items-start gap-2 rounded-lg border border-[#FF6B6B]/40 bg-[#FF6B6B]/10 p-2 text-[#FFB0B0] text-[11px] leading-relaxed"
              data-testid="qr-scanner-error"
            >
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {cameras.length > 0 && currentCameraId && !error && (
            <div className="text-[10px] text-white/30 truncate" data-testid="qr-current-camera">
              Kamera aktif:{" "}
              {cameras.find((c) => c.id === currentCameraId)?.label ||
                "Perangkat tak dikenal"}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
