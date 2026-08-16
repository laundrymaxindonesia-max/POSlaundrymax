import { useEffect, useState } from "react";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { fetchB2BQuotas } from "@/lib/api";

const formatIDR = (n) =>
  "Rp " + Math.round(n).toLocaleString("id-ID").replace(/,/g, ".");

/**
 * B2BQuotas — Admin → Kuota B2B.
 * Live-fetches every partner contract from GET /api/b2b_quotas and shows the
 * monthly kg quota usage with a progress bar + status badge (Hampir Habis at
 * 90%). Renders an empty-state card when the DB has no partners yet.
 */
export default function B2BQuotas() {
  const [quotas, setQuotas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchB2BQuotas();
        setQuotas(Array.isArray(rows) ? rows : []);
      } catch (e) {
        toast.error("Gagal memuat kuota B2B", { description: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

      {loading ? (
        <div
          className="glass rounded-2xl p-10 flex items-center justify-center gap-2 text-white/60"
          data-testid="b2b-loading"
        >
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Memuat data partner...</span>
        </div>
      ) : quotas.length === 0 ? (
        <div
          className="glass rounded-2xl p-10 flex flex-col items-center justify-center gap-2 text-white/50"
          data-testid="b2b-empty"
        >
          <Building2 size={28} strokeWidth={1.5} />
          <div className="font-heading font-bold text-white/70 text-sm mt-2">
            Belum ada partner B2B
          </div>
          <div className="text-xs">
            Tambahkan partner via seeding backend atau modul admin nanti.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {quotas.map((q, i) => {
            const used = Number(q.used_quota_kg) || 0;
            const total = Number(q.total_quota_kg) || 1;
            const pct = Math.min(100, (used / total) * 100);
            const danger = pct >= 90;
            const status = danger ? "Hampir Habis" : "Aktif";
            return (
              <div
                key={q.partner_id || q.id}
                className="glass rounded-2xl p-5 animate-fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
                data-testid={`b2b-card-${q.partner_id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-heading font-bold text-white text-base tracking-tight">
                      {q.partner_name}
                    </div>
                    <div className="text-white/40 text-xs mt-0.5">
                      Periode: {q.billing_period || "—"}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-heading font-bold uppercase tracking-widest border ${
                      danger
                        ? "bg-[#FF8A3D]/15 text-[#FFB98C] border-[#FF8A3D]/40"
                        : "bg-[#7DF08F]/15 text-[#B4F5BF] border-[#7DF08F]/30"
                    }`}
                  >
                    {status}
                  </span>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-white/50">
                      {used.toLocaleString("id-ID")} kg /{" "}
                      {total.toLocaleString("id-ID")} kg
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
                      {(total - used).toLocaleString("id-ID")} kg
                    </div>
                  </div>
                  <div>
                    <div className="text-white/40 text-[10px] uppercase tracking-wider">
                      Terpakai
                    </div>
                    <div className="font-heading font-bold text-white mt-0.5">
                      {pct.toFixed(0)}%
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
      )}
    </div>
  );
}
