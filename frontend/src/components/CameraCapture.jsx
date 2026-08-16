/**
 * CameraCapture — reusable full-screen live camera modal.
 *
 * Contract
 *  - Renders a live viewfinder via `navigator.mediaDevices.getUserMedia`.
 *  - On capture, draws the current video frame to an off-screen canvas,
 *    stamps a timestamp overlay (baked into the image), and produces a
 *    JPEG Blob.
 *  - When `requireGeotag=true`, also captures GPS via `navigator.geolocation`
 *    at capture time — the coordinates are surfaced in the payload so
 *    downstream endpoints can persist them (`clock-in`, `/pod`).
 *  - Falls back to `<input type="file" capture>` when getUserMedia is
 *    unavailable (older iOS, insecure origins, restricted webviews).
 *  - Front/back camera toggle. Default `facing = "user"` for selfies.
 *
 * Props
 *   open              boolean
 *   onClose           () => void
 *   onCapture         ({blob, dataUrl, coords, timestamp}) => void|Promise
 *   facing            "user" | "environment"    (default: "user")
 *   requireGeotag     boolean                   (default: false)
 *   title             string
 *   helper            string
 *   ctaLabel          string   (button label when in preview state)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  X,
  RefreshCw,
  MapPin,
  Loader2,
  Check,
  AlertTriangle,
  SwitchCamera,
  Image as ImageIcon,
} from "lucide-react";
import { getGeolocation } from "@/lib/geolocation";

const IDEAL_WIDTH = 1280;
const IDEAL_HEIGHT = 960;

export default function CameraCapture({
  open,
  onClose,
  onCapture,
  facing = "user",
  requireGeotag = false,
  title = "Ambil Foto",
  helper = "Tekan tombol putih untuk memotret",
  ctaLabel = "Gunakan Foto",
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [currentFacing, setCurrentFacing] = useState(facing);
  const [starting, setStarting] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [coords, setCoords] = useState(null);
  const [coordsError, setCoordsError] = useState(null);

  const supportsCamera = useMemo(
    () =>
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia,
    []
  );

  // Sync facing prop when the modal is reopened
  useEffect(() => {
    if (open) setCurrentFacing(facing);
  }, [open, facing]);

  const stopStream = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startStream = useCallback(async () => {
    if (!supportsCamera) {
      setStreamError(
        "Browser tidak mendukung akses kamera live. Silakan gunakan tombol Files di bawah."
      );
      return;
    }
    setStarting(true);
    setStreamError(null);
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: currentFacing },
          width: { ideal: IDEAL_WIDTH },
          height: { ideal: IDEAL_HEIGHT },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      // NotAllowedError, NotFoundError, NotReadableError, OverconstrainedError, SecurityError
      const map = {
        NotAllowedError:
          "Akses kamera ditolak. Aktifkan izin kamera di browser lalu tutup dan buka lagi halaman ini.",
        NotFoundError: "Kamera tidak ditemukan di perangkat ini.",
        NotReadableError:
          "Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.",
        OverconstrainedError:
          "Konfigurasi kamera tidak didukung. Coba tekan tombol tukar kamera.",
        SecurityError:
          "Kamera hanya bisa diakses via HTTPS. Buka aplikasi lewat URL https://",
      };
      setStreamError(map[err?.name] || err?.message || "Gagal mengakses kamera");
    } finally {
      setStarting(false);
    }
  }, [currentFacing, stopStream, supportsCamera]);

  // Boot / teardown lifecycle
  useEffect(() => {
    if (!open) {
      stopStream();
      setPreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
      setPreviewBlob(null);
      setCoords(null);
      setCoordsError(null);
      setStreamError(null);
      setConfirming(false);
      return undefined;
    }
    startStream();
    return () => stopStream();
  }, [open, currentFacing]);

  const flipCamera = () => {
    setCurrentFacing((f) => (f === "user" ? "environment" : "user"));
  };

  // Bake a small timestamp watermark in the bottom-left so the photo carries
  // proof-of-time even if the DB row is later tampered with.
  const stampTimestamp = (ctx, w, h) => {
    const label = new Date().toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    ctx.save();
    ctx.font = `bold ${Math.round(h * 0.028)}px sans-serif`;
    const pad = Math.round(h * 0.018);
    const textW = ctx.measureText(label).width;
    const boxH = Math.round(h * 0.045);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(pad, h - boxH - pad, textW + pad * 2, boxH);
    ctx.fillStyle = "#FFD700";
    ctx.fillText(label, pad + pad, h - pad - Math.round(boxH * 0.28));
    ctx.restore();
  };

  const performCapture = async () => {
    if (captureBusy) return;
    setCaptureBusy(true);
    setCoordsError(null);
    try {
      const video = videoRef.current;
      if (!video || !video.videoWidth) {
        throw new Error("Kamera belum siap. Tunggu sebentar lalu coba lagi.");
      }
      // Kick off geolocation in parallel with the frame capture so total
      // capture-to-preview time stays snappy (<300ms typical).
      const geoPromise = requireGeotag
        ? getGeolocation().catch((e) => {
            setCoordsError(e.message);
            return null;
          })
        : Promise.resolve(null);

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      // Un-mirror for selfies so the saved image matches what the user sees
      if (currentFacing === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (currentFacing === "user") ctx.setTransform(1, 0, 0, 1, 0, 0);
      stampTimestamp(ctx, canvas.width, canvas.height);

      const blob = await new Promise((res) =>
        canvas.toBlob((b) => res(b), "image/jpeg", 0.88)
      );
      if (!blob) throw new Error("Gagal mengubah frame ke JPEG.");

      const dataUrl = URL.createObjectURL(blob);
      setPreviewBlob(blob);
      setPreviewUrl(dataUrl);
      const geo = await geoPromise;
      if (geo) setCoords(geo);
      stopStream();
    } catch (err) {
      setStreamError(err.message);
    } finally {
      setCaptureBusy(false);
    }
  };

  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setCoords(null);
    setCoordsError(null);
    startStream();
  };

  const handleConfirm = async () => {
    if (!previewBlob || confirming) return;
    if (requireGeotag && !coords) {
      // Try once more before failing.
      try {
        const geo = await getGeolocation();
        setCoords(geo);
      } catch (e) {
        setCoordsError(e.message);
        return;
      }
    }
    setConfirming(true);
    try {
      await onCapture({
        blob: previewBlob,
        dataUrl: previewUrl,
        coords,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleFileFallback = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPreviewBlob(f);
    setPreviewUrl(URL.createObjectURL(f));
    if (requireGeotag) {
      getGeolocation()
        .then(setCoords)
        .catch((err) => setCoordsError(err.message));
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black flex flex-col"
      data-testid="camera-capture-modal"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 text-white">
        <button
          type="button"
          onClick={onClose}
          data-testid="camera-close"
          className="w-11 h-11 rounded-full bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all"
          aria-label="Tutup kamera"
        >
          <X size={20} />
        </button>
        <div className="text-center px-4">
          <div className="font-heading font-black text-white text-base tracking-tight">
            {title}
          </div>
          <div className="text-white/50 text-[11px] mt-0.5">{helper}</div>
        </div>
        <button
          type="button"
          onClick={flipCamera}
          data-testid="camera-flip"
          disabled={!!previewUrl}
          className="w-11 h-11 rounded-full bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all disabled:opacity-30"
          aria-label="Tukar kamera"
        >
          <SwitchCamera size={18} />
        </button>
      </div>

      {/* Live view / preview */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Preview"
            data-testid="camera-preview-img"
            className="absolute inset-0 w-full h-full object-contain bg-black"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              data-testid="camera-video"
              className={`absolute inset-0 w-full h-full object-cover ${currentFacing === "user" ? "-scale-x-100" : ""}`}
            />
            {(starting || !supportsCamera) && !streamError && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-2"
                data-testid="camera-starting"
              >
                <Loader2 size={28} className="animate-spin text-[#FFD700]" />
                <div className="text-sm">Menyalakan kamera…</div>
              </div>
            )}
            {streamError && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-3"
                data-testid="camera-error"
              >
                <AlertTriangle size={32} className="text-[#FF8A3D]" />
                <div className="text-white font-heading font-bold text-sm max-w-xs">
                  {streamError}
                </div>
                <div className="flex flex-col gap-2 mt-2 w-full max-w-xs">
                  <button
                    onClick={startStream}
                    data-testid="camera-retry"
                    className="h-11 rounded-xl bg-[#FFD700] text-black font-heading font-bold text-xs tracking-widest flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} /> COBA LAGI
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="camera-file-fallback"
                    className="h-11 rounded-xl bg-white/10 border border-white/15 text-white font-heading font-bold text-xs tracking-widest flex items-center justify-center gap-2"
                  >
                    <ImageIcon size={14} /> PILIH DARI GALERI
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture={currentFacing === "user" ? "user" : "environment"}
                    className="hidden"
                    onChange={handleFileFallback}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Geotag pill overlay */}
        {requireGeotag && !streamError && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 max-w-[90%] px-3 py-1.5 rounded-full bg-black/60 backdrop-blur border border-white/15 text-white text-[11px] flex items-center gap-2"
            data-testid="camera-geo-pill"
          >
            <MapPin
              size={12}
              className={coords ? "text-[#7DF08F]" : "text-[#FFD700]"}
            />
            {coords
              ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} · ±${Math.round(coords.accuracy)}m`
              : coordsError
                ? coordsError
                : "GPS akan diambil saat capture"}
          </div>
        )}
      </div>

      {/* Footer / controls */}
      <div className="px-4 pt-3 pb-6 bg-gradient-to-t from-black to-black/60 flex items-center justify-center gap-6">
        {previewUrl ? (
          <>
            <button
              type="button"
              onClick={handleRetake}
              data-testid="camera-retake"
              disabled={confirming}
              className="h-14 px-6 rounded-2xl bg-white/10 border border-white/20 text-white font-heading font-bold text-xs tracking-widest flex items-center gap-2 hover:bg-white/15 active:scale-[0.98] disabled:opacity-50"
            >
              <RefreshCw size={16} /> AMBIL ULANG
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              data-testid="camera-confirm"
              disabled={confirming || (requireGeotag && !coords && !coordsError)}
              className="h-14 px-8 rounded-2xl bg-[#FFD700] text-black font-heading font-extrabold text-xs tracking-widest flex items-center gap-2 hover:bg-[#ffdf33] active:scale-[0.98] shadow-[0_8px_30px_rgba(255,215,0,0.4)] disabled:opacity-60"
            >
              {confirming ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> MENYIMPAN…
                </>
              ) : (
                <>
                  <Check size={16} strokeWidth={3} /> {ctaLabel}
                </>
              )}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={performCapture}
            data-testid="camera-shutter"
            disabled={!!streamError || starting || captureBusy}
            className="relative w-20 h-20 rounded-full bg-white ring-4 ring-white/30 flex items-center justify-center active:scale-90 transition-all disabled:opacity-40"
            aria-label="Ambil foto"
          >
            {captureBusy ? (
              <Loader2 size={28} className="animate-spin text-black" />
            ) : (
              <Camera size={28} className="text-black" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
