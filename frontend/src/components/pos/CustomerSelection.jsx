import {
  User,
  Sparkles,
  NotebookPen,
  Crown,
  Star,
  Calendar,
  Phone,
  MapPin,
} from "lucide-react";
import { TIER_STYLE } from "@/components/pos/data";

/**
 * CustomerSelection — name input with autocomplete dropdown,
 * member-active badge, register-member / save-regular CTAs, and
 * the saved-regular hint card. All state is owned by the parent
 * (POSScreen) — this component is purely presentational.
 */
export default function CustomerSelection({
  customerName,
  setCustomerName,
  customerSearchOpen,
  setCustomerSearchOpen,
  customerSearchLoading,
  customerSearchResults,
  pickCustomerFromSearch,
  activeMember,
  customerProfile,
  onOpenRegisterMember,
  onOpenRegisterRegular,
}) {
  return (
    <div>
      <label className="text-white/50 text-xs uppercase tracking-widest mb-2 block font-medium">
        Nama Pelanggan
      </label>
      <div className="relative">
        <User
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FFD700] pointer-events-none z-10"
        />
        <input
          type="text"
          value={customerName}
          onChange={(e) => {
            setCustomerName(e.target.value);
            setCustomerSearchOpen(true);
          }}
          onFocus={() => setCustomerSearchOpen(true)}
          onBlur={() => setTimeout(() => setCustomerSearchOpen(false), 150)}
          placeholder="Masukkan nama pelanggan"
          data-testid="customer-name-input"
          autoComplete="off"
          className="w-full h-14 pl-11 pr-4 rounded-2xl glass text-white placeholder-white/40 text-base font-medium focus:border-[#FFD700]/50 focus:outline-none transition-colors"
        />

        {customerSearchOpen && customerName.trim().length >= 2 && (
          <div
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-2xl border border-[#FFD700]/25 bg-[#0F0F0F] shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden"
            data-testid="customer-search-dropdown"
          >
            {customerSearchLoading && (
              <div className="px-4 py-3 text-white/50 text-xs flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-[#FFD700]/30 border-t-[#FFD700] animate-spin" />
                Mencari...
              </div>
            )}

            {!customerSearchLoading && customerSearchResults.length === 0 && (
              <div
                className="px-4 py-3 text-white/40 text-xs"
                data-testid="customer-search-empty"
              >
                Tidak ada pelanggan dengan nama / nomor itu. Lanjutkan ketik untuk
                pelanggan baru.
              </div>
            )}

            {!customerSearchLoading &&
              customerSearchResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickCustomerFromSearch(c)}
                  data-testid={`customer-search-result-${c.id}`}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-[#FFD700]/10 transition-colors border-b border-white/5 last:border-0"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-heading font-black text-sm flex-shrink-0 ${
                      c.type === "Member"
                        ? "bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30"
                        : "bg-white/5 text-white/70 border border-white/10"
                    }`}
                  >
                    {(c.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-heading font-bold text-white text-sm truncate">
                      {c.name}
                    </div>
                    <div className="text-white/50 text-[11px] flex items-center gap-1.5 truncate">
                      <span className="font-mono">{c.phone}</span>
                      {c.address && (
                        <>
                          <span>·</span>
                          <span className="truncate">{c.address}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {c.type === "Member" && (
                    <span className="px-2 py-0.5 rounded-full bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700] text-[9px] font-heading font-bold uppercase tracking-wider flex-shrink-0">
                      {c.member_tier || "Member"}
                    </span>
                  )}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Active membership badge */}
      {activeMember && (
        <div
          className={`mt-2 rounded-2xl border p-3 animate-fade-up ${TIER_STYLE[activeMember.tier].bg} ${TIER_STYLE[activeMember.tier].border}`}
          data-testid="member-active-badge"
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${TIER_STYLE[activeMember.tier].badge}`}
            >
              {activeMember.tier === "Platinum" ? (
                <Crown size={16} strokeWidth={2.25} />
              ) : activeMember.tier === "Gold" ? (
                <Sparkles size={16} strokeWidth={2.25} />
              ) : (
                <Star size={16} strokeWidth={2.25} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-heading font-bold text-white/50">
                Member Aktif
                <span
                  className={`px-1.5 py-0 rounded-md ${TIER_STYLE[activeMember.tier].badge} border`}
                >
                  {activeMember.tier}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5 text-sm">
                <span className="text-white/60">Sisa Kuota:</span>
                <span
                  className={`font-heading font-bold ${TIER_STYLE[activeMember.tier].text}`}
                  data-testid="member-quota-remaining"
                >
                  {activeMember.remainingKg.toFixed(1)} kg
                </span>
              </div>
              <div className="text-white/40 text-[10px] mt-0.5 flex items-center gap-1">
                <Calendar size={10} />
                Berlaku s/d {activeMember.expiry}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register CTAs */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={onOpenRegisterMember}
          data-testid="register-member-button"
          className="h-11 rounded-xl border border-[#FFD700]/40 bg-gradient-to-r from-[#FFD700]/15 to-[#FFD700]/5 hover:from-[#FFD700]/25 hover:to-[#FFD700]/10 text-[#FFD700] font-heading font-bold text-xs tracking-wide flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
        >
          <Sparkles size={14} strokeWidth={2.5} />
          DAFTAR MEMBER BARU
        </button>
        <button
          onClick={onOpenRegisterRegular}
          data-testid="register-regular-button"
          className="h-11 rounded-xl border-2 border-[#FFD700]/40 bg-transparent hover:bg-[#FFD700]/5 hover:border-[#FFD700]/70 text-[#FFD700]/90 hover:text-[#FFD700] font-heading font-bold text-xs tracking-wide flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
        >
          <NotebookPen size={14} strokeWidth={2.5} />
          SIMPAN PELANGGAN REGULER
        </button>
      </div>

      {/* Saved-regular-customer hint */}
      {customerProfile?.kind === "regular" && (
        <div
          className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 flex items-start gap-2"
          data-testid="regular-customer-hint"
        >
          <NotebookPen size={13} className="text-[#FFD700] mt-0.5 flex-shrink-0" />
          <div className="text-[11px] text-white/60 leading-snug min-w-0">
            <span className="font-heading font-bold text-white/80">
              Pelanggan reguler tersimpan
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 text-white/50">
              <Phone size={10} />
              <span className="font-mono">{customerProfile.wa}</span>
            </div>
            <div className="flex items-start gap-1.5 mt-0.5 text-white/50">
              <MapPin size={10} className="mt-0.5 flex-shrink-0" />
              <span className="truncate">{customerProfile.address}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
