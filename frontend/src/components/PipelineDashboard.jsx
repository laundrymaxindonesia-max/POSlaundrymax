import { useEffect, useMemo, useState } from "react";
import {
  LineChart as LineChartIcon,
  Droplets,
  Wind,
  Shirt,
  PackageCheck,
  Bike,
  CheckCircle2,
  Hourglass,
  TrendingUp,
  Package,
  Scale,
  Activity,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import HeaderNav from "@/components/HeaderNav";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STAGE_DEFS = [
  { id: "Antrian", label: "Antrian Cuci", Icon: Hourglass, color: "#FF8A3D" },
  { id: "Cuci", label: "Sudah Dicuci", Icon: Droplets, color: "#3DA5FF" },
  { id: "Kering", label: "Sudah Dikeringkan", Icon: Wind, color: "#9EDDFF" },
  { id: "Setrika", label: "Sudah Disetrika", Icon: Shirt, color: "#FFD700" },
  { id: "Packing", label: "Sudah Dipacking", Icon: PackageCheck, color: "#E0BBFF" },
  { id: "OTW", label: "Sedang Diantar", Icon: Bike, color: "#7DF08F" },
  { id: "Selesai", label: "Selesai", Icon: CheckCircle2, color: "#B4F5BF" },
];

const RANGE_OPTIONS = [
  { id: "today", label: "Hari Ini" },
  { id: "week", label: "Minggu Ini" },
  { id: "month", label: "Bulan Ini" },
];

const formatInt = (n) => n.toLocaleString("id-ID").replace(/,/g, ".");

function rangeSinceIso(range) {
  const now = new Date();
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  if (range === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  // month
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function aggregate(orders, range) {
  const stages = {};
  for (const s of STAGE_DEFS) stages[s.id] = { count: 0, kg: 0 };

  let total = 0;
  let totalKg = 0;
  for (const o of orders) {
    total += 1;
    totalKg += Number(o.weight_kg || 0);
    if (stages[o.order_status]) {
      stages[o.order_status].count += 1;
      stages[o.order_status].kg += Number(o.weight_kg || 0);
    }
  }

  // Build throughput buckets keyed off `Selesai` event timestamps when available,
  // otherwise fall back to created_at.
  let buckets = [];
  if (range === "today") {
    const hourBins = [8, 10, 12, 14, 16, 18, 20];
    buckets = hourBins.map((h) => ({ label: `${String(h).padStart(2, "0")}:00`, orders: 0, hour: h }));
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    for (const o of orders) {
      if (o.order_status !== "Selesai") continue;
      const lastEvent = (o.order_events || []).slice(-1)[0];
      const ts = lastEvent ? new Date(lastEvent.timestamp) : new Date(o.created_at);
      if (ts < todayStart) continue;
      const h = ts.getHours();
      let best = buckets[0];
      let bestDist = Math.abs(h - best.hour);
      for (const b of buckets) {
        const d = Math.abs(h - b.hour);
        if (d < bestDist) {
          best = b;
          bestDist = d;
        }
      }
      best.orders += 1;
    }
  } else if (range === "week") {
    const labels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return { label: labels[d.getDay()], orders: 0, key: d.toDateString() };
    });
    const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
    for (const o of orders) {
      const ts = new Date(o.created_at);
      ts.setHours(0, 0, 0, 0);
      const k = ts.toDateString();
      if (byKey[k]) byKey[k].orders += 1;
    }
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    buckets = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (29 - i));
      return { label: `${d.getDate()}`, orders: 0, key: d.toDateString() };
    });
    const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
    for (const o of orders) {
      const ts = new Date(o.created_at);
      ts.setHours(0, 0, 0, 0);
      const k = ts.toDateString();
      if (byKey[k]) byKey[k].orders += 1;
    }
  }

  return {
    total,
    totalKg: Math.round(totalKg),
    stages,
    trend: buckets,
    trendLabel:
      range === "today"
        ? "Order selesai per jam"
        : range === "week"
        ? "Order dibuat per hari"
        : "Order dibuat per tanggal",
  };
}

function KpiChip({ label, value, sub, Icon, accent, testid }) {
  return (
    <div
      data-testid={testid}
      className="glass rounded-2xl p-4 relative overflow-hidden hover:border-[#FFD700]/30 transition-colors animate-fade-up"
    >
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-3xl opacity-20"
        style={{ background: accent }}
      />
      <div className="relative flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0"
          style={{
            backgroundColor: `${accent}18`,
            borderColor: `${accent}40`,
          }}
        >
          <Icon size={18} style={{ color: accent }} strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <div className="text-white/50 text-[10px] uppercase tracking-widest font-medium">
            {label}
          </div>
          <div className="font-heading font-black text-white text-xl md:text-2xl tracking-tight leading-tight mt-0.5">
            {value}
          </div>
          {sub && <div className="text-white/40 text-[10px] mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function StageCard({ stage, data, percent, maxCount, idx }) {
  const { Icon, color } = stage;
  const widthPct = Math.max(6, (data.count / Math.max(1, maxCount)) * 100);
  return (
    <div
      data-testid={`stage-${stage.id.toLowerCase()}`}
      className="glass rounded-2xl p-4 md:p-5 animate-fade-up hover:border-[#FFD700]/25 transition-colors"
      style={{ animationDelay: `${idx * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: `${color}18`,
              borderColor: `${color}40`,
              boxShadow: `0 0 18px ${color}22`,
            }}
          >
            <Icon size={20} style={{ color }} strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <div className="font-heading font-bold text-white text-sm tracking-tight">
              {stage.label}
            </div>
            <div className="text-white/40 text-[10px] uppercase tracking-widest mt-0.5">
              {percent.toFixed(1)}% of total
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div
            className="font-heading font-black text-2xl leading-none tracking-tight"
            style={{ color }}
          >
            {formatInt(data.count)}
          </div>
          <div className="text-white/40 text-[10px] uppercase tracking-widest mt-1">
            {formatInt(data.kg)} kg
          </div>
        </div>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${widthPct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}bb)`,
            boxShadow: `0 0 12px ${color}55`,
          }}
        />
      </div>
    </div>
  );
}

export default function PipelineDashboard() {
  const [range, setRange] = useState("today");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const load = async (r = range) => {
    setLoading(true);
    setError(null);
    try {
      const since = rangeSinceIso(r);
      const res = await fetch(
        `${API}/orders?since=${encodeURIComponent(since)}&limit=5000`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrders(data);
    } catch (e) {
      console.error(e);
      setError(e.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const data = useMemo(() => aggregate(orders, range), [orders, range]);
  const rangeLabel = RANGE_OPTIONS.find((r) => r.id === range).label;
  const maxCount = useMemo(
    () => Math.max(1, ...Object.values(data.stages).map((s) => s.count)),
    [data]
  );

  const inProgress = data.total - data.stages.Selesai.count;
  const completionRate =
    data.total > 0 ? (data.stages.Selesai.count / data.total) * 100 : 0;

  const runSeed = async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      const res = await fetch(`${API}/seed/orders`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      toast.success(`Seed berhasil · ${body.inserted} order`);
      await load(range);
    } catch (e) {
      toast.error(`Seed gagal: ${e.message}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div
      className="relative min-h-screen text-white font-body bg-[#0a0a0a]"
      data-testid="pipeline-dashboard"
    >
      <header className="sticky top-0 z-30 glass-strong border-b border-white/10 px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FFD700] flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.35)]">
            <LineChartIcon size={18} className="text-black" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-heading font-extrabold text-[#FFD700] text-base leading-none tracking-tight">
              LaundryMax
            </div>
            <div className="text-white/50 text-[10px] uppercase tracking-[0.15em] mt-0.5">
              Pipeline Dashboard
            </div>
          </div>
        </div>
        <HeaderNav />
      </header>

      <main className="px-4 md:px-6 lg:px-8 py-6 md:py-8 max-w-7xl mx-auto space-y-6">
        {/* Title + range filter */}
        <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-white/50 text-xs uppercase tracking-widest font-medium">
              Operations Snapshot
            </div>
            <h1 className="font-heading font-black text-white text-2xl md:text-3xl tracking-tight mt-1">
              Pipeline{" "}
              <span className="text-[#FFD700]">{rangeLabel}</span>
            </h1>
            <p className="text-white/50 text-sm mt-1">
              Monitor arus cucian real-time dari antrian sampai selesai.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="refresh-btn"
              onClick={() => load(range)}
              className="h-11 w-11 glass rounded-xl border-white/10 hover:border-[#FFD700]/40 flex items-center justify-center text-[#FFD700] transition-colors active:scale-95"
              title="Refresh"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
            </button>
            <button
              data-testid="seed-btn"
              onClick={runSeed}
              disabled={seeding}
              className="h-11 px-3 glass rounded-xl border-white/10 hover:border-[#FFD700]/40 flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-heading font-bold text-white/70 hover:text-[#FFD700] transition-colors active:scale-95 disabled:opacity-40"
              title="Reset & seed dummy orders"
            >
              {seeding ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
              Seed
            </button>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger
                data-testid="date-range-dropdown"
                className="h-11 w-44 glass rounded-xl text-sm font-medium border-white/10 hover:border-[#FFD700]/40 focus:ring-[#FFD700] focus:ring-offset-0"
              >
                <div className="flex items-center gap-2 text-[#FFD700]">
                  <Activity size={14} />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
                {RANGE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.id}
                    value={opt.id}
                    data-testid={`range-option-${opt.id}`}
                    className="focus:bg-[#FFD700]/10 focus:text-[#FFD700]"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Error banner */}
        {error && (
          <div
            className="glass rounded-2xl border border-red-500/40 bg-red-500/5 p-4 flex items-start gap-3 animate-fade-up"
            data-testid="error-banner"
          >
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-heading font-bold text-red-300">
                Gagal memuat data
              </div>
              <div className="text-white/60 text-sm mt-0.5">
                {error}. Periksa koneksi backend atau klik Refresh.
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && orders.length === 0 && (
          <div
            className="glass rounded-2xl p-8 text-center animate-fade-up"
            data-testid="empty-banner"
          >
            <div className="text-white/70 font-heading font-bold text-lg">
              Belum ada order dalam rentang ini
            </div>
            <div className="text-white/40 text-sm mt-1">
              Klik tombol <span className="text-[#FFD700] font-semibold">Seed</span>{" "}
              untuk mengisi data demo (35 order).
            </div>
          </div>
        )}

        {/* Summary KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="kpi-row">
          <KpiChip
            label="Total Order"
            value={formatInt(data.total)}
            sub={`Periode: ${rangeLabel.toLowerCase()}`}
            Icon={Package}
            accent="#FFD700"
            testid="kpi-total-orders"
          />
          <KpiChip
            label="Total Kilogram"
            value={`${formatInt(data.totalKg)} kg`}
            sub="Volume cucian"
            Icon={Scale}
            accent="#3DA5FF"
            testid="kpi-total-kg"
          />
          <KpiChip
            label="In-Progress"
            value={formatInt(inProgress)}
            sub={
              data.total > 0
                ? `${((inProgress / data.total) * 100).toFixed(0)}% masih diproses`
                : "—"
            }
            Icon={Hourglass}
            accent="#FF8A3D"
            testid="kpi-in-progress"
          />
          <KpiChip
            label="Completion Rate"
            value={`${completionRate.toFixed(1)}%`}
            sub={`${formatInt(data.stages.Selesai.count)} order selesai`}
            Icon={TrendingUp}
            accent="#7DF08F"
            testid="kpi-completion"
          />
        </section>

        {/* Pipeline stages */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-white text-lg tracking-tight">
              Pipeline Stages
            </h2>
            <span className="text-white/40 text-[11px] uppercase tracking-widest">
              {STAGE_DEFS.length} tahap
            </span>
          </div>
          <div
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
            data-testid="pipeline-stages"
          >
            {STAGE_DEFS.map((stage, idx) => (
              <StageCard
                key={stage.id}
                stage={stage}
                data={data.stages[stage.id]}
                percent={
                  data.total > 0
                    ? (data.stages[stage.id].count / data.total) * 100
                    : 0
                }
                maxCount={maxCount}
                idx={idx}
              />
            ))}
          </div>
        </section>

        {/* Throughput chart */}
        <section
          className="glass rounded-2xl p-5 md:p-6 animate-fade-up"
          data-testid="throughput-chart"
          style={{ animationDelay: "350ms" }}
        >
          <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
            <div>
              <h2 className="font-heading font-bold text-white text-lg tracking-tight">
                Throughput {rangeLabel}
              </h2>
              <p className="text-white/40 text-xs mt-0.5">{data.trendLabel}</p>
            </div>
            <div className="flex items-center gap-1.5 text-[#7DF08F] text-xs font-heading font-bold">
              <TrendingUp size={14} />
              <span>Live data</span>
            </div>
          </div>
          <div className="h-64 md:h-72 mt-4 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.trend}
                margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="throughputFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFD700" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#FFD700" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#A0A0A0", fontSize: 11, fontFamily: "Poppins" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  interval={range === "month" ? 3 : 0}
                />
                <YAxis
                  tick={{ fill: "#A0A0A0", fontSize: 11, fontFamily: "Poppins" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ stroke: "#FFD700", strokeOpacity: 0.3, strokeWidth: 1 }}
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
                <Area
                  type="monotone"
                  dataKey="orders"
                  stroke="#FFD700"
                  strokeWidth={2.5}
                  fill="url(#throughputFill)"
                  dot={{ r: 3, fill: "#FFD700", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#FFD700" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </main>
    </div>
  );
}
