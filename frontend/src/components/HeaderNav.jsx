import { NavLink } from "react-router-dom";
import {
  Store,
  Factory,
  Truck,
  ShieldCheck,
  LineChart,
  Fingerprint,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const ITEMS = [
  { to: "/", label: "Kasir", Icon: Store, testid: "nav-cashier", ownerOnly: false },
  { to: "/production", label: "Produksi", Icon: Factory, testid: "nav-production", ownerOnly: false },
  { to: "/courier", label: "Kurir", Icon: Truck, testid: "nav-courier", ownerOnly: false },
  { to: "/dashboard", label: "Dashboard", Icon: LineChart, testid: "nav-dashboard", ownerOnly: true },
  { to: "/absen", label: "Absensi", Icon: Fingerprint, testid: "nav-absen", ownerOnly: false },
  { to: "/admin", label: "Admin", Icon: ShieldCheck, testid: "nav-admin", ownerOnly: true },
];

export default function HeaderNav() {
  const { user } = useAuth();
  const visible = ITEMS.filter((i) => (i.ownerOnly ? !!user : true));

  return (
    <div
      className="glass rounded-full p-1 flex items-center gap-0.5 overflow-x-auto no-scrollbar max-w-full"
      data-testid="header-nav"
    >
      {visible.map(({ to, label, Icon, testid }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          data-testid={testid}
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-2 sm:px-2.5 h-9 rounded-full text-[11px] font-heading font-bold uppercase tracking-wider transition-all active:scale-95 flex-shrink-0 ${
              isActive
                ? "bg-[#FFD700] text-black shadow-[0_0_15px_rgba(255,215,0,0.4)]"
                : "text-white/60 hover:text-white"
            }`
          }
        >
          <Icon size={14} strokeWidth={2.5} />
          <span className="hidden lg:inline">{label}</span>
        </NavLink>
      ))}
    </div>
  );
}
