import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Phone, Sparkles, CheckCircle2, Gift } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  MEMBER_PACKAGES,
  MEMBER_SOURCE_OPTIONS,
  TIER_STYLE,
  formatIDR,
} from "@/components/pos/data";

export default function MembershipModal({
  open,
  onOpenChange,
  regName,
  setRegName,
  regWa,
  setRegWa,
  regSource,
  setRegSource,
  regSelectedTier,
  setRegSelectedTier,
  onRegister,
}) {
  const handleConfirm = () => {
    if (!regName.trim()) {
      toast.error("Isi nama dulu");
      return;
    }
    if (!regWa.trim()) {
      toast.error("Isi nomor WA dulu");
      return;
    }
    const pkg = MEMBER_PACKAGES[regSource].find((p) => p.tier === regSelectedTier);
    const expiry = new Date(Date.now() + 30 * 86400 * 1000).toLocaleDateString(
      "id-ID",
      { day: "numeric", month: "long", year: "numeric" }
    );
    onRegister({
      name: regName.trim(),
      wa: regWa.trim(),
      tier: pkg.tier,
      quotaKg: pkg.kg,
      remainingKg: pkg.kg,
      expiry,
      source: regSource,
    });
    toast.success(`Member ${pkg.tier} terdaftar`, {
      description: `${regName.trim()} · ${pkg.kg} kg/bulan`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#111111] border-white/10 text-white max-w-md rounded-3xl max-h-[90vh] overflow-y-auto no-scrollbar"
        data-testid="register-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-heading font-bold text-[#FFD700] flex items-center gap-2">
            <Sparkles size={18} />
            Daftar Member Baru
          </DialogTitle>
          <DialogDescription className="text-white/50 text-xs">
            Pilih paket bulanan sesuai kebutuhan pelanggan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-white/50 text-[10px] uppercase tracking-widest mb-1.5 block font-medium">
              Nama
            </label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FFD700]" />
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Nama lengkap"
                data-testid="register-name-input"
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-[#0a0a0a] border border-white/10 focus:border-[#FFD700]/50 focus:outline-none text-white text-sm transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-white/50 text-[10px] uppercase tracking-widest mb-1.5 block font-medium">
              Nomor WA
            </label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FFD700]" />
              <input
                type="tel"
                value={regWa}
                onChange={(e) => setRegWa(e.target.value)}
                placeholder="08xxxxxxxxxx"
                data-testid="register-wa-input"
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-[#0a0a0a] border border-white/10 focus:border-[#FFD700]/50 focus:outline-none text-white text-sm font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-white/50 text-[10px] uppercase tracking-widest mb-1.5 block font-medium">
              Sumber
            </label>
            <Select value={regSource} onValueChange={setRegSource}>
              <SelectTrigger
                data-testid="register-source-dropdown"
                className="w-full h-11 bg-[#0a0a0a] border-white/10 hover:border-[#FFD700]/50 rounded-xl text-sm focus:ring-[#FFD700] focus:ring-offset-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
                {MEMBER_SOURCE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.id}
                    value={opt.id}
                    data-testid={`register-source-${opt.id}`}
                    className="focus:bg-[#FFD700]/10 focus:text-[#FFD700]"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-white/50 text-[10px] uppercase tracking-widest mb-2 block font-medium">
              Pilih Paket
            </label>
            <div className="space-y-2" data-testid="register-packages">
              {MEMBER_PACKAGES[regSource].map((pkg) => {
                const selected = regSelectedTier === pkg.tier;
                return (
                  <button
                    key={pkg.tier}
                    onClick={() => setRegSelectedTier(pkg.tier)}
                    data-testid={`register-package-${pkg.tier.toLowerCase()}`}
                    className={`w-full text-left rounded-2xl border-2 p-4 transition-all active:scale-[0.99] ${
                      selected
                        ? `${TIER_STYLE[pkg.tier].border} ${TIER_STYLE[pkg.tier].bg} shadow-[0_0_20px_rgba(255,215,0,0.15)]`
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${TIER_STYLE[pkg.tier].badge}`}>
                          <pkg.Icon size={18} strokeWidth={2.25} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-heading font-extrabold text-base tracking-tight ${TIER_STYLE[pkg.tier].text}`}>
                              {pkg.tier}
                            </span>
                            <span className="text-white/40 text-xs">· {pkg.kg} kg/bulan</span>
                          </div>
                          <div className="font-heading font-bold text-lg leading-tight mt-0.5 text-white">
                            {formatIDR(pkg.price)}
                          </div>
                        </div>
                      </div>
                      {selected && (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${TIER_STYLE[pkg.tier].badge} border`}>
                          <CheckCircle2 size={14} strokeWidth={2.5} />
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                      {pkg.benefits.map((b, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] text-white/60">
                          <Gift size={11} className={`mt-0.5 flex-shrink-0 ${TIER_STYLE[pkg.tier].text}`} />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onOpenChange(false)}
            data-testid="register-cancel-button"
            className="flex-1 h-12 rounded-xl bg-white/5 border border-white/10 text-white/80 font-medium hover:bg-white/10 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            data-testid="register-confirm-button"
            className="flex-1 h-12 rounded-xl bg-[#FFD700] text-black font-heading font-extrabold flex items-center justify-center gap-2 hover:bg-[#ffdf33] active:scale-95 transition-all shadow-[0_8px_30px_rgba(255,215,0,0.25)]"
          >
            <Sparkles size={16} strokeWidth={2.5} />
            Daftar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
