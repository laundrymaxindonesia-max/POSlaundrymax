import { useState } from "react";
import {
  LayoutDashboard,
  Tags,
  Users,
  Building2,
  ShieldCheck,
  Wallet,
  Scale,
  Hourglass,
  ShoppingBag,
  LogOut,
  Menu,
  X,
  Mail,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import HeaderNav from "@/components/HeaderNav";
import { useAuth } from "@/lib/AuthContext";
import PricingTable from "@/components/admin/PricingTable";
import B2BQuotas from "@/components/admin/B2BQuotas";
import StaffPerformance, {
  StaffPerformanceChart,
} from "@/components/admin/StaffPerformance";
import OverdueWidget from "@/components/admin/OverdueWidget";
import ReceiptSettings from "@/components/admin/ReceiptSettings";

const ADMIN_EMAIL = "theomahrizal@gmail.com";

const SIDEBAR_ITEMS = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "pricing", label: "Pengaturan Harga", Icon: Tags },
  { id: "receipts", label: "Pengaturan Nota", Icon: Receipt },
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

      <div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        data-testid="kpi-grid"
      >
        {KPIS.map((kpi, i) => (
          <KpiCard key={kpi.id} kpi={kpi} idx={i} />
        ))}
      </div>

      <StaffPerformanceChart />
      <OverdueWidget />
    </div>
  );
}

export default function AdminDashboard() {
  const [activeView, setActiveView] = useState("overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    toast.success("Logout berhasil");
    window.location.href = "/absen";
  };

  const renderView = () => {
    switch (activeView) {
      case "pricing":
        return <PricingTable />;
      case "receipts":
        return <ReceiptSettings />;
      case "staff":
        return <StaffPerformance />;
      case "b2b":
        return <B2BQuotas />;
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
              {user?.email || ADMIN_EMAIL}
            </span>
            <span className="sm:hidden text-white/60 text-[10px] font-mono">
              {(user?.email || ADMIN_EMAIL).split("@")[0]}@…
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#E6C200] flex items-center justify-center text-black font-heading font-extrabold text-sm shadow-[0_0_15px_rgba(255,215,0,0.4)]">
            {(user?.name || "T").charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden lg:flex flex-col w-64 min-h-[calc(100vh-65px)] border-r border-white/10 px-4 py-6 sticky top-[65px] self-start">
          <SidebarContent />
        </aside>

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
