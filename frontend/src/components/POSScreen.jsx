import { useState, useMemo } from "react";
import {
  Minus,
  Plus,
  Camera,
  QrCode,
  User,
  Shirt,
  Scale,
  Footprints,
  ShoppingBag,
  X,
  CheckCircle2,
  Printer,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";
import HeaderNav from "@/components/HeaderNav";

const SATUAN_ITEMS = [
  { id: "kemeja", name: "Kemeja", price: 15000 },
  { id: "celana", name: "Celana", price: 15000 },
  { id: "jas", name: "Jas", price: 15000 },
  { id: "kaos", name: "Kaos", price: 15000 },
  { id: "jaket", name: "Jaket", price: 15000 },
];

const SEPATU_ITEMS = [
  { id: "sepatu", name: "Sepatu", price: 30000 },
  { id: "karpet", name: "Karpet", price: 30000 },
  { id: "tas", name: "Tas", price: 30000 },
];

const SHOWCASE_ITEMS = [
  { id: "gas", name: "Gas Isi", price: 20000 },
  { id: "air", name: "Air Mineral", price: 20000 },
  { id: "detergen", name: "Detergen Kiloan", price: 20000 },
];

const KILOAN_PRICE = 6000;

const formatIDR = (n) =>
  "Rp " + Math.round(n).toLocaleString("id-ID").replace(/,/g, ".");

const CounterBtn = ({ onClick, children, testid, variant = "default" }) => (
  <button
    onClick={onClick}
    data-testid={testid}
    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${
      variant === "primary"
        ? "bg-[#FFD700] text-black hover:bg-[#ffdf33] shadow-[0_0_20px_rgba(255,215,0,0.35)]"
        : "bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-[#FFD700]/40"
    }`}
  >
    {children}
  </button>
);

const ItemRow = ({ item, count, onInc, onDec, idx }) => (
  <div
    className="glass rounded-2xl p-4 flex items-center justify-between animate-fade-up"
    style={{ animationDelay: `${idx * 40}ms` }}
    data-testid={`item-row-${item.id}`}
  >
    <div className="flex-1 min-w-0">
      <div className="font-heading font-semibold text-white text-lg truncate">
        {item.name}
      </div>
      <div className="text-white/50 text-xs mt-0.5">
        {formatIDR(item.price)} / pcs
      </div>
    </div>
    <div className="flex items-center gap-3 ml-2">
      <CounterBtn
        onClick={onDec}
        testid={`item-counter-decrease-${item.id}`}
      >
        <Minus size={18} />
      </CounterBtn>
      <div
        className="min-w-[2rem] text-center font-heading font-bold text-2xl text-[#FFD700]"
        data-testid={`item-count-${item.id}`}
      >
        {count}
      </div>
      <CounterBtn
        onClick={onInc}
        testid={`item-counter-increase-${item.id}`}
        variant={count > 0 ? "primary" : "default"}
      >
        <Plus size={18} />
      </CounterBtn>
    </div>
  </div>
);

export default function POSScreen() {
  const [customerType, setCustomerType] = useState("walkin");
  const [activeTab, setActiveTab] = useState("kiloan");
  const [kiloanKg, setKiloanKg] = useState(0);
  const [satuanCounts, setSatuanCounts] = useState({});
  const [sepatuCounts, setSepatuCounts] = useState({});
  const [showcaseCounts, setShowcaseCounts] = useState({});
  const [photoTaken, setPhotoTaken] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [orderId, setOrderId] = useState("");

  const isMember = customerType === "member";
  const discountRate = isMember ? 0.1 : 0;

  const bumpCount = (setter) => (id, delta) => {
    setter((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const subtotal = useMemo(() => {
    let sum = kiloanKg * KILOAN_PRICE;
    SATUAN_ITEMS.forEach((i) => {
      sum += (satuanCounts[i.id] || 0) * i.price;
    });
    SEPATU_ITEMS.forEach((i) => {
      sum += (sepatuCounts[i.id] || 0) * i.price;
    });
    SHOWCASE_ITEMS.forEach((i) => {
      sum += (showcaseCounts[i.id] || 0) * i.price;
    });
    return sum;
  }, [kiloanKg, satuanCounts, sepatuCounts, showcaseCounts]);

  const discount = subtotal * discountRate;
  const total = subtotal - discount;

  const totalItemsCount =
    (kiloanKg > 0 ? 1 : 0) +
    Object.values(satuanCounts).filter((v) => v > 0).length +
    Object.values(sepatuCounts).filter((v) => v > 0).length +
    Object.values(showcaseCounts).filter((v) => v > 0).length;

  const handleTakePhoto = () => {
    setPhotoModalOpen(true);
    setTimeout(() => {
      setPhotoTaken(true);
      toast.success("Foto cucian berhasil disimpan");
    }, 900);
  };

  const handleSave = () => {
    if (total <= 0) {
      toast.error("Tambahkan item terlebih dahulu");
      return;
    }
    const id =
      "LM-" +
      new Date()
        .toISOString()
        .replace(/[-:T.Z]/g, "")
        .slice(2, 14) +
      "-" +
      Math.floor(Math.random() * 900 + 100);
    setOrderId(id);
    setQrOpen(true);
  };

  const qrPayload = JSON.stringify({
    order_id: orderId,
    customer: isMember ? "Member Kostunpad" : "Walk-in",
    total,
    items: totalItemsCount,
    ts: Date.now(),
  });

  return (
    <div
      className="relative min-h-screen text-white font-body max-w-md mx-auto md:border-x md:border-white/5"
      data-testid="pos-screen"
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 glass-strong border-b border-white/10 px-4 py-3 flex items-center justify-between gap-2"
        data-testid="pos-header"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFD700] flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.4)]">
            <Shirt size={18} className="text-black" strokeWidth={2.5} />
          </div>
          <div>
            <div
              className="font-heading font-extrabold text-[#FFD700] text-base leading-none tracking-tight"
              data-testid="header-title"
            >
              LaundryMax
            </div>
            <div className="text-white/50 text-[10px] uppercase tracking-[0.15em] mt-0.5">
              Cashier
            </div>
          </div>
        </div>
        <HeaderNav />
      </header>

      {/* Main content */}
      <main className="px-5 pt-5 pb-40 space-y-5">
        {/* Customer select */}
        <section className="animate-fade-up">
          <label className="text-white/50 text-xs uppercase tracking-widest mb-2 block font-medium">
            Tipe Pelanggan
          </label>
          <Select value={customerType} onValueChange={setCustomerType}>
            <SelectTrigger
              data-testid="customer-type-dropdown"
              className="w-full h-14 glass text-white font-medium text-base rounded-2xl border-white/10 hover:border-[#FFD700]/50 transition-colors focus:ring-[#FFD700] focus:ring-offset-0"
            >
              <div className="flex items-center gap-3">
                <User size={18} className="text-[#FFD700]" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
              <SelectItem
                value="walkin"
                data-testid="customer-option-walkin"
                className="focus:bg-[#FFD700]/10 focus:text-[#FFD700]"
              >
                Walk-in (Harga Normal)
              </SelectItem>
              <SelectItem
                value="member"
                data-testid="customer-option-member"
                className="focus:bg-[#FFD700]/10 focus:text-[#FFD700]"
              >
                Member Kostunpad (Harga Khusus)
              </SelectItem>
            </SelectContent>
          </Select>
          {isMember && (
            <div
              className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] text-xs font-semibold"
              data-testid="member-badge"
            >
              <CheckCircle2 size={12} />
              Diskon Member 10% aktif
            </div>
          )}
        </section>

        {/* Tabs */}
        <section className="animate-fade-up" style={{ animationDelay: "80ms" }}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList
              className="w-full h-auto p-1.5 glass rounded-2xl grid grid-cols-4 gap-1"
              data-testid="tabs-list"
            >
              {[
                { v: "kiloan", label: "Kiloan", icon: Scale, testid: "tab-kiloan" },
                { v: "satuan", label: "Satuan", icon: Shirt, testid: "tab-satuan" },
                {
                  v: "sepatu",
                  label: "Sepatu",
                  icon: Footprints,
                  testid: "tab-sepatu-karpet",
                },
                {
                  v: "showcase",
                  label: "Showcase",
                  icon: ShoppingBag,
                  testid: "tab-showcase",
                },
              ].map((t) => (
                <TabsTrigger
                  key={t.v}
                  value={t.v}
                  data-testid={t.testid}
                  className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-white/60 text-[11px] font-semibold data-[state=active]:bg-[#FFD700] data-[state=active]:text-black data-[state=active]:shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all"
                >
                  <t.icon size={18} strokeWidth={2.25} />
                  <span>{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Kiloan */}
            <TabsContent
              value="kiloan"
              className="mt-4 glass rounded-2xl p-6 animate-fade-up"
            >
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-heading font-bold text-xl text-white">
                  Cuci Kiloan
                </h3>
                <span className="text-[#FFD700] font-semibold text-sm">
                  {formatIDR(KILOAN_PRICE)}/kg
                </span>
              </div>
              <p className="text-white/50 text-xs mb-6">
                Atur berat cucian dalam kilogram
              </p>
              <div className="flex items-center justify-between gap-4">
                <CounterBtn
                  onClick={() => setKiloanKg((v) => Math.max(0, v - 0.5))}
                  testid="kiloan-decrease"
                >
                  <Minus size={22} />
                </CounterBtn>
                <div className="flex-1 text-center">
                  <div
                    className="font-heading font-black text-[#FFD700] text-5xl leading-none tracking-tight"
                    data-testid="kiloan-kg-display"
                  >
                    {kiloanKg.toFixed(1)}
                  </div>
                  <div className="text-white/50 text-xs uppercase tracking-widest mt-1">
                    Kilogram
                  </div>
                </div>
                <CounterBtn
                  onClick={() => setKiloanKg((v) => v + 0.5)}
                  testid="kiloan-increase"
                  variant="primary"
                >
                  <Plus size={22} />
                </CounterBtn>
              </div>
              <div className="mt-5 pt-5 border-t border-white/5 flex justify-between items-center">
                <span className="text-white/60 text-sm">Subtotal kiloan</span>
                <span
                  className="font-heading font-bold text-white text-lg"
                  data-testid="kiloan-subtotal"
                >
                  {formatIDR(kiloanKg * KILOAN_PRICE)}
                </span>
              </div>
            </TabsContent>

            {/* Satuan */}
            <TabsContent value="satuan" className="mt-4 space-y-2.5">
              {SATUAN_ITEMS.map((item, i) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  count={satuanCounts[item.id] || 0}
                  onInc={() => bumpCount(setSatuanCounts)(item.id, 1)}
                  onDec={() => bumpCount(setSatuanCounts)(item.id, -1)}
                  idx={i}
                />
              ))}
            </TabsContent>

            {/* Sepatu & Karpet */}
            <TabsContent value="sepatu" className="mt-4 space-y-2.5">
              {SEPATU_ITEMS.map((item, i) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  count={sepatuCounts[item.id] || 0}
                  onInc={() => bumpCount(setSepatuCounts)(item.id, 1)}
                  onDec={() => bumpCount(setSepatuCounts)(item.id, -1)}
                  idx={i}
                />
              ))}
            </TabsContent>

            {/* Showcase */}
            <TabsContent value="showcase" className="mt-4 space-y-2.5">
              {SHOWCASE_ITEMS.map((item, i) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  count={showcaseCounts[item.id] || 0}
                  onInc={() => bumpCount(setShowcaseCounts)(item.id, 1)}
                  onDec={() => bumpCount(setShowcaseCounts)(item.id, -1)}
                  idx={i}
                />
              ))}
            </TabsContent>
          </Tabs>
        </section>

        {/* Evidence / photo button */}
        <section className="animate-fade-up" style={{ animationDelay: "160ms" }}>
          <button
            onClick={handleTakePhoto}
            data-testid="photo-upload-button"
            className={`w-full p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all duration-300 active:scale-[0.98] ${
              photoTaken
                ? "border-[#FFD700] bg-[#FFD700]/15 text-[#FFD700]"
                : "border-[#FFD700]/50 bg-[#FFD700]/5 text-[#FFD700] hover:bg-[#FFD700]/15 hover:border-[#FFD700] pulse-yellow"
            }`}
          >
            <div className="w-14 h-14 rounded-full bg-[#FFD700]/20 flex items-center justify-center">
              {photoTaken ? (
                <CheckCircle2 size={28} strokeWidth={2.25} />
              ) : (
                <Camera size={28} strokeWidth={2.25} />
              )}
            </div>
            <div className="text-center">
              <div className="font-heading font-extrabold text-lg tracking-tight">
                {photoTaken ? "FOTO TERSIMPAN" : "AMBIL FOTO CUCIAAN"}
              </div>
              <div className="text-[11px] text-[#FFD700]/70 mt-1 uppercase tracking-widest font-medium">
                {photoTaken
                  ? "Tap untuk ambil ulang"
                  : "Wajib sebagai bukti terima"}
              </div>
            </div>
          </button>
        </section>
      </main>

      {/* Sticky bottom bar */}
      <div
        className="fixed bottom-0 inset-x-0 max-w-md mx-auto z-50 glass-strong border-t border-white/10 rounded-t-3xl px-5 pt-4 pb-5 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
        data-testid="sticky-bottom-bar"
      >
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-white/50 text-[11px] uppercase tracking-widest font-medium">
              Total Harga
              {isMember && subtotal > 0 && (
                <span className="ml-1.5 text-[#FFD700] normal-case tracking-normal">
                  (−{formatIDR(discount)})
                </span>
              )}
            </div>
            <div
              className="font-heading font-black text-[#FFD700] text-3xl leading-none tracking-tight mt-1"
              data-testid="total-price-display"
            >
              {formatIDR(total)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-white/50 text-[11px] uppercase tracking-widest font-medium">
              Item
            </div>
            <div className="font-heading font-bold text-white text-lg mt-1">
              {totalItemsCount}
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          data-testid="save-print-button"
          disabled={total <= 0}
          className="w-full h-14 rounded-2xl bg-[#FFD700] text-black font-heading font-extrabold text-base tracking-wide flex items-center justify-center gap-2.5 transition-all active:scale-[0.97] hover:bg-[#ffdf33] disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_8px_30px_rgba(255,215,0,0.3)]"
        >
          <QrCode size={20} strokeWidth={2.5} />
          SIMPAN & CETAK QR CODE
        </button>
      </div>

      {/* Photo capture modal (mock R2 upload) */}
      <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
        <DialogContent className="bg-[#111111] border-white/10 text-white max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-[#FFD700]">
              Kamera Bukti Cucian
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              Foto sedang diunggah ke object storage sebagai bukti terima.
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-square rounded-2xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 flex items-center justify-center overflow-hidden relative">
            {!photoTaken ? (
              <div className="flex flex-col items-center gap-3 text-white/60">
                <div className="w-16 h-16 rounded-full border-4 border-[#FFD700]/40 border-t-[#FFD700] animate-spin" />
                <div className="text-xs uppercase tracking-widest">
                  Mengunggah ke R2...
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-[#FFD700]">
                <CheckCircle2 size={56} strokeWidth={2} />
                <div className="font-heading font-bold">Tersimpan</div>
                <div className="text-[11px] text-white/50 font-mono">
                  evidence_{Date.now()}.jpg
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setPhotoModalOpen(false)}
            className="w-full h-12 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            data-testid="close-photo-modal"
          >
            <X size={16} /> Tutup
          </button>
        </DialogContent>
      </Dialog>

      {/* QR Code modal */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="bg-[#111111] border-white/10 text-white max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-[#FFD700] text-xl">
              Order Tersimpan
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              Scan QR code berikut di stasiun produksi untuk memperbarui status.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="bg-white p-4 rounded-2xl shadow-[0_0_40px_rgba(255,215,0,0.2)]">
              <QRCodeCanvas
                value={qrPayload || "LAUNDRYMAX"}
                size={200}
                bgColor="#FFFFFF"
                fgColor="#000000"
                level="M"
                data-testid="qr-code-canvas"
              />
            </div>
            <div className="text-center space-y-1">
              <div
                className="font-mono text-[#FFD700] text-sm tracking-wider"
                data-testid="order-id-display"
              >
                {orderId}
              </div>
              <div className="text-white/50 text-xs">
                {isMember ? "Member Kostunpad" : "Walk-in"} · {totalItemsCount}{" "}
                item
              </div>
              <div className="font-heading font-bold text-white text-2xl pt-1">
                {formatIDR(total)}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                toast.success("Struk dicetak");
              }}
              className="flex-1 h-12 rounded-xl bg-[#FFD700] text-black font-heading font-bold hover:bg-[#ffdf33] transition-colors flex items-center justify-center gap-2 active:scale-95"
              data-testid="print-receipt-button"
            >
              <Printer size={16} /> Cetak
            </button>
            <button
              onClick={() => {
                setQrOpen(false);
                setKiloanKg(0);
                setSatuanCounts({});
                setSepatuCounts({});
                setShowcaseCounts({});
                setPhotoTaken(false);
                toast.success("Transaksi baru siap");
              }}
              className="flex-1 h-12 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
              data-testid="new-order-button"
            >
              Order Baru
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
