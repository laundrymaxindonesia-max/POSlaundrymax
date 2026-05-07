const B2B_QUOTAS = [
  { id: "tamel", name: "Hotel Tamel", quotaKg: 500, usedKg: 312, billing: "Rp 1.872.000", status: "Aktif" },
  { id: "laskita", name: "Laskita Kostel", quotaKg: 300, usedKg: 285, billing: "Rp 2.137.500", status: "Hampir Habis" },
  { id: "kostunpad", name: "Kost UNPAD Network", quotaKg: 800, usedKg: 410, billing: "Rp 2.214.000", status: "Aktif" },
  { id: "wins", name: "Kosan Wins", quotaKg: 200, usedKg: 124, billing: "Rp 744.000", status: "Aktif" },
];

const formatIDR = (n) =>
  "Rp " + Math.round(n).toLocaleString("id-ID").replace(/,/g, ".");

/**
 * B2BQuotas — Admin → Kuota B2B.
 * Card grid showing each partner's monthly kg quota usage with a progress bar
 * and "Hampir Habis" warning badge when >=90% consumed.
 */
export default function B2BQuotas() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-white/50 text-xs uppercase tracking-widest font-medium">
          Partnership
        </div>
        <h1 className="font-heading font-black text-white text-2xl md:text-3xl tracking-tight mt-1">
          Kuota B2B
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Monitor pemakaian kuota untuk klien kontrak bulanan.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {B2B_QUOTAS.map((q, i) => {
          const pct = Math.min(100, (q.usedKg / q.quotaKg) * 100);
          const danger = pct >= 90;
          return (
            <div
              key={q.id}
              className="glass rounded-2xl p-5 animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
              data-testid={`b2b-card-${q.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-heading font-bold text-white text-base tracking-tight">
                    {q.name}
                  </div>
                  <div className="text-white/40 text-xs mt-0.5">
                    Billing periode: {q.billing}
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-heading font-bold uppercase tracking-widest border ${
                    danger
                      ? "bg-[#FF8A3D]/15 text-[#FFB98C] border-[#FF8A3D]/40"
                      : "bg-[#7DF08F]/15 text-[#B4F5BF] border-[#7DF08F]/30"
                  }`}
                >
                  {q.status}
                </span>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-white/50">
                    {q.usedKg.toLocaleString("id-ID")} kg /{" "}
                    {q.quotaKg.toLocaleString("id-ID")} kg
                  </span>
                  <span
                    className={`font-heading font-bold ${
                      danger ? "text-[#FFB98C]" : "text-[#FFD700]"
                    }`}
                  >
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      danger
                        ? "bg-gradient-to-r from-[#FF8A3D] to-[#FFD700]"
                        : "bg-gradient-to-r from-[#FFD700] to-[#FFE966]"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-white/40 text-[10px] uppercase tracking-wider">
                    Sisa
                  </div>
                  <div className="font-heading font-bold text-white mt-0.5">
                    {(q.quotaKg - q.usedKg).toLocaleString("id-ID")} kg
                  </div>
                </div>
                <div>
                  <div className="text-white/40 text-[10px] uppercase tracking-wider">
                    Rate
                  </div>
                  <div className="font-heading font-bold text-white mt-0.5">
                    {formatIDR(q.billing.replace(/\D/g, "") / q.usedKg)}/kg
                  </div>
                </div>
                <div>
                  <div className="text-white/40 text-[10px] uppercase tracking-wider">
                    Cycle
                  </div>
                  <div className="font-heading font-bold text-white mt-0.5">
                    Bulanan
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
