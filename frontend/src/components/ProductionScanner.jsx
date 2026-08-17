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
  AlertTriangle,
  Loader2,
  RefreshCw,
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
import QrScanner from "@/components/QrScanner";
import { fetchOrders, fetchOrderById, patchOrderStatus, parseQrPayload } from "@/lib/api";
import { getActorTag, getCurrentStaff } from "@/lib/staffSession";

const STATIONS = [
  {
    id: "wash",
    label: "WASH",
    subtitle: "Cuci Basah",
    Icon: Waves,
    glow: "from-[#3DA5FF]/20 to-transparent",
    ring: "#3DA5FF",
    sourceStatus: "Antrian",
    targetStatus: "Cuci",
  },
  {
    id: "dry",
    label: "DRY",
    subtitle: "Pengeringan",
    Icon: Flame,
    glow: "from-[#FF8A3D]/20 to-transparent",
    ring: "#FF8A3D",
    sourceStatus: "Cuci",
    targetStatus: "Kering",
  },
  {
    id: "iron",
    label: "IRON",
    subtitle: "Setrika",
    Icon: Shirt,
    glow: "from-[#FFD700]/25 to-transparent",
    ring: "#FFD700",
    sourceStatus: "Kering",
    targetStatus: "Setrika",
  },
  {
    id: "pack",
    label: "PACK",
    subtitle: "Packing",
    Icon: Package,
    glow: "from-[#7DF08F]/20 to-transparent",
    ring: "#7DF08F",
    sourceStatus: "Setrika",
    targetStatus: "Packing",
  },
];

const STATUS_STYLE = {
  WASH: "bg-[#3DA5FF]/15 text-[#7FC1FF] border-[#3DA5FF]/30",
  DRY: "bg-[#FF8A3D]/15 text-[#FFB98C] border-[#FF8A3D]/30",
  IRON: "bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/30",
  PACK: "bg-[#7DF08F]/15 text-[#B4F5BF] border-[#7DF08F]/30",
  READY: "bg-white/10 text-white/70 border-white/20",
};

// Map backend order_status → station label shown in the Recent scans list
const STATUS_TO_LABEL = {
  Cuci: "WASH",
  Kering: "DRY",
  Setrika: "IRON",
  Packing: "PACK",
  OTW: "READY",
  Selesai: "READY",
};

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return "--:--";
  }
}

export default function ProductionScanner() {
  const [scanOpen, setScanOpen] = useState(false);
  const [activeStation, setActiveStation] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);
  const currentStaff = getCurrentStaff();

  const loadRecent = async () => {
    setLoading(true);
    try {
      // Pull a mix of orders currently mid-pipeline so the list is useful
      const rows = await fetchOrders({ limit: 80 });
      const filtered = (rows || [])
        .filter((o) => ["Cuci", "Kering", "Setrika", "Packing"].includes(o.order_status))
        .slice(0, 12)
        .map((o) => {
          const lastEvent = (o.order_events || []).slice(-1)[0];
          return {
            id: o.order_id,
            customer: o.customer_name,
            status: STATUS_TO_LABEL[o.order_status] || o.order_status,
            backendStatus: o.order_status,
            time: formatTime(lastEvent?.timestamp || o.created_at),
          };
        });
      setRecentScans(filtered);
    } catch (e) {
      toast.error(`Gagal memuat order: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecent();
  }, []);

  const handleStationClick = (station) => {
    setActiveStation(station);
    setScanOpen(true);
  };

  const busyRef = useRef(false);

  const handleQrDecoded = async (decoded) => {
    if (busyRef.current) return;
    const orderId = parseQrPayload(decoded);
    if (!orderId) {
      toast.error("QR tidak dikenali");
      return;
    }
    if (!activeStation) return;
    busyRef.current = true;
    try {
      const order = await fetchOrderById(orderId);
      if (order.order_status !== activeStation.sourceStatus) {
        toast.error(`${orderId} bukan di antrian ${activeStation.label}`, {
          description: `Status saat ini: ${order.order_status}. Butuh ${activeStation.sourceStatus}.`,
        });
        return;
      }
      const updated = await patchOrderStatus(
        orderId,
        activeStation.targetStatus,
        getActorTag() || "produksi"
      );
      toast.success(`${orderId} → ${activeStation.label}`, {
        description: `Oleh ${currentStaff?.name || "staff"}`,
      });
      setRecentScans((prev) => [
        {
          id: updated.order_id,
          customer: updated.customer_name,
          status: activeStation.label,
          backendStatus: updated.order_status,
          time: new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        ...prev.filter((s) => s.id !== updated.order_id).slice(0, 11),
      ]);
      // Close after a successful scan so next bag can be scanned fresh
      setScanOpen(false);
      setActiveStation(null);
    } catch (e) {
      if (e.status === 404) {
        toast.error(`Order ${orderId} tidak ditemukan di database`);
      } else {
        toast.error(`Gagal update: ${e.message}`);
      }
    } finally {
      // small cooldown so a single QR isn't decoded twice in quick succession
      setTimeout(() => {
        busyRef.current = false;
      }, 800);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCloseScanner = (open) => {
    setScanOpen(open);
    if (!open) setActiveStation(null);
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
              {currentStaff?.name && (
                <span className="text-white/30"> · {currentStaff.name}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRecent}
            disabled={loading}
            data-testid="production-refresh"
            className="h-9 w-9 rounded-full bg-white/5 border border-white/10 hover:border-[#FFD700]/40 text-white/60 hover:text-[#FFD700] flex items-center justify-center transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
          <HeaderNav />
        </div>
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

      {/* Real QR Scanner */}
      <QrScanner
        open={scanOpen}
        onOpenChange={handleCloseScanner}
        onScan={handleQrDecoded}
        title={`Scan tag · ${activeStation?.label || ""}`}
        helper={
          activeStation
            ? `Sorot QR tag cucian di antrian ${activeStation.sourceStatus}`
            : "Pilih stasiun terlebih dahulu"
        }
      />
    </div>
  );
}
