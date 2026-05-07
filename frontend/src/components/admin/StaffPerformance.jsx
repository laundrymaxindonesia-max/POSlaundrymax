import { TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const STAFF_PERFORMANCE = [
  { name: "Dedi", kg: 50 },
  { name: "Rian", kg: 42 },
  { name: "Tono", kg: 38 },
  { name: "Asep", kg: 28 },
  { name: "Wawan", kg: 24 },
];

const STAFF_REPORTS = [
  { name: "Dedi Saputra", role: "Cuci Kiloan", kg: 50, orders: 18, hours: "07:30 — 16:00" },
  { name: "Rian Pratama", role: "Pengeringan", kg: 42, orders: 14, hours: "08:00 — 17:00" },
  { name: "Tono Widodo", role: "Setrika", kg: 38, orders: 22, hours: "09:00 — 18:00" },
  { name: "Asep Hidayat", role: "Packing", kg: 28, orders: 16, hours: "10:00 — 19:00" },
  { name: "Wawan Effendi", role: "Kurir", kg: 24, orders: 9, hours: "08:30 — 17:30" },
];

/**
 * StaffPerformanceChart — the bar-chart card used inside the Overview tab.
 * Shows total kilogram processed per staff today plus a compact
 * per-staff highlight grid below the chart.
 */
export function StaffPerformanceChart() {
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
            Total kilogram cucian yang diproses per pegawai.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[#FFD700] text-xs font-heading font-bold">
          <TrendingUp size={14} />
          +18% WoW
        </div>
      </div>

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
  );
}

/**
 * StaffPerformance — Admin → Laporan Pegawai.
 * Tabular performance report (kg / order count / shift hours) per staff.
 */
export default function StaffPerformance() {
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
