import { useState, useEffect, useRef } from "react";
import {
  Waves,
  Flame,
  Shirt,
  Package,
  ScanLine,
  X,
  Factory,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import HeaderNav from "@/components/HeaderNav";

const STATIONS = [
  {
    id: "wash",
    label: "WASH",
    subtitle: "Cuci Basah",
    Icon: Waves,
    glow: "from-[#3DA5FF]/20 to-transparent",
    ring: "#3DA5FF",
  },
  {
    id: "dry",
    label: "DRY",
    subtitle: "Pengeringan",
    Icon: Flame,
    glow: "from-[#FF8A3D]/20 to-transparent",
    ring: "#FF8A3D",
  },
  {
    id: "iron",
    label: "IRON",
    subtitle: "Setrika",
    Icon: Shirt,
    glow: "from-[#FFD700]/25 to-transparent",
    ring: "#FFD700",
  },
  {
    id: "pack",
    label: "PACK",
    subtitle: "Packing",
    Icon: Package,
    glow: "from-[#7DF08F]/20 to-transparent",
    ring: "#7DF08F",
  },
];

const STATUS_STYLE = {
  WASH: "bg-[#3DA5FF]/15 text-[#7FC1FF] border-[#3DA5FF]/30",
  DRY: "bg-[#FF8A3D]/15 text-[#FFB98C] border-[#FF8A3D]/30",
  IRON: "bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/30",
  PACK: "bg-[#7DF08F]/15 text-[#B4F5BF] border-[#7DF08F]/30",
  READY: "bg-white/10 text-white/70 border-white/20",
};

const INITIAL_SCANS = [
  { id: "LND-001", customer: "Budi Santoso", status: "IRON", time: "10:42" },
  { id: "LND-002", customer: "Siti Rahayu", status: "DRY", time: "10:31" },
  { id: "LND-003", customer: "Andi Wijaya", status: "WASH", time: "10:18" },
  { id: "LND-004", customer: "Ratna Dewi", status: "PACK", time: "09:55" },
  { id: "LND-005", customer: "Rudi Hartono", status: "READY", time: "09:40" },
];

export default function ProductionScanner() {
  const [scanOpen, setScanOpen] = useState(false);
  const [activeStation, setActiveStation] = useState(null);
  const [recentScans, setRecentScans] = useState(INITIAL_SCANS);
  const timerRef = useRef(null);

  const handleStationClick = (station) => {
    setActiveStation(station);
    setScanOpen(true);
    timerRef.current = setTimeout(() => {
      const scannedOrderId =
        "LND-" + String(Math.floor(Math.random() * 900) + 100).padStart(3, "0");
      toast.success(`Order ${scannedOrderId} Status Updated!`, {
        description: `Dipindahkan ke stasiun ${station.label}`,
      });
      setRecentScans((prev) => [
        {
          id: scannedOrderId,
          customer: "Pelanggan Baru",
          status: station.label,
          time: new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        ...prev.slice(0, 9),
      ]);
      setScanOpen(false);
      setActiveStation(null);
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCloseModal = (open) => {
    if (!open && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      setActiveStation(null);
    }
    setScanOpen(open);
  };

  const activeOrdersCount = recentScans.filter(
    (s) => s.status !== "READY"
  ).length;

  return (
    <div
      className="relative min-h-screen text-white font-body max-w-md mx-auto md:border-x md:border-white/5"
      data-testid="production-scanner"
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 glass-strong border-b border-white/10 px-4 py-3 flex items-center justify-between gap-2"
        data-testid="production-header"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFD700] flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.35)]">
            <Factory size={18} className="text-black" strokeWidth={2.5} />
          </div>
          <div>
            <div
              className="font-heading font-extrabold text-[#FFD700] text-base leading-none tracking-tight"
              data-testid="production-title"
            >
              LaundryMax
            </div>
            <div className="text-white/50 text-[10px] uppercase tracking-[0.15em] mt-0.5">
              Production · <span className="text-[#FFD700]" data-testid="active-orders-count">{activeOrdersCount}</span> aktif
            </div>
          </div>
        </div>
        <HeaderNav />
      </header>

      <main className="px-4 pt-5 pb-8 space-y-6">
        {/* Intro */}
        <section className="animate-fade-up">
          <div className="text-white/50 text-xs uppercase tracking-widest font-medium mb-1.5">
            Pilih Stasiun
          </div>
          <h1 className="font-heading font-black text-white text-3xl leading-tight tracking-tight">
            Scan & <span className="text-[#FFD700]">Update Status</span>
          </h1>
          <p className="text-white/50 text-sm mt-2 leading-relaxed">
            Tap stasiun di bawah, arahkan kamera ke QR code pada tag cucian.
          </p>
        </section>

        {/* 2x2 Station grid */}
        <section
          className="grid grid-cols-2 gap-3"
          data-testid="station-grid"
        >
          {STATIONS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => handleStationClick(s)}
              data-testid={`station-${s.id}`}
              className="group relative aspect-square rounded-3xl overflow-hidden border border-white/10 bg-[#141414] hover:border-[#FFD700]/50 transition-all duration-300 active:scale-[0.96] animate-fade-up shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {/* Ambient glow */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${s.glow} opacity-60 group-hover:opacity-100 transition-opacity`}
              />
              {/* Subtle diagonal line texture */}
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 8px)",
                }}
              />
              {/* Content */}
              <div className="relative h-full flex flex-col items-start justify-between p-5">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center border"
                  style={{
                    backgroundColor: `${s.ring}18`,
                    borderColor: `${s.ring}40`,
                    boxShadow: `0 0 24px ${s.ring}25`,
                  }}
                >
                  <s.Icon
                    size={28}
                    strokeWidth={2.25}
                    style={{ color: s.ring }}
                  />
                </div>
                <div className="text-left">
                  <div className="font-heading font-black text-white text-2xl leading-none tracking-tight group-hover:text-[#FFD700] transition-colors">
                    {s.label}
                  </div>
                  <div className="text-white/40 text-[11px] uppercase tracking-widest mt-1.5 font-medium">
                    {s.subtitle}
                  </div>
                </div>
              </div>
              {/* Corner accent */}
              <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full animate-corner-blink" style={{ backgroundColor: s.ring }} />
            </button>
          ))}
        </section>

        {/* Recent scans list */}
        <section className="animate-fade-up" style={{ animationDelay: "320ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-bold text-white text-lg tracking-tight">
              Recent Scans
            </h2>
            <span className="text-white/40 text-[11px] uppercase tracking-widest">
              {recentScans.length} order
            </span>
          </div>
          <div className="space-y-2" data-testid="recent-scans-list">
            {recentScans.map((scan, idx) => (
              <div
                key={`${scan.id}-${idx}`}
                className="glass rounded-2xl p-4 flex items-center justify-between hover:bg-white/[0.06] transition-colors animate-fade-up"
                style={{ animationDelay: `${idx * 40}ms` }}
                data-testid={`scan-row-${scan.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <ScanLine
                      size={16}
                      className="text-white/60"
                      strokeWidth={2.25}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-heading font-bold text-white text-sm tracking-tight truncate">
                      {scan.id}
                    </div>
                    <div className="text-white/40 text-[11px] truncate">
                      {scan.customer} · {scan.time}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-heading font-bold uppercase tracking-widest border flex-shrink-0 ${
                    STATUS_STYLE[scan.status] || STATUS_STYLE.READY
                  }`}
                  data-testid={`status-badge-${scan.id}`}
                >
                  {scan.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Scanner Dialog */}
      <Dialog open={scanOpen} onOpenChange={handleCloseModal}>
        <DialogContent
          className="bg-[#0a0a0a] border-white/10 text-white max-w-sm rounded-3xl p-5"
          data-testid="scanner-modal"
        >
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-[#FFD700] flex items-center gap-2">
              <ScanLine size={18} />
              Scanning — {activeStation?.label}
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              Sorot QR code tag cucian untuk memperbarui status stasiun.
            </DialogDescription>
          </DialogHeader>

          {/* Scanner viewport */}
          <div
            className="relative aspect-square rounded-2xl overflow-hidden bg-black border border-white/10"
            data-testid="scanner-viewport"
          >
            {/* Simulated camera noise */}
            <div
              className="absolute inset-0 opacity-50"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(255,215,0,0.08) 0%, rgba(0,0,0,0.95) 70%)",
              }}
            />
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              }}
            />

            {/* QR frame corners */}
            <div className="absolute inset-10 pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-[#FFD700] rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-[#FFD700] rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-[#FFD700] rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-[#FFD700] rounded-br-xl" />

              {/* Scanning line */}
              <div className="absolute inset-x-0 top-0 h-full overflow-hidden">
                <div
                  className="absolute inset-x-2 h-[3px] bg-gradient-to-r from-transparent via-[#FFD700] to-transparent animate-scan-line shadow-[0_0_16px_rgba(255,215,0,0.9)]"
                  data-testid="scanner-line"
                />
              </div>
            </div>

            {/* Center indicator */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <div className="font-mono text-[10px] text-[#FFD700]/70 uppercase tracking-[0.25em]">
                Arahkan ke QR Code
              </div>
            </div>

            {/* Bottom stats */}
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center font-mono text-[9px] text-white/40 uppercase tracking-widest">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] animate-pulse" />
                LIVE
              </span>
              <span>CAM_01 · {activeStation?.label}</span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-center gap-2 text-white/50 text-xs">
            <CheckCircle2 size={14} className="text-[#FFD700]" />
            <span>Auto-confirm dalam 1.5 detik...</span>
          </div>

          <button
            onClick={() => handleCloseModal(false)}
            data-testid="cancel-scan-button"
            className="w-full h-11 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2 mt-1"
          >
            <X size={14} /> Batal
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
