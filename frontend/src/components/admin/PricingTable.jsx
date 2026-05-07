import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const INITIAL_PRICES = [
  { id: "kiloan_reguler", label: "Cuci Kiloan — Reguler (3 hari)", unit: "/kg",  umum: 7000,  tamel: 8000,  laskita: 8000,  member: 8000 },
  { id: "kiloan_flash",   label: "Cuci Kiloan — Flash (1 hari)",   unit: "/kg",  umum: 10000, tamel: 12000, laskita: 12000, member: 12000 },
  { id: "kiloan_express", label: "Cuci Kiloan — Express (5 jam)",  unit: "/kg",  umum: 18500, tamel: 20000, laskita: 20000, member: 20000 },
  { id: "satuan",   label: "Satuan (Kemeja/Celana)",     unit: "/pcs", umum: 15000, tamel: 15000, laskita: 18000, member: 13500 },
  { id: "sepatu",   label: "Sepatu",                     unit: "/pcs", umum: 30000, tamel: 30000, laskita: 35000, member: 27000 },
  { id: "jas",      label: "Jas / Coat",                 unit: "/pcs", umum: 25000, tamel: 25000, laskita: 30000, member: 22500 },
  { id: "karpet",   label: "Karpet",                     unit: "/m²",  umum: 30000, tamel: 30000, laskita: 35000, member: 27000 },
  { id: "showcase", label: "Showcase (Gas/Air)",         unit: "/pcs", umum: 20000, tamel: 20000, laskita: 22000, member: 18000 },
];

const TIERS = ["umum", "tamel", "laskita", "member"];

/**
 * PricingTable — Admin → Pengaturan Harga.
 * 4-tier grid (Umum / Tamel / Laskita / Kostunpad) × 8 service rows including
 * the 3 Kiloan speed-tier rows (Reguler / Flash / Express). All edits are
 * batched into a single POST /api/prices/bulk on SIMPAN.
 */
export default function PricingTable() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadPrices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/prices`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data = await res.json();
      // Auto-seed on empty DB so the Admin UI is never blank
      if (!Array.isArray(data) || data.length === 0) {
        const seedRes = await fetch(`${API}/seed/prices`, { method: "POST" });
        if (seedRes.ok) {
          const refetch = await fetch(`${API}/prices`);
          data = await refetch.json();
        } else {
          data = INITIAL_PRICES;
        }
      }
      // Sort by canonical service order so UI stays stable
      const order = INITIAL_PRICES.map((p) => p.id);
      data.sort(
        (a, b) => order.indexOf(a.service_id) - order.indexOf(b.service_id)
      );
      setPrices(
        data.map((p) => ({
          id: p.service_id,
          service_id: p.service_id,
          label: p.label,
          unit: p.unit,
          umum: p.umum ?? 0,
          tamel: p.tamel,
          laskita: p.laskita,
          member: p.member,
        }))
      );
    } catch (e) {
      console.error(e);
      setError(e.message || "Gagal memuat harga");
      setPrices(INITIAL_PRICES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrices();
  }, []);

  const updatePrice = (id, tier, raw) => {
    const value = parseInt(raw.replace(/\D/g, ""), 10) || 0;
    setPrices((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [tier]: value } : row))
    );
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = prices.map((p) => ({
        service_id: p.service_id || p.id,
        label: p.label,
        unit: p.unit,
        umum: p.umum ?? 0,
        tamel: p.tamel,
        laskita: p.laskita,
        member: p.member,
      }));
      const res = await fetch(`${API}/prices/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Perubahan harga tersimpan", {
        description: `${prices.length} kategori diperbarui untuk Umum / Tamel / Laskita / Kostunpad.`,
      });
    } catch (e) {
      toast.error("Gagal menyimpan harga", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="text-white/50 text-xs uppercase tracking-widest font-medium">
            Master Data
          </div>
          <h1 className="font-heading font-black text-white text-2xl md:text-3xl tracking-tight mt-1">
            Pengaturan Harga
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Multi-tier pricing untuk segmen Umum, Tamel, Laskita, dan Member Kostunpad.
            Cuci Kiloan dipisah per durasi pengerjaan: Reguler / Flash / Express.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={loadPrices}
            disabled={loading}
            data-testid="refresh-prices-btn"
            className="h-9 w-9 rounded-full bg-white/5 border border-white/10 hover:border-[#FFD700]/40 text-white/60 hover:text-[#FFD700] flex items-center justify-center transition-colors disabled:opacity-40"
            title="Muat ulang harga"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
          <span className="px-2.5 py-1 rounded-full bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700] font-heading font-bold uppercase tracking-widest">
            4 Tier Aktif
          </span>
        </div>
      </div>

      {error && (
        <div
          data-testid="pricing-error-banner"
          className="glass rounded-2xl border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-300"
        >
          Gagal memuat data harga: {error}. Menampilkan nilai default.
        </div>
      )}

      {/* Desktop table */}
      <div
        className="glass rounded-2xl overflow-hidden hidden md:block animate-fade-up"
        data-testid="pricing-table-desktop"
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th className="px-5 py-4 text-white/50 text-xs uppercase tracking-widest font-heading font-bold">
                Kategori
              </th>
              {TIERS.map((t) => (
                <th
                  key={t}
                  className="px-3 py-4 text-white/50 text-xs uppercase tracking-widest font-heading font-bold w-32"
                >
                  Harga {t === "member" ? "Kostunpad" : t.charAt(0).toUpperCase() + t.slice(1)}
                </th>
              ))}
              <th className="px-3 py-4 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {prices.map((row) => (
              <tr
                key={row.id}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                data-testid={`pricing-row-${row.id}`}
              >
                <td className="px-5 py-3.5">
                  <div className="font-heading font-bold text-white text-sm">
                    {row.label}
                  </div>
                  <div className="text-white/40 text-[11px]">{row.unit}</div>
                </td>
                {TIERS.map((tier) => (
                  <td key={tier} className="px-3 py-3.5">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-xs">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={(row[tier] ?? 0).toLocaleString("id-ID").replace(/,/g, ".")}
                        onChange={(e) => updatePrice(row.id, tier, e.target.value)}
                        data-testid={`pricing-input-${row.id}-${tier}`}
                        className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#0a0a0a] border border-white/10 hover:border-white/20 focus:border-[#FFD700] focus:outline-none text-white font-mono text-sm transition-colors"
                      />
                    </div>
                  </td>
                ))}
                <td className="px-3 py-3.5">
                  <button
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 hover:bg-[#FF6B6B]/10 hover:border-[#FF6B6B]/30 hover:text-[#FF6B6B] text-white/40 flex items-center justify-center transition-colors"
                    aria-label="Hapus baris"
                    data-testid={`pricing-delete-${row.id}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="md:hidden space-y-3" data-testid="pricing-table-mobile">
        {prices.map((row) => (
          <div key={row.id} className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-heading font-bold text-white text-sm">
                  {row.label}
                </div>
                <div className="text-white/40 text-[11px]">{row.unit}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TIERS.map((tier) => (
                <div key={tier}>
                  <label className="text-white/40 text-[10px] uppercase tracking-wider font-medium">
                    {tier === "member" ? "Kostunpad" : tier}
                  </label>
                  <div className="relative mt-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40 text-[10px]">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={(row[tier] ?? 0).toLocaleString("id-ID").replace(/,/g, ".")}
                      onChange={(e) => updatePrice(row.id, tier, e.target.value)}
                      className="w-full h-10 pl-7 pr-2 rounded-lg bg-[#0a0a0a] border border-white/10 focus:border-[#FFD700] focus:outline-none text-white font-mono text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          className="h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-2"
          data-testid="add-pricing-row"
        >
          <Plus size={16} /> Tambah Kategori
        </button>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          data-testid="save-pricing-button"
          className="flex-1 md:flex-initial h-12 md:px-8 rounded-xl bg-[#FFD700] text-black font-heading font-extrabold text-sm tracking-wide flex items-center justify-center gap-2 hover:bg-[#ffdf33] transition-all active:scale-[0.97] shadow-[0_8px_30px_rgba(255,215,0,0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> MENYIMPAN...
            </>
          ) : (
            <>
              <Save size={16} strokeWidth={2.5} />
              SIMPAN PERUBAHAN HARGA
            </>
          )}
        </button>
      </div>
    </div>
  );
}
