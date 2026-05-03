import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Tags,
  Users,
  Building2,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Scale,
  Hourglass,
  ShoppingBag,
  LogOut,
  Menu,
  X,
  Save,
  Plus,
  Trash2,
  Mail,
  MessageCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import HeaderNav from "@/components/HeaderNav";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ADMIN_EMAIL = "theomahrizal@gmail.com";

const SIDEBAR_ITEMS = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "pricing", label: "Pengaturan Harga", Icon: Tags },
  { id: "staff", label: "Laporan Pegawai", Icon: Users },
  { id: "b2b", label: "Kuota B2B", Icon: Building2 },
];

const KPIS = [
  {
    id: "revenue",
    label: "Total Pendapatan Hari Ini",
    value: "Rp 4.820.000",
    delta: "+12.4%",
    deltaPositive: true,
    Icon: Wallet,
    accent: "#FFD700",
  },
  {
    id: "kg",
    label: "Cucian Selesai (Kg)",
    value: "182.5 Kg",
    delta: "+8.2%",
    deltaPositive: true,
    Icon: Scale,
    accent: "#3DA5FF",
  },
  {
    id: "showcase",
    label: "Penjualan Gas / Showcase",
    value: "Rp 460.000",
    delta: "−3.1%",
    deltaPositive: false,
    Icon: ShoppingBag,
    accent: "#7DF08F",
  },
  {
    id: "pending",
    label: "Cucian Menunggu",
    value: "23 Order",
    delta: "+5",
    deltaPositive: false,
    Icon: Hourglass,
    accent: "#FF8A3D",
  },
];

const STAFF_PERFORMANCE = [
  { name: "Dedi", kg: 50 },
  { name: "Rian", kg: 42 },
  { name: "Tono", kg: 38 },
  { name: "Asep", kg: 28 },
  { name: "Wawan", kg: 24 },
];

const INITIAL_PRICES = [
  { id: "kiloan", label: "Cuci Kiloan", unit: "/kg", tamel: 6000, laskita: 7500, member: 5400 },
  { id: "satuan", label: "Satuan (Kemeja/Celana)", unit: "/pcs", tamel: 15000, laskita: 18000, member: 13500 },
  { id: "jas", label: "Jas / Coat", unit: "/pcs", tamel: 25000, laskita: 30000, member: 22500 },
  { id: "sepatu", label: "Sepatu", unit: "/pcs", tamel: 30000, laskita: 35000, member: 27000 },
  { id: "karpet", label: "Karpet", unit: "/m²", tamel: 30000, laskita: 35000, member: 27000 },
  { id: "showcase", label: "Showcase (Gas/Air)", unit: "/pcs", tamel: 20000, laskita: 22000, member: 18000 },
];

const STAFF_REPORTS = [
  { name: "Dedi Saputra", role: "Cuci Kiloan", kg: 50, orders: 18, hours: "07:30 — 16:00" },
  { name: "Rian Pratama", role: "Pengeringan", kg: 42, orders: 14, hours: "08:00 — 17:00" },
  { name: "Tono Widodo", role: "Setrika", kg: 38, orders: 22, hours: "09:00 — 18:00" },
  { name: "Asep Hidayat", role: "Packing", kg: 28, orders: 16, hours: "10:00 — 19:00" },
  { name: "Wawan Effendi", role: "Kurir", kg: 24, orders: 9, hours: "08:30 — 17:30" },
];

const B2B_QUOTAS = [
  { id: "tamel", name: "Hotel Tamel", quotaKg: 500, usedKg: 312, billing: "Rp 1.872.000", status: "Aktif" },
  { id: "laskita", name: "Laskita Kostel", quotaKg: 300, usedKg: 285, billing: "Rp 2.137.500", status: "Hampir Habis" },
  { id: "kostunpad", name: "Kost UNPAD Network", quotaKg: 800, usedKg: 410, billing: "Rp 2.214.000", status: "Aktif" },
  { id: "wins", name: "Kosan Wins", quotaKg: 200, usedKg: 124, billing: "Rp 744.000", status: "Aktif" },
];

const PIUTANG_ORDERS = [
  { id: "LND-006", customer: "Rina Permata", phone: "0821-1122-3344", amount: 30000, daysOverdue: 1 },
  { id: "LND-007", customer: "Apartemen Gateway Pasteur", phone: "0813-9999-1212", amount: 76000, daysOverdue: 2 },
  { id: "LND-009", customer: "Ahmad Subagja", phone: "0856-2233-4455", amount: 45000, daysOverdue: 3 },
  { id: "LND-012", customer: "Citra Wibowo", phone: "0878-7766-8899", amount: 62000, daysOverdue: 5 },
  { id: "LND-014", customer: "Hendra Gunawan", phone: "0822-5544-3322", amount: 28000, daysOverdue: 7 },
];

const formatIDR = (n) =>
  "Rp " + Math.round(n).toLocaleString("id-ID").replace(/,/g, ".");

function KpiCard({ kpi, idx }) {
  const { label, value, delta, deltaPositive, Icon, accent } = kpi;
  return (
    <div
      className="glass rounded-2xl p-5 relative overflow-hidden animate-fade-up hover:border-[#FFD700]/30 transition-colors"
      style={{ animationDelay: `${idx * 60}ms` }}
      data-testid={`kpi-${kpi.id}`}
    >
      <div
        className="absolute top-0 right-0 w-28 h-28 rounded-full blur-3xl opacity-20"
        style={{ background: accent }}
      />
      <div className="relative flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center border"
          style={{
            backgroundColor: `${accent}18`,
            borderColor: `${accent}40`,
          }}
        >
          <Icon size={18} style={{ color: accent }} strokeWidth={2.25} />
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-heading font-bold ${
            deltaPositive
              ? "bg-[#7DF08F]/15 text-[#B4F5BF] border border-[#7DF08F]/30"
              : "bg-[#FF6B6B]/15 text-[#FFA8A8] border border-[#FF6B6B]/30"
          }`}
        >
          {delta}
        </span>
      </div>
      <div className="relative mt-4">
        <div className="text-white/50 text-[11px] uppercase tracking-widest font-medium">
          {label}
        </div>
        <div className="font-heading font-black text-white text-2xl md:text-3xl tracking-tight mt-1">
          {value}
        </div>
      </div>
    </div>
  );
}

function PiutangWidget() {
  const totalPiutang = PIUTANG_ORDERS.reduce((s, o) => s + o.amount, 0);

  const handleWaTagihan = (order) => {
    const phone = order.phone.replace(/\D/g, "");
    const msg = `Halo ${order.customer}, cucian LaundryMax (Order ${order.id}) sudah selesai. Total tagihan ${formatIDR(
      order.amount
    )}. Mohon segera dilunasi ya.`;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener"
    );
  };

  return (
    <div
      className="glass rounded-2xl p-5 md:p-6 animate-fade-up"
      style={{ animationDelay: "400ms" }}
      data-testid="piutang-widget"
    >
      <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF8A3D]/15 border border-[#FF8A3D]/40 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={18} className="text-[#FF8A3D]" strokeWidth={2.25} />
          </div>
          <div>
            <h2 className="font-heading font-bold text-white text-lg tracking-tight">
              Daftar Piutang
            </h2>
            <p className="text-white/40 text-xs mt-0.5">
              Order dengan status pembayaran "Bayar Nanti"
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-white/50 text-[10px] uppercase tracking-widest font-medium">
            Total Piutang
          </div>
          <div
            className="font-heading font-extrabold text-[#FF8A3D] text-xl mt-0.5"
            data-testid="piutang-total"
          >
            {formatIDR(totalPiutang)}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2" data-testid="piutang-list">
        {PIUTANG_ORDERS.map((order, i) => (
          <div
            key={order.id}
            data-testid={`piutang-row-${order.id}`}
            className="rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#FFD700]/30 hover:bg-white/[0.05] transition-colors p-3 flex items-center justify-between gap-3 animate-fade-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[#FF8A3D]/10 border border-[#FF8A3D]/25 flex items-center justify-center text-[#FFB98C] font-heading font-bold text-sm flex-shrink-0">
                {order.customer[0]}
              </div>
              <div className="min-w-0">
                <div className="font-heading font-bold text-white text-sm truncate">
                  {order.customer}
                </div>
                <div className="flex items-center gap-1.5 text-white/40 text-[11px] mt-0.5">
                  <span className="font-mono">{order.id}</span>
                  <span>·</span>
                  <span
                    className={
                      order.daysOverdue > 5 ? "text-[#FF6B6B]" : "text-white/40"
                    }
                  >
                    {order.daysOverdue} hari overdue
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="text-right hidden sm:block">
                <div className="font-heading font-bold text-[#FFD700] text-sm">
                  {formatIDR(order.amount)}
                </div>
              </div>
              <button
                onClick={() => handleWaTagihan(order)}
                data-testid={`wa-tagihan-${order.id}`}
                className="h-9 px-3 rounded-lg bg-[#25D366]/10 border border-[#25D366]/40 hover:bg-[#25D366]/20 hover:border-[#25D366]/70 text-[#25D366] font-heading font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
              >
                <MessageCircle size={12} strokeWidth={2.5} />
                <span className="hidden sm:inline">WA Tagihan</span>
                <span className="sm:hidden">WA</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewView() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-white/50 text-xs uppercase tracking-widest font-medium">
          Dashboard
        </div>
        <h1 className="font-heading font-black text-white text-2xl md:text-3xl tracking-tight mt-1">
          Ringkasan Operasional
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Snapshot performa hari ini per Sabtu, 01 Maret 2026.
        </p>
      </div>

      {/* KPI grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        data-testid="kpi-grid"
      >
        {KPIS.map((kpi, i) => (
          <KpiCard key={kpi.id} kpi={kpi} idx={i} />
        ))}
      </div>

      {/* Staff performance chart */}
      <div
        className="glass rounded-2xl p-5 md:p-6 animate-fade-up"
        style={{ animationDelay: "300ms" }}
        data-testid="staff-performance-card"
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="font-heading font-bold text-white text-lg tracking-tight">
              Staff Performance Today
            </h2>
            <p className="text-white/40 text-xs mt-0.5">
              Total kilogram cucian yang diproses per pegawai.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[#FFD700] text-xs font-heading font-bold">
            <TrendingUp size={14} />
            +18% WoW
          </div>
        </div>

        {/* Bar chart */}
        <div className="h-64 mt-4 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={STAFF_PERFORMANCE} barCategoryGap="30%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: "#A0A0A0", fontSize: 11, fontFamily: "Poppins" }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#A0A0A0", fontSize: 11, fontFamily: "Poppins" }}
                axisLine={false}
                tickLine={false}
                unit=" kg"
              />
              <Tooltip
                cursor={{ fill: "rgba(255,215,0,0.06)" }}
                contentStyle={{
                  background: "#1A1A1A",
                  border: "1px solid rgba(255,215,0,0.3)",
                  borderRadius: 12,
                  color: "#FFD700",
                  fontFamily: "Poppins",
                  fontSize: 12,
                }}
                labelStyle={{ color: "#FFD700", fontWeight: 600 }}
              />
              <Bar
                dataKey="kg"
                fill="#FFD700"
                radius={[8, 8, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Compact list under chart */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {STAFF_PERFORMANCE.map((s, i) => (
            <div
              key={s.name}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
              data-testid={`staff-bar-${s.name.toLowerCase()}`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70 font-medium">{s.name}</span>
                {i === 0 && (
                  <span className="text-[9px] font-bold text-[#FFD700] uppercase tracking-wider">
                    Top
                  </span>
                )}
              </div>
              <div className="font-heading font-extrabold text-[#FFD700] text-base mt-0.5">
                {s.kg} kg
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Piutang widget */}
      <PiutangWidget />
    </div>
  );
}

function PricingView() {
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
        (a, b) =>
          order.indexOf(a.service_id) - order.indexOf(b.service_id)
      );
      // Normalise to UI shape: use service_id as id for React key + testids
      setPrices(
        data.map((p) => ({
          id: p.service_id,
          service_id: p.service_id,
          label: p.label,
          unit: p.unit,
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
        description: `${prices.length} kategori diperbarui untuk Tamel / Laskita / Kostunpad.`,
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
            Multi-tier pricing untuk segmen Tamel, Laskita, dan Member Kostunpad.
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
            3 Tier Aktif
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
              <th className="px-3 py-4 text-white/50 text-xs uppercase tracking-widest font-heading font-bold w-40">
                Harga Tamel
              </th>
              <th className="px-3 py-4 text-white/50 text-xs uppercase tracking-widest font-heading font-bold w-40">
                Harga Laskita
              </th>
              <th className="px-3 py-4 text-white/50 text-xs uppercase tracking-widest font-heading font-bold w-40">
                Harga Kostunpad
              </th>
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
                {["tamel", "laskita", "member"].map((tier) => (
                  <td key={tier} className="px-3 py-3.5">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-xs">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row[tier].toLocaleString("id-ID").replace(/,/g, ".")}
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
            <div className="grid grid-cols-3 gap-2">
              {["tamel", "laskita", "member"].map((tier) => (
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
                      value={row[tier].toLocaleString("id-ID").replace(/,/g, ".")}
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

function StaffReportView() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-white/50 text-xs uppercase tracking-widest font-medium">
          Operasional
        </div>
        <h1 className="font-heading font-black text-white text-2xl md:text-3xl tracking-tight mt-1">
          Laporan Pegawai
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Performa harian per pegawai produksi & kurir.
        </p>
      </div>
      <div className="glass rounded-2xl overflow-hidden animate-fade-up">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th className="px-5 py-4 text-white/50 text-xs uppercase tracking-widest font-heading font-bold">
                Nama
              </th>
              <th className="px-3 py-4 text-white/50 text-xs uppercase tracking-widest font-heading font-bold">
                Role
              </th>
              <th className="px-3 py-4 text-white/50 text-xs uppercase tracking-widest font-heading font-bold text-right">
                KG
              </th>
              <th className="px-3 py-4 text-white/50 text-xs uppercase tracking-widest font-heading font-bold text-right">
                Order
              </th>
              <th className="px-5 py-4 text-white/50 text-xs uppercase tracking-widest font-heading font-bold hidden sm:table-cell">
                Jam Kerja
              </th>
            </tr>
          </thead>
          <tbody>
            {STAFF_REPORTS.map((s) => (
              <tr
                key={s.name}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                data-testid={`staff-row-${s.name.split(" ")[0].toLowerCase()}`}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center text-[#FFD700] font-heading font-bold text-sm">
                      {s.name[0]}
                    </div>
                    <div className="font-heading font-bold text-white text-sm">
                      {s.name}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4 text-white/60 text-sm">{s.role}</td>
                <td className="px-3 py-4 text-right font-mono text-[#FFD700] font-bold text-sm">
                  {s.kg}
                </td>
                <td className="px-3 py-4 text-right font-mono text-white text-sm">
                  {s.orders}
                </td>
                <td className="px-5 py-4 text-white/50 text-xs hidden sm:table-cell">
                  {s.hours}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function B2BQuotaView() {
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

export default function AdminDashboard() {
  const [activeView, setActiveView] = useState("overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleLogout = () => {
    toast.info("Logout (mock)", { description: "Auth flow belum aktif." });
  };

  const renderView = () => {
    switch (activeView) {
      case "pricing":
        return <PricingView />;
      case "staff":
        return <StaffReportView />;
      case "b2b":
        return <B2BQuotaView />;
      case "overview":
      default:
        return <OverviewView />;
    }
  };

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-2.5 px-2 mb-8">
        <div className="w-9 h-9 rounded-xl bg-[#FFD700] flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.4)]">
          <ShieldCheck size={18} className="text-black" strokeWidth={2.5} />
        </div>
        <div>
          <div className="font-heading font-extrabold text-[#FFD700] text-base leading-none tracking-tight">
            LaundryMax
          </div>
          <div className="text-white/50 text-[10px] uppercase tracking-[0.15em] mt-1">
            Admin Console
          </div>
        </div>
      </div>

      <nav className="space-y-1 flex-1" data-testid="admin-sidebar">
        {SIDEBAR_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => {
              setActiveView(id);
              setMobileSidebarOpen(false);
            }}
            data-testid={`sidebar-${id}`}
            className={`w-full flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
              activeView === id
                ? "bg-[#FFD700] text-black font-heading font-bold shadow-[0_0_15px_rgba(255,215,0,0.3)]"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon size={17} strokeWidth={2.25} />
            <span className="font-heading">{label}</span>
          </button>
        ))}
      </nav>

      <div className="pt-4 border-t border-white/10 mt-4">
        <button
          onClick={handleLogout}
          data-testid="admin-logout-button"
          className="w-full flex items-center gap-3 px-3 h-11 rounded-xl text-sm text-white/50 hover:text-[#FF6B6B] hover:bg-[#FF6B6B]/5 transition-colors"
        >
          <LogOut size={16} strokeWidth={2.25} />
          <span className="font-heading font-medium">Sign out</span>
        </button>
      </div>
    </>
  );

  return (
    <div
      className="relative min-h-screen text-white font-body bg-[#0a0a0a]"
      data-testid="admin-screen"
    >
      {/* Top bar */}
      <header
        className="sticky top-0 z-30 glass-strong border-b border-white/10 px-4 lg:px-6 py-3 flex items-center justify-between gap-3"
        data-testid="admin-header"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            data-testid="admin-mobile-menu"
            className="lg:hidden w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80 hover:bg-white/10 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>
          <HeaderNav />
        </div>

        <div
          className="flex items-center gap-2.5"
          data-testid="admin-auth-badge"
        >
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-heading font-bold text-[#FFD700]">
              Superadmin
            </span>
            <span className="hidden sm:flex text-white/70 text-xs font-mono items-center gap-1.5">
              <Mail size={10} className="text-white/40" />
              {ADMIN_EMAIL}
            </span>
            <span className="sm:hidden text-white/60 text-[10px] font-mono">
              theomahrizal@…
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#E6C200] flex items-center justify-center text-black font-heading font-extrabold text-sm shadow-[0_0_15px_rgba(255,215,0,0.4)]">
            T
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-64 min-h-[calc(100vh-65px)] border-r border-white/10 px-4 py-6 sticky top-[65px] self-start">
          <SidebarContent />
        </aside>

        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-50 lg:hidden"
            data-testid="admin-mobile-sidebar"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#111111] border-r border-white/10 px-4 py-6 flex flex-col">
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white"
                aria-label="Close sidebar"
              >
                <X size={16} />
              </button>
              <SidebarContent />
            </aside>
          </div>
        )}

        {/* Main content */}
        <main
          className="flex-1 min-w-0 px-4 md:px-6 lg:px-8 py-6 md:py-8"
          data-testid="admin-main"
        >
          {renderView()}
        </main>
      </div>
    </div>
  );
}
