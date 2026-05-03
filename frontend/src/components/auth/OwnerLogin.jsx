/**
 * OwnerLogin — Google Sign-In landing page for /admin and /dashboard gate.
 *
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS,
 * THIS BREAKS THE AUTH.
 */
import { ShieldCheck, LogIn } from "lucide-react";

export default function OwnerLogin({ nextPath = "/admin" }) {
  const startLogin = () => {
    const redirectUrl = window.location.origin + nextPath;
    window.location.href =
      `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6"
      data-testid="owner-login-page"
    >
      <div className="glass rounded-3xl p-8 md:p-10 max-w-md w-full space-y-6 border border-white/10 relative overflow-hidden animate-fade-up">
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20"
          style={{ background: "#FFD700" }}
        />

        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FFD700] flex items-center justify-center shadow-[0_0_24px_rgba(255,215,0,0.4)]">
            <ShieldCheck size={22} className="text-black" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-heading font-extrabold text-[#FFD700] text-lg leading-none tracking-tight">
              LaundryMax
            </div>
            <div className="text-white/50 text-[10px] uppercase tracking-[0.2em] mt-1">
              Owner Console
            </div>
          </div>
        </div>

        <div>
          <h1 className="font-heading font-black text-white text-2xl md:text-3xl tracking-tight">
            Masuk sebagai <span className="text-[#FFD700]">Owner</span>
          </h1>
          <p className="text-white/60 text-sm mt-2">
            Gunakan akun Google yang terdaftar sebagai Superadmin untuk membuka
            Admin Command Center dan Pipeline Dashboard.
          </p>
        </div>

        <button
          onClick={startLogin}
          data-testid="owner-google-login-btn"
          className="w-full h-14 rounded-2xl bg-white text-black font-heading font-extrabold text-sm tracking-wide flex items-center justify-center gap-3 hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] transition-all active:scale-[0.98]"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.5-5.9 8-11.3 8a12 12 0 1 1 0-24c3 0 5.7 1 7.9 2.7l5.6-5.6C33.5 6 28.9 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.1l6.6 4.8C14.6 15.3 19 12 24 12c3 0 5.7 1 7.9 2.7l5.6-5.6C33.5 6 28.9 4 24 4 16.4 4 9.9 8.3 6.3 14.1z"/>
            <path fill="#4CAF50" d="M24 44c4.8 0 9.2-1.8 12.5-4.8l-5.8-4.9C28.8 35.7 26.5 36.5 24 36.5c-5.4 0-10-3.5-11.6-8l-6.6 5C9.3 39.5 16 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.6 6.3l5.8 4.9C42.1 35.5 44 30 44 24c0-1.2-.1-2.3-.4-3.5z"/>
          </svg>
          LOGIN DENGAN GOOGLE
        </button>

        <div className="text-white/40 text-[11px] leading-relaxed border-t border-white/10 pt-4 flex items-start gap-2">
          <LogIn size={12} className="text-[#FFD700] mt-0.5 flex-shrink-0" />
          Hanya email Owner yang diizinkan. Akun lain akan ditolak oleh sistem.
        </div>
      </div>
    </div>
  );
}
