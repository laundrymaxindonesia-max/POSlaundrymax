/**
 * StaffPinGate — PIN overlay for operational routes (/, /production, /courier).
 *
 * Stores a per-tab sessionStorage flag so staff aren't re-prompted after they
 * authenticate once within the same browser session.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, Fingerprint } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SESSION_KEY = "staff_pin_ok";

export default function StaffPinGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_KEY) === "true";
  });
  const [pin, setPin] = useState(["", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (!unlocked && firstInputRef.current) firstInputRef.current.focus();
  }, [unlocked]);

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
    if (submitting) return;
    const pinValue = pin.join("");
    if (pinValue.length !== 4) {
      setError("Masukkan PIN 4 digit");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/auth/staff-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin_code: pinValue }),
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          detail = j.detail || detail;
        } catch (e) { /* ignore */ }
        throw new Error(detail);
      }
      sessionStorage.setItem(SESSION_KEY, "true");
      setUnlocked(true);
      toast.success("Akses terbuka");
    } catch (e) {
      setError(e.message || "Gagal memverifikasi PIN");
      setPin(["", "", "", ""]);
      setTimeout(() => {
        const el = document.getElementById("staff-gate-pin-0");
        if (el) el.focus();
      }, 50);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit when 4 digits filled
  useEffect(() => {
    const pinValue = pin.join("");
    if (pinValue.length === 4 && !submitting) {
      tryUnlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  if (unlocked) return children;

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6"
      data-testid="staff-pin-gate"
    >
      <div className="glass rounded-3xl p-8 md:p-10 max-w-md w-full space-y-6 border border-white/10 relative overflow-hidden animate-fade-up">
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

        <div>
          <h1 className="font-heading font-black text-white text-2xl md:text-3xl tracking-tight">
            Masukkan PIN Staff
          </h1>
          <p className="text-white/60 text-sm mt-2">
            Gunakan PIN 4 digit yang diberikan supervisor untuk membuka akses
            operasional di tablet ini.
          </p>
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
          disabled={submitting}
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
          <span className="text-[#FFD700] font-semibold">1234</span> · Masuk ke{" "}
          <a href="/absen" className="text-[#FFD700] font-semibold underline underline-offset-2">Kiosk Absensi</a>{" "}
          jika kamu hanya ingin absen.
        </div>
      </div>
    </div>
  );
}
