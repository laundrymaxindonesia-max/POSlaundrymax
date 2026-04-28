import { useState, useRef, useEffect } from "react";
import {
  Camera,
  ScanLine,
  Truck,
  Bike,
  MapPin,
  Phone,
  CheckCircle2,
  Package,
  X,
  User as UserIcon,
  Clock,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import HeaderNav from "@/components/HeaderNav";

const INITIAL_MANIFEST = [
  { id: "LND-011", customer: "Tamel", weight: "2.5 kg", time: "11:02" },
  { id: "LND-012", customer: "Tamel", weight: "3.0 kg", time: "11:05" },
  { id: "LND-013", customer: "Tamel", weight: "1.5 kg", time: "11:08" },
];

const INITIAL_DELIVERIES = [
  {
    id: "LND-005",
    customer: "Kosan Wins",
    address: "Jl. Cisitu Lama No. 24, Dago",
    phone: "0812-xxxx-4488",
    eta: "15 menit",
    items: "4 pcs · Kiloan",
  },
  {
    id: "LND-006",
    customer: "Rina Permata",
    address: "Jl. Tubagus Ismail VIII No. 7",
    phone: "0821-xxxx-1223",
    eta: "22 menit",
    items: "2 pcs · Satuan",
  },
  {
    id: "LND-007",
    customer: "Apartemen Gateway Pasteur",
    address: "Tower C Unit 1402",
    phone: "0813-xxxx-9012",
    eta: "35 menit",
    items: "6 pcs · Kiloan + Jas",
  },
];

export default function CourierDashboard() {
  const [activeTab, setActiveTab] = useState("pickup");
  const [manifest, setManifest] = useState(INITIAL_MANIFEST);
  const [deliveries, setDeliveries] = useState(INITIAL_DELIVERIES);

  // Pickup scanner
  const [scanOpen, setScanOpen] = useState(false);
  const scanTimerRef = useRef(null);

  // Delivery proof-of-delivery
  const [podOpen, setPodOpen] = useState(false);
  const [podOrder, setPodOrder] = useState(null);
  const [podCaptured, setPodCaptured] = useState(false);
  const podTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      if (podTimerRef.current) clearTimeout(podTimerRef.current);
    };
  }, []);

  const handleScanPickup = () => {
    setScanOpen(true);
    scanTimerRef.current = setTimeout(() => {
      const newId =
        "LND-" +
        String(Math.floor(Math.random() * 900) + 100).padStart(3, "0");
      const newWeight = (Math.random() * 3 + 1).toFixed(1) + " kg";
      setManifest((prev) => [
        {
          id: newId,
          customer: "Tamel",
          weight: newWeight,
          time: new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        ...prev,
      ]);
      toast.success(`Bag ${newId} masuk manifest`, {
        description: `Total ${manifest.length + 1} bag siap diangkut`,
      });
      setScanOpen(false);
    }, 1500);
  };

  const handleCloseScan = (open) => {
    if (!open && scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    setScanOpen(open);
  };

  const handleAngkutSemua = () => {
    if (manifest.length === 0) {
      toast.error("Manifest kosong");
      return;
    }
    toast.success(`${manifest.length} bag berhasil diangkut`, {
      description: "Menuju gudang produksi...",
    });
    setManifest([]);
  };

  const openPoD = (order) => {
    setPodOrder(order);
    setPodCaptured(false);
    setPodOpen(true);
    podTimerRef.current = setTimeout(() => {
      setPodCaptured(true);
    }, 900);
  };

  const confirmDelivery = () => {
    if (!podCaptured || !podOrder) return;
    setDeliveries((prev) => prev.filter((d) => d.id !== podOrder.id));
    toast.success("Order Selesai Diantar!", {
      description: `${podOrder.id} · ${podOrder.customer}`,
    });
    setPodOpen(false);
    setPodOrder(null);
    setPodCaptured(false);
  };

  const handleClosePod = (open) => {
    if (!open) {
      if (podTimerRef.current) {
        clearTimeout(podTimerRef.current);
        podTimerRef.current = null;
      }
      setPodOrder(null);
      setPodCaptured(false);
    }
    setPodOpen(open);
  };

  return (
    <div
      className="relative min-h-screen text-white font-body max-w-md mx-auto md:border-x md:border-white/5"
      data-testid="courier-screen"
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 glass-strong border-b border-white/10 px-4 py-3 flex items-center justify-between gap-2"
        data-testid="courier-header"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFD700] flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.35)]">
            <Truck size={18} className="text-black" strokeWidth={2.5} />
          </div>
          <div>
            <div
              className="font-heading font-extrabold text-[#FFD700] text-base leading-none tracking-tight"
              data-testid="courier-title"
            >
              LaundryMax
            </div>
            <div className="text-white/50 text-[10px] uppercase tracking-[0.15em] mt-0.5">
              Courier
            </div>
          </div>
        </div>
        <HeaderNav />
      </header>

      <main
        className={`px-4 pt-5 space-y-5 ${
          activeTab === "pickup" ? "pb-40" : "pb-8"
        }`}
      >
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList
            className="w-full h-auto p-1.5 glass rounded-2xl grid grid-cols-2 gap-1"
            data-testid="courier-tabs-list"
          >
            <TabsTrigger
              value="pickup"
              data-testid="tab-pickup"
              className="flex items-center justify-center gap-2 py-3.5 px-2 rounded-xl text-white/60 text-sm font-heading font-bold data-[state=active]:bg-[#FFD700] data-[state=active]:text-black data-[state=active]:shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all"
            >
              <Truck size={18} strokeWidth={2.5} />
              <span>JEMPUT</span>
            </TabsTrigger>
            <TabsTrigger
              value="delivery"
              data-testid="tab-delivery"
              className="flex items-center justify-center gap-2 py-3.5 px-2 rounded-xl text-white/60 text-sm font-heading font-bold data-[state=active]:bg-[#FFD700] data-[state=active]:text-black data-[state=active]:shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all"
            >
              <Bike size={18} strokeWidth={2.5} />
              <span>ANTAREUN</span>
            </TabsTrigger>
          </TabsList>

          {/* ============= PICKUP TAB ============= */}
          <TabsContent value="pickup" className="mt-5 space-y-5">
            {/* Massive scan button */}
            <button
              onClick={handleScanPickup}
              data-testid="scan-pickup-button"
              className="w-full rounded-3xl border-2 border-dashed border-[#FFD700]/50 bg-[#FFD700]/5 hover:bg-[#FFD700]/15 hover:border-[#FFD700] transition-all active:scale-[0.98] p-8 flex flex-col items-center gap-4 pulse-yellow animate-fade-up"
            >
              <div className="w-20 h-20 rounded-full bg-[#FFD700]/20 border border-[#FFD700]/40 flex items-center justify-center">
                <Camera
                  size={38}
                  strokeWidth={2.25}
                  className="text-[#FFD700]"
                />
              </div>
              <div className="text-center">
                <div className="font-heading font-black text-[#FFD700] text-xl tracking-tight">
                  SCAN BARANG PICKUP
                </div>
                <div className="text-[#FFD700]/70 text-[11px] uppercase tracking-widest font-medium mt-1.5">
                  Scan QR tag setiap bag
                </div>
              </div>
            </button>

            {/* Manifest Angkutan */}
            <section className="animate-fade-up" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading font-bold text-white text-lg tracking-tight">
                  Manifest Angkutan
                </h2>
                <div
                  className="px-2.5 py-1 rounded-full bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700] text-[10px] font-heading font-bold uppercase tracking-widest"
                  data-testid="manifest-count-badge"
                >
                  {manifest.length} Bags
                </div>
              </div>

              {manifest.length === 0 ? (
                <div
                  className="glass rounded-2xl p-8 flex flex-col items-center gap-2 text-white/40 text-sm"
                  data-testid="manifest-empty"
                >
                  <Package size={32} strokeWidth={1.5} />
                  <span>Belum ada bag yang discan</span>
                </div>
              ) : (
                <div className="space-y-2" data-testid="manifest-list">
                  {manifest.map((bag, idx) => (
                    <div
                      key={`${bag.id}-${idx}`}
                      data-testid={`manifest-row-${bag.id}`}
                      className="glass rounded-2xl p-4 flex items-center justify-between animate-fade-up"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/25 flex items-center justify-center flex-shrink-0">
                          <Package
                            size={16}
                            className="text-[#FFD700]"
                            strokeWidth={2.25}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-heading font-bold text-white text-sm tracking-tight">
                            {bag.id}
                          </div>
                          <div className="text-white/40 text-[11px]">
                            {bag.customer} · {bag.time}
                          </div>
                        </div>
                      </div>
                      <span className="font-heading font-bold text-[#FFD700] text-sm">
                        {bag.weight}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          {/* ============= DELIVERY TAB ============= */}
          <TabsContent value="delivery" className="mt-5 space-y-4">
            <div className="flex items-center justify-between animate-fade-up">
              <h2 className="font-heading font-bold text-white text-lg tracking-tight">
                Siap Antar
              </h2>
              <div
                className="px-2.5 py-1 rounded-full bg-[#7DF08F]/15 border border-[#7DF08F]/30 text-[#B4F5BF] text-[10px] font-heading font-bold uppercase tracking-widest"
                data-testid="delivery-count-badge"
              >
                {deliveries.length} Order
              </div>
            </div>

            {deliveries.length === 0 ? (
              <div
                className="glass rounded-2xl p-10 flex flex-col items-center gap-2 text-white/40 text-sm"
                data-testid="delivery-empty"
              >
                <CheckCircle2 size={36} strokeWidth={1.5} className="text-[#7DF08F]" />
                <span className="text-white/60 font-heading font-bold">
                  Semua order sudah diantar
                </span>
                <span className="text-[11px]">Mantap! Istirahat dulu.</span>
              </div>
            ) : (
              <div className="space-y-3" data-testid="delivery-list">
                {deliveries.map((order, idx) => (
                  <div
                    key={order.id}
                    data-testid={`delivery-card-${order.id}`}
                    className="glass rounded-2xl p-4 space-y-3 animate-fade-up border-white/10"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-extrabold text-white text-base tracking-tight">
                            {order.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#7DF08F]/15 border border-[#7DF08F]/30 text-[#B4F5BF] text-[9px] font-heading font-bold uppercase tracking-widest">
                            Siap Antar
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-white/80 text-sm mt-1.5 font-medium">
                          <UserIcon size={13} className="text-[#FFD700]" />
                          {order.customer}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 text-[#FFD700] text-xs font-heading font-bold">
                          <Clock size={12} />
                          {order.eta}
                        </div>
                        <div className="text-white/40 text-[10px] mt-0.5">
                          {order.items}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-start gap-2 text-white/60">
                        <MapPin size={13} className="mt-0.5 flex-shrink-0 text-white/40" />
                        <span className="leading-snug">{order.address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/60">
                        <Phone size={13} className="text-white/40" />
                        <span>{order.phone}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => openPoD(order)}
                      data-testid={`pod-button-${order.id}`}
                      className="w-full h-12 rounded-xl bg-[#FFD700] text-black font-heading font-extrabold text-sm tracking-wide flex items-center justify-center gap-2 hover:bg-[#ffdf33] transition-all active:scale-[0.97] shadow-[0_6px_20px_rgba(255,215,0,0.25)]"
                    >
                      <Camera size={16} strokeWidth={2.5} />
                      BUKTI TERIMA (SELESAI)
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Sticky bottom bar — only for pickup tab */}
      {activeTab === "pickup" && (
        <div
          className="fixed bottom-0 inset-x-0 max-w-md mx-auto z-40 glass-strong border-t border-white/10 rounded-t-3xl px-4 pt-4 pb-5 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
          data-testid="pickup-sticky-bar"
        >
          <button
            onClick={handleAngkutSemua}
            disabled={manifest.length === 0}
            data-testid="angkut-semua-button"
            className="w-full h-14 rounded-2xl bg-[#FFD700] text-black font-heading font-extrabold text-base tracking-wide flex items-center justify-center gap-2.5 transition-all active:scale-[0.97] hover:bg-[#ffdf33] disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_8px_30px_rgba(255,215,0,0.3)]"
          >
            <Truck size={20} strokeWidth={2.5} />
            ANGKUT SEMUA ({manifest.length} BAGS)
          </button>
        </div>
      )}

      {/* Pickup Scanner Modal */}
      <Dialog open={scanOpen} onOpenChange={handleCloseScan}>
        <DialogContent
          className="bg-[#0a0a0a] border-white/10 text-white max-w-sm rounded-3xl p-5"
          data-testid="pickup-scanner-modal"
        >
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-[#FFD700] flex items-center gap-2">
              <ScanLine size={18} />
              Scan Bag Pickup
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              Sorot QR code pada tag bag cucian pelanggan.
            </DialogDescription>
          </DialogHeader>

          <div className="relative aspect-square rounded-2xl overflow-hidden bg-black border border-white/10">
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
            <div className="absolute inset-10 pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-[#FFD700] rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-[#FFD700] rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-[#FFD700] rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-[#FFD700] rounded-br-xl" />
              <div className="absolute inset-x-0 top-0 h-full overflow-hidden">
                <div
                  className="absolute inset-x-2 h-[3px] bg-gradient-to-r from-transparent via-[#FFD700] to-transparent animate-scan-line shadow-[0_0_16px_rgba(255,215,0,0.9)]"
                  data-testid="pickup-scanner-line"
                />
              </div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <div className="font-mono text-[10px] text-[#FFD700]/70 uppercase tracking-[0.25em]">
                Arahkan ke QR Code
              </div>
            </div>
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center font-mono text-[9px] text-white/40 uppercase tracking-widest">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] animate-pulse" />
                LIVE
              </span>
              <span>CAM · PICKUP</span>
            </div>
          </div>

          <button
            onClick={() => handleCloseScan(false)}
            data-testid="pickup-cancel-scan"
            className="w-full h-11 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2 mt-1"
          >
            <X size={14} /> Batal
          </button>
        </DialogContent>
      </Dialog>

      {/* Proof of Delivery Modal */}
      <Dialog open={podOpen} onOpenChange={handleClosePod}>
        <DialogContent
          className="bg-[#111111] border-white/10 text-white max-w-sm rounded-3xl"
          data-testid="pod-modal"
        >
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-[#FFD700]">
              Bukti Terima
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              {podOrder
                ? `${podOrder.id} · ${podOrder.customer}`
                : "Ambil foto bukti serah terima ke pelanggan."}
            </DialogDescription>
          </DialogHeader>

          <div
            className="aspect-square rounded-2xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 flex items-center justify-center overflow-hidden relative"
            data-testid="pod-viewport"
          >
            {!podCaptured ? (
              <div className="flex flex-col items-center gap-3 text-white/60">
                <div className="w-16 h-16 rounded-full border-4 border-[#FFD700]/40 border-t-[#FFD700] animate-spin" />
                <div className="text-xs uppercase tracking-widest">
                  Mengambil foto bukti...
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-[#FFD700]">
                <CheckCircle2 size={56} strokeWidth={2} />
                <div className="font-heading font-bold">Foto tersimpan</div>
                <div className="text-[11px] text-white/50 font-mono">
                  pod_{podOrder?.id}_{Date.now()}.jpg
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-1">
            <button
              onClick={() => handleClosePod(false)}
              data-testid="pod-cancel-button"
              className="flex-1 h-12 rounded-xl bg-white/5 border border-white/10 text-white/80 font-medium hover:bg-white/10 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={confirmDelivery}
              disabled={!podCaptured}
              data-testid="pod-confirm-button"
              className="flex-1 h-12 rounded-xl bg-[#FFD700] text-black font-heading font-extrabold hover:bg-[#ffdf33] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
            >
              <CheckCircle2 size={16} /> Selesai
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
