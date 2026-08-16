import { useEffect, useState } from "react";
import {
  Loader2,
  Save,
  ArrowUp,
  ArrowDown,
  Zap,
  QrCode,
  Store,
  Receipt,
  Printer,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { printReceipt, RECEIPT_MODELS } from "@/lib/receiptPrinter";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SLOT_META = {
  speed: {
    label: "Banner Kecepatan",
    hint: "REGULER / FLASH!! / EXPRESS!!! — tampil paling menonjol",
    Icon: Zap,
    accent: "#FFD700",
  },
  qr: {
    label: "QR Code Tracking",
    hint: "Pelanggan scan untuk cek status order sendiri",
    Icon: QrCode,
    accent: "#7DF08F",
  },
  logo: {
    label: "Logo & Info Toko",
    hint: "Nama toko + alamat + nomor telepon",
    Icon: Store,
    accent: "#3DA5FF",
  },
};

const DEFAULT_SETTINGS = {
  header_order: ["speed", "qr", "logo"],
  store_name: "LAUNDRYMAX",
  store_address: "Jl. Contoh No. 1, Bandung",
  store_phone: "0812-3456-7890",
  footer_message: "Terima kasih! Simpan struk sebagai bukti klaim.",
  paper_width: "58mm",
};

// Sample order used for the "Preview cetak" buttons — kept identical shape
// to the real POS printReceipt payload so admin can eyeball formatting.
const SAMPLE_ORDER = {
  id: "LND-2999",
  customer: "Rina Permata",
  phone: "0812-1122-3344",
  cashier: "Erfa",
  dateLabel: new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }),
  speedTier: "flash",
  serviceLabel: "Cuci Kiloan · Flash (1 Hari)",
  items_detail: "Cuci Kiloan - Flash (1 Hari) - 3.0kg",
  weight_kg: 3.0,
  notes: "Jangan dicampur dengan handuk. Setrika hangat saja.",
  qrPayload: "LND-2999",
  paymentStatus: "lunas",
  bagIndex: 1,
  bagTotal: 2,
  items: [
    { name: "Cuci Kiloan · Flash", qty: "3.0 kg", subtotal: 30000 },
    { name: "Kemeja ×2", qty: "2 pcs", subtotal: 45000 },
  ],
  subtotal: 75000,
  discount: 0,
  total: 75000,
};

export default function ReceiptSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/receipt-settings`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSettings({ ...DEFAULT_SETTINGS, ...data });
    } catch (e) {
      toast.error("Gagal memuat pengaturan nota", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const moveSlot = (idx, dir) => {
    setSettings((s) => {
      const arr = [...s.header_order];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return s;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...s, header_order: arr };
    });
  };

  const setField = (key, value) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/receipt-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fresh = await res.json();
      setSettings({ ...DEFAULT_SETTINGS, ...fresh });
      toast.success("Pengaturan nota tersimpan", {
        description: "Semua nota berikutnya pakai layout baru.",
      });
    } catch (e) {
      toast.error("Gagal menyimpan", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const preview = (model) => {
    const w = printReceipt(SAMPLE_ORDER, model, settings);
    if (!w) {
      toast.error("Pop-up diblokir browser", {
        description: "Izinkan pop-up untuk domain ini agar bisa cetak.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-white/50 text-xs uppercase tracking-widest font-medium">
            Master Data
          </div>
          <h1 className="font-heading font-black text-white text-2xl md:text-3xl tracking-tight mt-1">
            Pengaturan Nota Thermal
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Atur urutan header, teks toko, dan lebar kertas — semua nota
            berikutnya di POS, Produksi, dan Kurir mengikuti layout ini.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          data-testid="receipt-refresh-btn"
          className="h-9 w-9 rounded-full bg-white/5 border border-white/10 hover:border-[#FFD700]/40 text-white/60 hover:text-[#FFD700] flex items-center justify-center transition-colors disabled:opacity-40"
          title="Muat ulang"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* --------- Header ordering --------- */}
        <section
          className="glass rounded-2xl p-5 animate-fade-up"
          data-testid="header-order-card"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#FFD700]/15 border border-[#FFD700]/30 flex items-center justify-center">
              <Receipt size={16} className="text-[#FFD700]" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-white text-base">
                Urutan Header Nota
              </h2>
              <p className="text-white/40 text-[11px]">
                Slot paling atas dicetak paling dulu di kertas
              </p>
            </div>
          </div>
          <ol className="space-y-2">
            {settings.header_order.map((slotId, i) => {
              const meta = SLOT_META[slotId];
              if (!meta) return null;
              const { Icon, label, hint, accent } = meta;
              return (
                <li
                  key={slotId}
                  data-testid={`slot-row-${slotId}`}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="w-8 text-center font-heading font-black text-lg text-[#FFD700]">
                    {i + 1}
                  </div>
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center border"
                    style={{
                      backgroundColor: `${accent}18`,
                      borderColor: `${accent}40`,
                    }}
                  >
                    <Icon size={16} style={{ color: accent }} strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-heading font-bold text-white text-sm">
                      {label}
                    </div>
                    <div className="text-white/40 text-[11px] truncate">
                      {hint}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveSlot(i, -1)}
                      disabled={i === 0}
                      data-testid={`slot-up-${slotId}`}
                      aria-label={`Naikkan ${label}`}
                      className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:border-[#FFD700]/40 text-white/70 hover:text-[#FFD700] flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      onClick={() => moveSlot(i, +1)}
                      disabled={i === settings.header_order.length - 1}
                      data-testid={`slot-down-${slotId}`}
                      aria-label={`Turunkan ${label}`}
                      className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:border-[#FFD700]/40 text-white/70 hover:text-[#FFD700] flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      <ArrowDown size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="text-white/40 text-[11px] mt-3">
            💡 Contoh urutan yang disarankan:{" "}
            <b className="text-white/70">Banner Kecepatan → QR → Logo</b> agar
            staf produksi langsung sadar SLA order.
          </p>
        </section>

        {/* --------- Store info + paper --------- */}
        <section
          className="glass rounded-2xl p-5 animate-fade-up space-y-3"
          data-testid="store-info-card"
        >
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#3DA5FF]/15 border border-[#3DA5FF]/30 flex items-center justify-center">
              <Store size={16} className="text-[#3DA5FF]" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-white text-base">
                Info Toko & Kertas
              </h2>
              <p className="text-white/40 text-[11px]">
                Teks & lebar cetak thermal
              </p>
            </div>
          </div>

          {[
            { key: "store_name", label: "Nama Toko", max: 48 },
            { key: "store_address", label: "Alamat", max: 120 },
            { key: "store_phone", label: "Telp / WA Support", max: 32 },
            { key: "footer_message", label: "Pesan Kaki Nota", max: 160 },
          ].map((f) => (
            <label key={f.key} className="block">
              <span className="text-white/50 text-[11px] uppercase tracking-wider font-medium">
                {f.label}
              </span>
              <input
                type="text"
                value={settings[f.key] || ""}
                onChange={(e) => setField(f.key, e.target.value.slice(0, f.max))}
                data-testid={`store-input-${f.key}`}
                className="mt-1 w-full h-10 px-3 rounded-lg bg-[#0a0a0a] border border-white/10 focus:border-[#FFD700] focus:outline-none text-white text-sm"
              />
            </label>
          ))}

          <div>
            <span className="text-white/50 text-[11px] uppercase tracking-wider font-medium">
              Lebar Kertas
            </span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {["58mm", "80mm"].map((w) => (
                <button
                  key={w}
                  onClick={() => setField("paper_width", w)}
                  data-testid={`paper-${w}`}
                  className={`h-11 rounded-xl font-heading font-bold text-sm transition-all ${
                    settings.paper_width === w
                      ? "bg-[#FFD700] text-black shadow-[0_0_15px_rgba(255,215,0,0.3)]"
                      : "bg-white/5 border border-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* --------- Preview cetak (3 model) --------- */}
      <section
        className="glass rounded-2xl p-5 animate-fade-up"
        data-testid="preview-card"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-[#7DF08F]/15 border border-[#7DF08F]/30 flex items-center justify-center">
            <Printer size={16} className="text-[#7DF08F]" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-white text-base">
              Uji Cetak Layout Baru
            </h2>
            <p className="text-white/40 text-[11px]">
              Preview pakai order contoh — hasil akan sama saat POS/Produksi cetak
              order beneran
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {RECEIPT_MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => preview(m.id)}
              data-testid={`preview-${m.id}`}
              className="text-left rounded-xl border border-white/10 hover:border-[#FFD700]/40 bg-white/[0.02] hover:bg-[#FFD700]/[0.06] p-4 transition-all group"
            >
              <div className="flex items-center gap-2 mb-1">
                <Printer size={14} className="text-[#FFD700]" />
                <div className="font-heading font-bold text-white text-sm">
                  {m.label}
                </div>
              </div>
              <div className="text-white/50 text-[11px] leading-snug">
                {m.desc}
              </div>
              <div className="mt-3 text-[10px] font-heading font-bold text-[#FFD700] tracking-widest uppercase">
                Preview cetak →
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="flex justify-end sticky bottom-0 pt-2">
        <button
          onClick={save}
          disabled={saving || loading}
          data-testid="save-receipt-settings"
          className="h-12 px-6 rounded-xl bg-[#FFD700] text-black font-heading font-extrabold text-sm tracking-wide flex items-center justify-center gap-2 hover:bg-[#ffdf33] transition-all active:scale-[0.97] shadow-[0_8px_30px_rgba(255,215,0,0.3)] disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> MENYIMPAN...
            </>
          ) : (
            <>
              <Save size={16} strokeWidth={2.5} /> SIMPAN PENGATURAN NOTA
            </>
          )}
        </button>
      </div>
    </div>
  );
}
