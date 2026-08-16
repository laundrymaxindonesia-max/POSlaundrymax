import { useEffect, useState } from "react";
import { TrendingUp, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fetchOrders, fetchStaff } from "@/lib/api";

/**
 * Aggregate real per-staff KG throughput by walking each order's audit trail:
 * every event with `kind === undefined` and an `actor` marks work on that
 * order — we credit the weight_kg (or 1 unit for non-kiloan) once per staff
 * per order. Only Produksi + Kurir roles show up.
 */
function computePerformance(orders, staffRows) {
  const staffMap = {};
  for (const s of staffRows || []) {
    if (!s?.name) continue;
    staffMap[s.name.toLowerCase()] = {
      name: s.name,
      role: s.display_role || s.role,
      kg: 0,
      orders: 0,
      _seen: new Set(),
    };
  }
  for (const o of orders || []) {
    const kg = Number(o.weight_kg) || 0;
    for (const ev of o.order_events || []) {
      const actor = (ev.actor || "").toLowerCase();
      // actor strings look like "kasir-Erfa" or "kurir-Budi"
      const match = actor.match(/(?:kasir|kurir|produksi|staff|packing|operator)-(.+)$/);
      const nameKey = (match ? match[1] : actor).toLowerCase();
      const entry = staffMap[nameKey];
      if (!entry) continue;
      if (entry._seen.has(o.order_id)) continue;
      entry._seen.add(o.order_id);
      entry.kg += kg || 1; // credit 1 unit if no weight
      entry.orders += 1;
    }
  }
  return Object.values(staffMap)
    .map(({ _seen, ...rest }) => ({
      ...rest,
      kg: Math.round(rest.kg * 10) / 10,
    }))
    .sort((a, b) => b.kg - a.kg);
}

function useStaffPerformance() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [orders, staff] = await Promise.all([
          fetchOrders({ limit: 200 }),
          fetchStaff(),
        ]);
        setRows(computePerformance(orders, staff));
      } catch (e) {
        toast.error("Gagal memuat performa pegawai", { description: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  return { rows, loading };
}

/**
 * StaffPerformanceChart — bar-chart card used on Admin → Overview.
 */
export function StaffPerformanceChart() {
  const { rows, loading } = useStaffPerformance();
  const chartData = rows.slice(0, 6);

  return (
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
            Live · dihitung dari audit trail order database.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[#FFD700] text-xs font-heading font-bold">
          <TrendingUp size={14} />
          {rows.length} staff aktif
        </div>
      </div>

      <div className="h-64 mt-4 -ml-2">
        {loading ? (
          <div className="h-full flex items-center justify-center gap-2 text-white/60">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Memuat performa...</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-1 text-white/50">
            <Users size={24} strokeWidth={1.5} />
            <div className="text-sm font-heading font-bold text-white/70 mt-1">
              Belum ada aktivitas
            </div>
            <div className="text-xs">
              Data muncul setelah staff scan atau proses order.
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="30%">
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
        )}
      </div>

      {!loading && chartData.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {chartData.slice(0, 5).map((s, i) => (
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
      )}
    </div>
  );
}

/**
 * StaffPerformance — Admin → Laporan Pegawai (table view).
 */
export default function StaffPerformance() {
  const { rows, loading } = useStaffPerformance();

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
          Performa harian per pegawai · dihitung dari audit-trail order.
        </p>
      </div>

      {loading ? (
        <div
          className="glass rounded-2xl p-10 flex items-center justify-center gap-2 text-white/60"
          data-testid="staff-report-loading"
        >
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Memuat performa pegawai...</span>
        </div>
      ) : rows.length === 0 ? (
        <div
          className="glass rounded-2xl p-10 flex flex-col items-center justify-center gap-2 text-white/50"
          data-testid="staff-report-empty"
        >
          <Users size={28} strokeWidth={1.5} />
          <div className="font-heading font-bold text-white/70 text-sm mt-2">
            Belum ada aktivitas pegawai
          </div>
          <div className="text-xs">
            Data akan muncul setelah kasir/produksi/kurir mengerjakan order.
          </div>
        </div>
      ) : (
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
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.name}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                  data-testid={`staff-row-${s.name.toLowerCase()}`}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
