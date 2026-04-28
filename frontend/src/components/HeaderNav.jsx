import { NavLink } from "react-router-dom";
import { Store, Factory, Truck, ShieldCheck } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Kasir", Icon: Store, testid: "nav-cashier" },
  { to: "/production", label: "Produksi", Icon: Factory, testid: "nav-production" },
  { to: "/courier", label: "Kurir", Icon: Truck, testid: "nav-courier" },
  { to: "/admin", label: "Admin", Icon: ShieldCheck, testid: "nav-admin" },
];

export default function HeaderNav() {
  return (
    <div
      className="glass rounded-full p-1 flex items-center gap-0.5"
      data-testid="header-nav"
    >
      {ITEMS.map(({ to, label, Icon, testid }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          data-testid={testid}
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-2.5 h-9 rounded-full text-[11px] font-heading font-bold uppercase tracking-wider transition-all active:scale-95 ${
              isActive
                ? "bg-[#FFD700] text-black shadow-[0_0_15px_rgba(255,215,0,0.4)]"
                : "text-white/60 hover:text-white"
            }`
          }
        >
          <Icon size={14} strokeWidth={2.5} />
          <span className="hidden md:inline">{label}</span>
        </NavLink>
      ))}
    </div>
  );
}
