import { useEffect, useMemo, useRef, useState } from "react";
import {
  Fingerprint,
  UserRound,
  LogIn,
  LogOut,
  Camera,
  MapPin,
  Clock,
  X,
  CheckCircle2,
  MessageCircle,
  Loader2,
  ShieldCheck,
  Shirt,
  Wind,
  Droplets,
  PackageCheck,
  Bike,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import HeaderNav from "@/components/HeaderNav";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Shift-report UI metadata (icons/colors/labels) keyed by backend field names.
const SHIFT_META = [
  { id: "cuci",     label: "Cuci",     kgKey: "cuci_kg",     countKey: "cuci_pelanggan",     Icon: Droplets,     color: "#3DA5FF" },
  { id: "kering",   label: "Kering",   kgKey: "kering_kg",   countKey: "kering_pelanggan",   Icon: Wind,         color: "#9EDDFF" },
  { id: "setrika",  label: "Setrika",  kgKey: "setrika_kg",  countKey: "setrika_pelanggan",  Icon: Shirt,        color: "#FFD700" },
  { id: "packing",  label: "Packing",  kgKey: "packing_kg",  countKey: "packing_pelanggan",  Icon: PackageCheck, color: "#E0BBFF" },
  { id: "pickup",   label: "Pickup",   kgKey: "pickup_kg",   countKey: "pickup_pelanggan",   Icon: Bike,         color: "#7DF08F" },
  { id: "delivery", label: "Delivery", kgKey: "delivery_kg", countKey: "delivery_pelanggan", Icon: Truck,        color: "#FF8A3D" },
];

const OWNER_WA = "628123456789";

function formatTimeID(iso) {
  if (!iso) return "--:--";
  try {
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch (e) {
    return "--:--";
  }
}

function buildShiftMessage(staffName, attendance) {
  const sr = attendance?.shift_report_data || {};
  const jamMasuk = formatTimeID(attendance?.clock_in_time);
  const jamPulang = formatTimeID(attendance?.clock_out_time);
  return (
    `Selamat sore pak, izin ${staffName} laporan shift hari ini: ` +
    `telah menyelesaikan pencucian ${sr.cuci_kg || 0}kg (${sr.cuci_pelanggan || 0} pelanggan), ` +
    `pengeringan ${sr.kering_kg || 0} kg (${sr.kering_pelanggan || 0} pelanggan), ` +
    `setrika ${sr.setrika_kg || 0} kg (${sr.setrika_pelanggan || 0} pelanggan), ` +
    `packing ${sr.packing_kg || 0} kg (${sr.packing_pelanggan || 0} pelanggan), ` +
    `Pickup laundry ${sr.pickup_kg || 0} kg (${sr.pickup_pelanggan || 0} pelanggan), ` +
    `delivery laundry ${sr.delivery_kg || 0} kg (${sr.delivery_pelanggan || 0} pelanggan). ` +
    `Jam masuk: ${jamMasuk}, Jam pulang: ${jamPulang}.`
  );
}

async function generateMockSelfieBlob() {
  // Render a simple 240x240 canvas as the "selfie" — good enough for a
  // prototype + proves the multipart upload pipeline works end-to-end.
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 240;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 240, 240);
  grad.addColorStop(0, "#222");
  grad.addColorStop(1, "#0a0a0a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 240, 240);
  ctx.fillStyle = "#FFD700";
  ctx.beginPath();
  ctx.arc(120, 95, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(120, 220, 80, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(new Date().toISOString().slice(0, 19), 10, 228);
  return await new Promise((res) =>
    canvas.toBlob((b) => res(b), "image/png")
  );
}

function formatClock(date) {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(date) {
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function AttendanceKiosk() {
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [pin, setPin] = useState(["", "", "", ""]);
  const [now, setNow] = useState(new Date());
  const [clockInOpen, setClockInOpen] = useState(false);
  const [clockOutOpen, setClockOutOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadStaff = async () => {
    setStaffLoading(true);
    setStaffError(null);
    try {
      let res = await fetch(`${API}/staff`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        // Auto-seed so the kiosk is never blank on a fresh DB
        const seed = await fetch(`${API}/seed/staff`, { method: "POST" });
        if (seed.ok) {
          res = await fetch(`${API}/staff`);
          data = await res.json();
        }
      }
      setStaff(
        (data || []).map((s) => ({
          id: s.id,
          name: s.name,
          role: s.display_role || s.role,
          initial: (s.name || "?").charAt(0).toUpperCase(),
        }))
      );
    } catch (e) {
      console.error(e);
      setStaffError(e.message || "Gagal memuat staff");
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const selected = useMemo(
    () => staff.find((s) => s.id === selectedId) || null,
    [staff, selectedId]
  );
  const pinValue = pin.join("");
  const pinComplete = pin.every((d) => d.length === 1);
  const ready = selected && pinComplete;

  const resetKiosk = () => {
    setSelectedId(null);
    setPin(["", "", "", ""]);
  };

  const handlePinChange = (idx, val) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...pin];
    next[idx] = digit;
    setPin(next);
    if (digit) {
      const el = document.getElementById(`pin-${idx + 1}`);
      if (el) el.focus();
    }
  };

  const handlePinKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !pin[idx] && idx > 0) {
      const next = [...pin];
      next[idx - 1] = "";
      setPin(next);
      const el = document.getElementById(`pin-${idx - 1}`);
      if (el) el.focus();
    }
  };

  const openClockIn = () => {
    if (!ready) {
      toast.error("Pilih staff & isi PIN 4 digit");
      return;
    }
    setClockInOpen(true);
  };

  const openClockOut = () => {
    if (!ready) {
      toast.error("Pilih staff & isi PIN 4 digit");
      return;
    }
    setClockOutOpen(true);
  };

  return (
    <div
      className="relative min-h-screen text-white font-body bg-[#0a0a0a]"
      data-testid="attendance-kiosk"
    >
      {/* Top bar */}
      <header className="sticky top-0 z-30 glass-strong border-b border-white/10 px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FFD700] flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.35)]">
            <Fingerprint size={18} className="text-black" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-heading font-extrabold text-[#FFD700] text-base leading-none tracking-tight">
              LaundryMax
            </div>
            <div className="text-white/50 text-[10px] uppercase tracking-[0.15em] mt-0.5">
              HR Attendance Kiosk
            </div>
          </div>
        </div>
        <HeaderNav />
      </header>

      <main className="px-4 md:px-6 lg:px-8 py-6 md:py-8 max-w-6xl mx-auto space-y-6">
        {/* Live clock banner */}
        <section
          className="glass rounded-3xl p-5 md:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fade-up"
          data-testid="kiosk-clock"
        >
          <div>
            <div className="text-white/50 text-xs uppercase tracking-widest font-medium">
              Kiosk Absensi
            </div>
            <h1 className="font-heading font-black text-white text-2xl md:text-3xl tracking-tight mt-1">
              Selamat datang,{" "}
              <span className="text-[#FFD700]">LaundryMax Crew</span>
            </h1>
            <div className="text-white/60 text-sm mt-1 capitalize">
              {formatDate(now)}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="px-5 py-3 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/5 shadow-[0_0_24px_rgba(255,215,0,0.12)]"
              data-testid="live-clock-display"
            >
              <div className="font-heading font-black text-[#FFD700] text-4xl md:text-5xl tabular-nums tracking-tight leading-none">
                {formatClock(now)}
              </div>
              <div className="text-white/40 text-[10px] uppercase tracking-[0.2em] mt-1 text-right">
                Waktu Server
              </div>
            </div>
          </div>
        </section>

        {/* Staff picker */}
        <section className="glass rounded-3xl p-5 md:p-7 animate-fade-up" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-white/40 text-[10px] uppercase tracking-[0.2em]">
                Step 1
              </div>
              <h2 className="font-heading font-extrabold text-white text-lg tracking-tight">
                Pilih Nama Karyawan
              </h2>
            </div>
            {selected && (
              <button
                onClick={resetKiosk}
                data-testid="reset-selection-btn"
                className="text-[11px] font-heading font-bold uppercase tracking-widest text-white/60 hover:text-white flex items-center gap-1"
              >
                <X size={14} /> Reset
              </button>
            )}
          </div>
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5"
            data-testid="staff-grid"
          >
            {staffLoading && (
              <div
                className="col-span-2 sm:col-span-3 md:col-span-6 glass rounded-2xl p-6 flex items-center justify-center gap-2 text-white/50 text-sm"
                data-testid="staff-loading"
              >
                <Loader2 size={16} className="animate-spin text-[#FFD700]" />{" "}
                Memuat staff...
              </div>
            )}
            {staffError && !staffLoading && (
              <div
                className="col-span-2 sm:col-span-3 md:col-span-6 glass rounded-2xl p-4 border border-red-500/40 bg-red-500/5 text-red-300 text-sm"
                data-testid="staff-error"
              >
                {staffError}. Periksa backend, lalu klik ulang halaman ini.
              </div>
            )}
            {!staffLoading &&
              staff.map((s) => {
              const active = selectedId === s.id;
              return (
                <button
                  key={s.id}
                  data-testid={`staff-${s.name.toLowerCase()}`}
                  onClick={() => setSelectedId(s.id)}
                  className={`group rounded-2xl p-3.5 text-left border transition-all active:scale-[0.97] ${
                    active
                      ? "bg-[#FFD700] text-black border-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.35)]"
                      : "bg-white/[0.03] border-white/10 hover:border-[#FFD700]/40 hover:bg-white/[0.06]"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl font-heading font-black text-lg flex items-center justify-center mb-2 ${
                      active
                        ? "bg-black text-[#FFD700]"
                        : "bg-white/5 text-[#FFD700] border border-white/10"
                    }`}
                  >
                    {s.initial}
                  </div>
                  <div
                    className={`font-heading font-bold text-sm tracking-tight ${
                      active ? "text-black" : "text-white"
                    }`}
                  >
                    {s.name}
                  </div>
                  <div
                    className={`text-[10px] uppercase tracking-widest mt-0.5 ${
                      active ? "text-black/70" : "text-white/40"
                    }`}
                  >
                    {s.role}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* PIN */}
        <section
          className="glass rounded-3xl p-5 md:p-7 animate-fade-up"
          style={{ animationDelay: "160ms" }}
          data-testid="pin-section"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-white/40 text-[10px] uppercase tracking-[0.2em]">
                Step 2
              </div>
              <h2 className="font-heading font-extrabold text-white text-lg tracking-tight">
                Masukkan PIN 4 Digit
              </h2>
            </div>
            <div className="flex items-center gap-2 text-white/50 text-[11px] uppercase tracking-widest font-semibold">
              <ShieldCheck size={14} className="text-[#FFD700]" /> Secured
            </div>
          </div>
          <div className="flex gap-3 justify-center md:justify-start">
            {pin.map((d, i) => (
              <input
                key={i}
                id={`pin-${i}`}
                data-testid={`pin-${i}`}
                value={d}
                onChange={(e) => handlePinChange(i, e.target.value)}
                onKeyDown={(e) => handlePinKeyDown(i, e)}
                type="password"
                inputMode="numeric"
                maxLength={1}
                className="w-14 h-16 md:w-16 md:h-20 text-center font-heading font-black text-3xl rounded-2xl bg-black/60 border-2 border-white/10 focus:border-[#FFD700] focus:outline-none focus:shadow-[0_0_20px_rgba(255,215,0,0.25)] text-[#FFD700] caret-[#FFD700] transition-all"
              />
            ))}
          </div>
          <div className="text-white/40 text-xs mt-3">
            PIN default demo:{" "}
            <span className="text-[#FFD700] font-semibold">1234</span> (mock —
            semua digit berlaku)
          </div>
        </section>

        {/* Action buttons */}
        <section
          className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-up"
          style={{ animationDelay: "240ms" }}
        >
          <button
            data-testid="clock-in-btn"
            onClick={openClockIn}
            disabled={!ready}
            className={`relative overflow-hidden rounded-3xl p-6 md:p-7 text-left transition-all border-2 ${
              ready
                ? "bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 border-emerald-400/50 hover:border-emerald-300 hover:shadow-[0_0_40px_rgba(52,211,153,0.35)] active:scale-[0.98]"
                : "bg-white/[0.03] border-white/10 opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  ready
                    ? "bg-emerald-400 text-black shadow-[0_0_18px_rgba(52,211,153,0.55)]"
                    : "bg-white/5 text-white/30"
                }`}
              >
                <LogIn size={28} strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-emerald-300/70 text-[10px] uppercase tracking-[0.2em] font-semibold">
                  Masuk Kerja
                </div>
                <div className="font-heading font-black text-white text-2xl md:text-3xl tracking-tight">
                  ABSEN MASUK
                </div>
              </div>
            </div>
          </button>

          <button
            data-testid="clock-out-btn"
            onClick={openClockOut}
            disabled={!ready}
            className={`relative overflow-hidden rounded-3xl p-6 md:p-7 text-left transition-all border-2 ${
              ready
                ? "bg-gradient-to-br from-red-500/25 to-red-600/10 border-red-400/50 hover:border-red-300 hover:shadow-[0_0_40px_rgba(248,113,113,0.35)] active:scale-[0.98]"
                : "bg-white/[0.03] border-white/10 opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  ready
                    ? "bg-red-400 text-black shadow-[0_0_18px_rgba(248,113,113,0.55)]"
                    : "bg-white/5 text-white/30"
                }`}
              >
                <LogOut size={28} strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-red-300/70 text-[10px] uppercase tracking-[0.2em] font-semibold">
                  Selesai Shift
                </div>
                <div className="font-heading font-black text-white text-2xl md:text-3xl tracking-tight">
                  ABSEN PULANG
                </div>
              </div>
            </div>
          </button>
        </section>

        {/* Selected summary */}
        {selected && (
          <div
            className="glass rounded-2xl p-4 flex items-center gap-3 animate-fade-up"
            data-testid="selected-summary"
          >
            <UserRound size={16} className="text-[#FFD700]" />
            <div className="text-white/70 text-sm">
              Terpilih:{" "}
              <span className="text-white font-heading font-bold">
                {selected.name}
              </span>{" "}
              <span className="text-white/40">· {selected.role}</span>
            </div>
            <div className="ml-auto text-[10px] uppercase tracking-widest text-white/40">
              PIN: {pin.filter(Boolean).length}/4
            </div>
          </div>
        )}
      </main>

      {clockInOpen && (
        <ClockInModal
          staffId={selected?.id}
          staffName={selected?.name || ""}
          pinCode={pinValue}
          onClose={() => setClockInOpen(false)}
          onSuccess={(attendance) => {
            setClockInOpen(false);
            toast.success(
              `${selected?.name} berhasil absen masuk · ${formatTimeID(
                attendance.clock_in_time
              )}`
            );
            resetKiosk();
          }}
        />
      )}

      {clockOutOpen && (
        <ClockOutModal
          staffId={selected?.id}
          staffName={selected?.name || ""}
          pinCode={pinValue}
          onClose={() => setClockOutOpen(false)}
          onConfirm={() => {
            setClockOutOpen(false);
            toast.success(
              `${selected?.name} berhasil absen pulang · Laporan terkirim`
            );
            resetKiosk();
          }}
        />
      )}
    </div>
  );
}

/* ---------------- CLOCK-IN MODAL ---------------- */
function ClockInModal({ staffId, staffName, pinCode, onClose, onSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const capture = async () => {
    if (uploading || captured) return;
    setUploading(true);
    try {
      const blob = await generateMockSelfieBlob();
      const fd = new FormData();
      fd.append("staff_id", staffId || "");
      fd.append("pin_code", pinCode || "");
      fd.append("lat", "-6.929");
      fd.append("lng", "107.774");
      fd.append("selfie", blob, "selfie.png");
      const res = await fetch(`${API}/attendance/clock-in`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          detail = j.detail || detail;
        } catch (e) { /* ignore */ }
        throw new Error(detail);
      }
      const attendance = await res.json();
      setCaptured(true);
      setTimeout(() => onSuccess(attendance), 700);
    } catch (e) {
      toast.error(e.message || "Gagal absen masuk");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
      data-testid="clockin-modal"
    >
      <div className="w-full md:max-w-lg glass-strong border border-white/10 rounded-t-3xl md:rounded-3xl overflow-hidden animate-fade-up">
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-400 flex items-center justify-center shadow-[0_0_18px_rgba(52,211,153,0.5)]">
              <LogIn size={18} className="text-black" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-heading font-extrabold text-white text-base tracking-tight">
                Absen Masuk
              </div>
              <div className="text-white/50 text-[11px] uppercase tracking-widest">
                {staffName}
              </div>
            </div>
          </div>
          <button
            data-testid="clockin-close"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60"
          >
            <X size={18} />
          </button>
        </div>

        {/* Camera viewfinder */}
        <div className="p-5 space-y-4">
          <div
            className="relative aspect-[3/4] md:aspect-[4/3] w-full rounded-2xl overflow-hidden bg-gradient-to-b from-[#111] to-[#222] border border-white/10"
            data-testid="camera-viewfinder"
          >
            {/* mock camera backdrop */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,215,0,0.08),transparent_60%)]" />

            {/* silhouette placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-40 rounded-full border-4 border-dashed border-white/15 flex items-center justify-center">
                <UserRound size={72} className="text-white/20" strokeWidth={1.5} />
              </div>
            </div>

            {/* corner frames */}
            <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-[#FFD700] animate-corner-blink" />
            <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-[#FFD700] animate-corner-blink" />
            <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-[#FFD700] animate-corner-blink" />
            <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-[#FFD700] animate-corner-blink" />

            {/* scanning line when uploading */}
            {uploading && (
              <div className="absolute inset-x-0 h-[2px] bg-[#FFD700] shadow-[0_0_18px_rgba(255,215,0,0.8)] animate-scan-line" />
            )}

            {/* success overlay */}
            {captured && (
              <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2 text-emerald-300 font-heading font-black">
                  <CheckCircle2 size={56} strokeWidth={2.25} />
                  <div className="text-xl">TERVERIFIKASI</div>
                </div>
              </div>
            )}

            {/* top strip = live status */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/70 border border-white/10 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">
                Live Camera
              </span>
            </div>

            {/* bottom info strip */}
            <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 p-2.5 space-y-1">
              <div className="flex items-center gap-2 text-[11px]">
                <MapPin size={13} className="text-[#FFD700]" />
                <span className="text-white/80 font-semibold">
                  Lokasi: -6.929, 107.774
                </span>
                <span className="ml-auto text-emerald-300 text-[10px] uppercase font-bold">
                  ±5m akurat
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <Clock size={13} className="text-[#FFD700]" />
                <span className="text-white/80 font-semibold tabular-nums">
                  {formatClock(now)}
                </span>
                <span className="ml-auto text-white/40 text-[10px]">
                  Outlet Bandung Utara
                </span>
              </div>
            </div>
          </div>

          <button
            data-testid="capture-photo-btn"
            onClick={capture}
            disabled={uploading || captured}
            className={`w-full h-14 rounded-2xl font-heading font-black text-base tracking-tight transition-all active:scale-[0.98] ${
              uploading || captured
                ? "bg-white/10 text-white/40 cursor-not-allowed"
                : "bg-[#FFD700] text-black hover:shadow-[0_0_30px_rgba(255,215,0,0.5)]"
            } flex items-center justify-center gap-2`}
          >
            {uploading ? (
              <>
                <Loader2 size={20} className="animate-spin" /> MENGUNGGAH FOTO...
              </>
            ) : captured ? (
              <>
                <CheckCircle2 size={20} /> TERCATAT
              </>
            ) : (
              <>
                <Camera size={20} strokeWidth={2.5} /> AMBIL FOTO & CATAT WAKTU
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- CLOCK-OUT MODAL ---------------- */
function ClockOutModal({ staffId, staffName, pinCode, onClose, onConfirm }) {
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState(null);
  const [error, setError] = useState(null);
  const [reportSent, setReportSent] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    // React StrictMode double-mounts effects in dev; guard the non-idempotent
    // POST so it fires exactly once per modal open.
    if (firedRef.current) return;
    firedRef.current = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API}/attendance/clock-out`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ staff_id: staffId, pin_code: pinCode }),
        });
        if (!res.ok) {
          let detail = `HTTP ${res.status}`;
          try {
            const j = await res.json();
            detail = j.detail || detail;
          } catch (e) { /* ignore */ }
          throw new Error(detail);
        }
        const data = await res.json();
        setAttendance(data);
      } catch (e) {
        setError(e.message || "Gagal absen pulang");
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendReport = () => {
    if (!attendance) return;
    const msg = buildShiftMessage(staffName, attendance);
    const url = `https://wa.me/${OWNER_WA}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setReportSent(true);
    setTimeout(() => onConfirm(), 900);
  };

  const sr = attendance?.shift_report_data || {};
  const totalKg = SHIFT_META.reduce((a, m) => a + (sr[m.kgKey] || 0), 0);
  const totalPelanggan = SHIFT_META.reduce(
    (a, m) => a + (sr[m.countKey] || 0),
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
      data-testid="clockout-modal"
    >
      <div className="w-full md:max-w-xl glass-strong border border-white/10 rounded-t-3xl md:rounded-3xl overflow-hidden animate-fade-up max-h-[92vh] flex flex-col">
        <div className="p-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-400 flex items-center justify-center shadow-[0_0_18px_rgba(248,113,113,0.5)]">
              <LogOut size={18} className="text-black" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-heading font-extrabold text-white text-base tracking-tight">
                Rekap Kinerja Shift
              </div>
              <div className="text-white/50 text-[11px] uppercase tracking-widest">
                {staffName}
              </div>
            </div>
          </div>
          <button
            data-testid="clockout-close"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto no-scrollbar">
          {loading && (
            <div
              data-testid="clockout-loading"
              className="glass rounded-2xl p-6 flex items-center justify-center gap-2 text-white/60 text-sm"
            >
              <Loader2 size={16} className="animate-spin text-[#FFD700]" />
              Merekam absen pulang...
            </div>
          )}

          {error && !loading && (
            <div
              data-testid="clockout-error"
              className="glass rounded-2xl p-4 border border-red-500/40 bg-red-500/5 text-red-300 text-sm"
            >
              {error}
            </div>
          )}

          {!loading && attendance && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/5 p-4">
                  <div className="text-emerald-300/80 text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1.5">
                    <Clock size={12} /> Jam Masuk
                  </div>
                  <div
                    data-testid="jam-masuk"
                    className="font-heading font-black text-emerald-300 text-3xl tabular-nums mt-1"
                  >
                    {formatTimeID(attendance.clock_in_time)}
                  </div>
                </div>
                <div className="rounded-2xl border border-red-400/25 bg-red-400/5 p-4">
                  <div className="text-red-300/80 text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1.5">
                    <Clock size={12} /> Jam Pulang
                  </div>
                  <div
                    data-testid="jam-pulang"
                    className="font-heading font-black text-red-300 text-3xl tabular-nums mt-1"
                  >
                    {formatTimeID(attendance.clock_out_time)}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-heading font-extrabold text-white text-sm tracking-tight">
                    Performa Hari Ini
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">
                    {totalKg} kg · {totalPelanggan} Pelanggan
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5" data-testid="shift-stats">
                  {SHIFT_META.map((m) => {
                    const { Icon } = m;
                    const kg = sr[m.kgKey] || 0;
                    const pelanggan = sr[m.countKey] || 0;
                    return (
                      <div
                        key={m.id}
                        data-testid={`stat-${m.id}`}
                        className="rounded-xl border border-white/10 bg-black/40 p-3 flex items-center gap-3"
                      >
                        <div
                          className="w-9 h-9 rounded-lg border flex items-center justify-center"
                          style={{
                            backgroundColor: `${m.color}18`,
                            borderColor: `${m.color}40`,
                          }}
                        >
                          <Icon size={16} style={{ color: m.color }} strokeWidth={2.25} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">
                            {m.label}
                          </div>
                          <div
                            className="font-heading font-black text-white text-lg leading-none tracking-tight mt-0.5"
                            style={{ color: m.color }}
                          >
                            {kg} kg
                          </div>
                          <div className="text-white/50 text-[11px] mt-0.5">
                            {pelanggan} pelanggan
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/[0.04] p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <MessageCircle size={14} className="text-[#FFD700]" />
                  <div className="text-[10px] uppercase tracking-widest text-[#FFD700] font-bold">
                    Preview Laporan WA
                  </div>
                </div>
                <div
                  className="text-white/75 text-[12px] leading-relaxed"
                  data-testid="wa-preview"
                >
                  {buildShiftMessage(staffName, attendance)}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t border-white/10 bg-black/40">
          <button
            data-testid="send-wa-report-btn"
            onClick={sendReport}
            disabled={reportSent || loading || !!error || !attendance}
            className={`w-full h-14 rounded-2xl font-heading font-black text-base tracking-tight transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
              reportSent
                ? "bg-emerald-400 text-black"
                : "bg-[#25D366] text-black hover:shadow-[0_0_30px_rgba(37,211,102,0.5)] disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {reportSent ? (
              <>
                <CheckCircle2 size={20} /> LAPORAN TERKIRIM
              </>
            ) : (
              <>
                <MessageCircle size={20} strokeWidth={2.5} /> KIRIM LAPORAN KE WA OWNER
              </>
            )}
          </button>
          <div className="text-center text-white/40 text-[11px] mt-2">
            Setelah laporan terkirim, absen pulang akan dikonfirmasi otomatis.
          </div>
        </div>
      </div>
    </div>
  );
}
