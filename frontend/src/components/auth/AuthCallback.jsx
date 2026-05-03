/**
 * AuthCallback — one-time session_id exchange after Emergent redirect.
 *
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS,
 * THIS BREAKS THE AUTH.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AuthCallback() {
  const [error, setError] = useState(null);
  const hasProcessed = useRef(false);
  const { checkAuth } = useAuth();

  useEffect(() => {
    // Guard against StrictMode double-mount — session exchange must happen once
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    const sessionId = match ? decodeURIComponent(match[1]) : null;

    if (!sessionId) {
      setError("Session ID tidak ditemukan di URL.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API}/auth/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ session_id: sessionId }),
        });
        if (!res.ok) {
          let detail = `HTTP ${res.status}`;
          try {
            const j = await res.json();
            detail = j.detail || detail;
          } catch (e) { /* ignore */ }
          throw new Error(detail);
        }
        await checkAuth();
        // Clear fragment and redirect to the owner's home (admin console).
        window.history.replaceState(null, "", "/admin");
        window.location.href = "/admin";
      } catch (e) {
        setError(e.message || "Gagal memproses login");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6"
      data-testid="auth-callback"
    >
      {!error ? (
        <div className="flex flex-col items-center gap-3 text-white/70">
          <Loader2 size={28} className="animate-spin text-[#FFD700]" />
          <div className="font-heading font-bold">Memverifikasi akun Owner...</div>
        </div>
      ) : (
        <div className="glass rounded-3xl p-8 max-w-md text-center space-y-4 border border-red-500/30">
          <ShieldAlert size={40} className="mx-auto text-red-400" />
          <div className="font-heading font-black text-white text-xl">
            Login gagal
          </div>
          <div className="text-white/60 text-sm">{error}</div>
          <a
            href="/owner/login"
            className="inline-block h-11 px-6 rounded-xl bg-[#FFD700] text-black font-heading font-extrabold text-sm tracking-wide"
          >
            Coba Lagi
          </a>
        </div>
      )}
    </div>
  );
}
