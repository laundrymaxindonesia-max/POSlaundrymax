/**
 * StaffPinGate — two-step gate for /, /production, /courier:
 *   Step 1: pick your name
 *   Step 2: enter your PIN
 * Persists staff identity via lib/staffSession.js so operational APIs can
 * send `actor=<staff name>` to the backend.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, Fingerprint, UserRound, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { setCurrentStaff, getCurrentStaff } from "@/lib/staffSession";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function StaffPinGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => !!getCurrentStaff());
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [pin, setPin] = useState(["", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const firstInputRef = useRef(null);
  const inFlightRef = useRef(false);

  // Load staff list on first mount
  useEffect(() => {
    if (unlocked) return;
    (async () => {
      setStaffLoading(true);
      try {
        let res = await fetch(`${API}/staff`);
        let data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          await fetch(`${API}/seed/staff`, { method: "POST" });
          res = await fetch(`${API}/staff`);
          data = await res.json();
        }
        setStaff(data || []);
      } catch (e) {
        setError("Gagal memuat daftar staff");
      } finally {
        setStaffLoading(false);
      }
    })();
  }, [unlocked]);

  const selected = staff.find((s) => s.id === selectedId) || null;

  useEffect(() => {
    if (selected && firstInputRef.current) firstInputRef.current.focus();
  }, [selected]);

  const handlePinChange = (idx, val) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...pin];
    next[idx] = digit;
    setPin(next);
    setError(null);
    if (digit) {
      const el = document.getElementById(`staff-gate-pin-${idx + 1}`);
      if (el) el.focus();
    }
  };

  const handlePinKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !pin[idx] && idx > 0) {
      const next = [...pin];
      next[idx - 1] = "";
      setPin(next);
      const el = document.getElementById(`staff-gate-pin-${idx - 1}`);
      if (el) el.focus();
    }
  };

  const tryUnlock = async () => {
    if (submitting || inFlightRef.current || !selected) return;
    const pinValue = pin.join("");
    if (pinValue.length !== 4) return;
    inFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/auth/staff-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: selected.id, pin_code: pinValue }),
      });
      const bodyText = await res.text();
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const j = JSON.parse(bodyText);
          if (j && j.detail) detail = j.detail;
        } catch (e) { /* ignore */ }
        throw new Error(detail);
      }
      const data = JSON.parse(bodyText);
      setCurrentStaff({
        id: data.staff_id,
        name: data.name,
        role: data.role,
      });
      setUnlocked(true);
      toast.success(`Selamat datang, ${data.name}`);
    } catch (e) {
      setError(e.message || "Gagal memverifikasi PIN");
      setPin(["", "", "", ""]);
      setTimeout(() => firstInputRef.current?.focus(), 50);
    } finally {
      setSubmitting(false);
      inFlightRef.current = false;
    }
  };

  // Auto-submit when 4 digits typed
  useEffect(() => {
    if (pin.join("").length === 4 && selected && !submitting) tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  if (unlocked) return children;

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6"
      data-testid="staff-pin-gate"
    >
      <div className="glass rounded-3xl p-7 md:p-9 max-w-lg w-full space-y-6 border border-white/10 relative overflow-hidden animate-fade-up">
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20"
          style={{ background: "#FFD700" }}
        />

        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FFD700] flex items-center justify-center shadow-[0_0_24px_rgba(255,215,0,0.4)]">
            <Fingerprint size={22} className="text-black" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-heading font-extrabold text-[#FFD700] text-lg leading-none tracking-tight">
              LaundryMax
            </div>
            <div className="text-white/50 text-[10px] uppercase tracking-[0.2em] mt-1">
              Staff Access
            </div>
          </div>
        </div>

        {!selected ? (
          <>
            <div>
              <h1 className="font-heading font-black text-white text-2xl md:text-3xl tracking-tight">
                Pilih Nama Staff
              </h1>
              <p className="text-white/60 text-sm mt-2">
                Setiap tap order akan dicatat atas nama kamu di audit log.
              </p>
            </div>

            {staffLoading ? (
              <div
                data-testid="staff-gate-loading"
                className="glass rounded-2xl p-6 flex items-center justify-center gap-2 text-white/60 text-sm"
              >
                <Loader2 size={16} className="animate-spin text-[#FFD700]" /> Memuat...
              </div>
            ) : (
              <div
                className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
                data-testid="staff-gate-picker"
              >
                {staff.map((s) => (
                  <button
                    key={s.id}
                    data-testid={`staff-gate-option-${s.name.toLowerCase()}`}
                    onClick={() => setSelectedId(s.id)}
                    className="rounded-2xl p-3 text-left border border-white/10 bg-white/[0.03] hover:border-[#FFD700]/40 hover:bg-white/[0.06] transition-all active:scale-[0.97]"
                  >
                    <div className="w-10 h-10 rounded-xl font-heading font-black text-lg flex items-center justify-center mb-2 bg-white/5 text-[#FFD700] border border-white/10">
                      {(s.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="font-heading font-bold text-sm text-white tracking-tight">
                      {s.name}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-white/40 mt-0.5">
                      {s.display_role || s.role}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="text-white/40 text-[11px] text-center border-t border-white/10 pt-3">
              Hanya mau absen? Masuk ke{" "}
              <a
                href="/absen"
                className="text-[#FFD700] font-semibold underline underline-offset-2"
              >
                Kiosk Absensi
              </a>
              .
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                setSelectedId(null);
                setPin(["", "", "", ""]);
                setError(null);
              }}
              data-testid="staff-gate-back"
              className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-heading font-bold uppercase tracking-widest"
            >
              <ArrowLeft size={14} /> Ganti staff
            </button>

            <div className="rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/5 p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFD700] text-black flex items-center justify-center font-heading font-black text-lg">
                {(selected.name || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-heading font-bold text-white text-sm">
                  {selected.name}
                </div>
                <div className="text-white/50 text-[10px] uppercase tracking-widest">
                  {selected.display_role || selected.role}
                </div>
              </div>
              <UserRound size={14} className="ml-auto text-[#FFD700]" />
            </div>

            <div>
              <h1 className="font-heading font-black text-white text-2xl md:text-3xl tracking-tight">
                Masukkan PIN 4 Digit
              </h1>
            </div>

            <div className="flex gap-3 justify-center">
              {pin.map((d, i) => (
                <input
                  key={i}
                  id={`staff-gate-pin-${i}`}
                  data-testid={`staff-gate-pin-${i}`}
                  value={d}
                  ref={i === 0 ? firstInputRef : undefined}
                  onChange={(e) => handlePinChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(i, e)}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  disabled={submitting}
                  className="w-14 h-16 md:w-16 md:h-20 text-center font-heading font-black text-3xl rounded-2xl bg-black/60 border-2 border-white/10 focus:border-[#FFD700] focus:outline-none focus:shadow-[0_0_20px_rgba(255,215,0,0.25)] text-[#FFD700] caret-[#FFD700] transition-all disabled:opacity-50"
                />
              ))}
            </div>

            {error && (
              <div
                data-testid="staff-gate-error"
                className="rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-red-300 text-sm text-center"
              >
                {error}
              </div>
            )}

            <button
              onClick={tryUnlock}
              disabled={submitting || pin.join("").length !== 4}
              data-testid="staff-gate-submit"
              className="w-full h-12 rounded-xl bg-[#FFD700] text-black font-heading font-extrabold text-sm tracking-wide flex items-center justify-center gap-2 hover:shadow-[0_0_30px_rgba(255,215,0,0.4)] transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> MEMVERIFIKASI...
                </>
              ) : (
                <>
                  <ShieldCheck size={16} strokeWidth={2.5} /> BUKA AKSES
                </>
              )}
            </button>

            <div className="text-white/40 text-[11px] text-center border-t border-white/10 pt-3">
              PIN default demo:{" "}
              <span className="text-[#FFD700] font-semibold">1234</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
