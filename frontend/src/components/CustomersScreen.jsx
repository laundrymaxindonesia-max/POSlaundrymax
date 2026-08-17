import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  Download,
  Upload,
  Search,
  Edit3,
  Loader2,
  MessageCircle,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import HeaderNav from "@/components/HeaderNav";
import {
  searchCustomers,
  createCustomer,
  updateCustomer,
  exportCustomersCsv,
  importCustomersCsv,
  fetchProspects,
  createProspect,
  updateProspect,
  convertProspect,
  deleteProspect,
  exportProspectsCsv,
  importProspectsCsv,
} from "@/lib/api";

const SOURCE_CATEGORIES = [
  "Taman Melati",
  "Walk-in Laskita",
  "B2B Kosan",
  "Antar Jemput",
  "Lainnya",
];
const TYPE_FILTERS = [
  { value: "", label: "Semua Tipe" },
  { value: "Regular", label: "Reguler" },
  { value: "Member", label: "Bulanan" },
];
const PROSPECT_STATUSES = ["Belum Ditawari", "Sudah Ditawari", "Konversi"];

const PROSPECT_STATUS_STYLE = {
  "Belum Ditawari": "bg-white/10 text-white/70 border-white/20",
  "Sudah Ditawari": "bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/30",
  Konversi: "bg-[#7DF08F]/15 text-[#B4F5BF] border-[#7DF08F]/30",
};

function download(filename, content, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function makeWaOfferLink(prospect) {
  const phone = String(prospect.phone || "").replace(/\D/g, "");
  const msg =
    `Halo *${prospect.name}*, saya dari *LaundryMax* 👋\n\n` +
    `Kami menawarkan jasa laundry cepat, harum, dan rapi mulai *Rp 7.000/kg* (Reguler) — ` +
    `atau paket *Bulanan Bulanan* mulai Rp 150.000 untuk 20 kg 🧺\n\n` +
    `Kami juga menyediakan layanan *Antar Jemput* gratis untuk area terdekat.\n\n` +
    `Boleh saya bantu buat trial dulu?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export default function CustomersScreen() {
  const [tab, setTab] = useState("active"); // "active" | "prospect"

  return (
    <div
      className="relative min-h-screen text-white font-body max-w-md mx-auto md:border-x md:border-white/5"
      data-testid="customers-screen"
    >
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#0a0a0a]/80 border-b border-white/5 px-4 py-3">
        <HeaderNav />
      </header>

      <main className="px-4 pt-4 pb-16 space-y-4">
        <div>
          <div className="text-white/50 text-[10px] uppercase tracking-widest font-medium">
            CRM
          </div>
          <h1 className="font-heading font-black text-white text-2xl tracking-tight mt-0.5">
            Daftar Pelanggan
          </h1>
          <p className="text-white/50 text-xs mt-0.5">
            Kelola database pelanggan aktif & pipeline calon pelanggan.
          </p>
        </div>

        <div
          className="grid grid-cols-2 rounded-2xl bg-white/[0.03] border border-white/10 p-1"
          data-testid="customers-tabs"
        >
          {[
            { id: "active", label: "Pelanggan Aktif", Icon: Users },
            { id: "prospect", label: "Prospek", Icon: TrendingUp },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`tab-${t.id}`}
              className={`h-11 rounded-xl font-heading font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition ${
                tab === t.id
                  ? "bg-[#FFD700] text-black shadow-[0_4px_16px_rgba(255,215,0,0.25)]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <t.Icon size={13} strokeWidth={2.5} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "active" ? <ActiveCustomersTab /> : <ProspectsTab />}
      </main>
    </div>
  );
}

// -------------------- Active tab --------------------
function ActiveCustomersTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await searchCustomers("");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error("Gagal memuat pelanggan", { description: e.message });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (sourceFilter && r.source_category !== sourceFilter) return false;
      if (typeFilter && r.type !== typeFilter) return false;
      if (q) {
        return (
          (r.name || "").toLowerCase().includes(q) ||
          (r.phone || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, query, sourceFilter, typeFilter]);

  const handleExport = async () => {
    try {
      const csv = await exportCustomersCsv();
      download(`customers-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      toast.success("CSV pelanggan diunduh");
    } catch (e) {
      toast.error("Gagal export CSV", { description: e.message });
    }
  };
  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const result = await importCustomersCsv(text);
        toast.success(
          `Import selesai: ${result.created} baru, ${result.updated} diperbarui, ${result.skipped} dilewati`
        );
        load();
      } catch (e) {
        toast.error("Gagal import CSV", { description: e.message });
      }
    };
    input.click();
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FFD700] pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama / nomor WA"
          data-testid="customer-search-input"
          className="w-full h-11 pl-10 pr-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:border-[#FFD700]/50 focus:outline-none"
        />
      </div>

      <div className="flex gap-2">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          data-testid="customer-source-filter"
          className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-white text-xs px-3"
        >
          <option value="">Semua Sumber</option>
          {SOURCE_CATEGORIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          data-testid="customer-type-filter"
          className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-white text-xs px-3"
        >
          {TYPE_FILTERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setCreating(true)}
          data-testid="customer-add-button"
          className="h-10 rounded-xl bg-[#FFD700]/15 border border-[#FFD700]/40 text-[#FFD700] text-[11px] font-heading font-bold uppercase tracking-widest flex items-center justify-center gap-1"
        >
          <UserPlus size={12} /> Tambah
        </button>
        <button
          onClick={handleExport}
          data-testid="customer-export-button"
          className="h-10 rounded-xl bg-white/5 border border-white/10 text-white/80 text-[11px] font-heading font-bold uppercase tracking-widest flex items-center justify-center gap-1 hover:border-white/25"
        >
          <Download size={12} /> Export
        </button>
        <button
          onClick={handleImport}
          data-testid="customer-import-button"
          className="h-10 rounded-xl bg-white/5 border border-white/10 text-white/80 text-[11px] font-heading font-bold uppercase tracking-widest flex items-center justify-center gap-1 hover:border-white/25"
        >
          <Upload size={12} /> Import
        </button>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="text-white/40 text-[11px]">
          {filtered.length} pelanggan
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-2xl p-10 flex items-center justify-center gap-2 text-white/60">
          <Loader2 size={16} className="animate-spin" />
          Memuat...
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="glass rounded-2xl p-10 text-center text-white/50"
          data-testid="customers-empty"
        >
          <Users size={26} strokeWidth={1.5} className="mx-auto text-white/40" />
          <div className="font-heading font-bold text-white/70 text-sm mt-2">
            Belum ada pelanggan cocok
          </div>
        </div>
      ) : (
        <div className="space-y-2" data-testid="customer-list">
          {filtered.map((c) => (
            <div
              key={c.id}
              data-testid={`customer-row-${c.id}`}
              className="glass rounded-xl p-3 flex items-center gap-3 border border-white/10"
            >
              <div className="w-10 h-10 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/25 flex items-center justify-center flex-shrink-0 text-[#FFD700] font-heading font-black">
                {(c.name || "?")[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-heading font-bold text-white text-sm truncate">
                    {c.name}
                  </span>
                  <span
                    className={`px-1.5 py-0 rounded text-[9px] font-heading font-bold uppercase tracking-wider border ${
                      c.type === "Member"
                        ? "bg-[#B36BFF]/15 text-[#D8B4FF] border-[#B36BFF]/30"
                        : "bg-white/10 text-white/70 border-white/20"
                    }`}
                  >
                    {c.type === "Member" ? "Bulanan" : "Reguler"}
                  </span>
                </div>
                <div className="text-white/50 text-[11px] mt-0.5 truncate">
                  <span className="font-mono">{c.phone}</span> ·{" "}
                  {c.source_category || "Lainnya"}
                </div>
                {c.address && (
                  <div className="text-white/40 text-[10px] mt-0.5 truncate">
                    {c.address}
                  </div>
                )}
              </div>
              <button
                onClick={() => setEditing(c)}
                data-testid={`customer-edit-${c.id}`}
                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 hover:border-[#FFD700]/40 text-white/60 hover:text-[#FFD700] flex items-center justify-center"
                title="Edit"
              >
                <Edit3 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <CustomerEditModal
          customer={editing}
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
            setEditing(null);
          }}
        />
      )}
      {creating && (
        <CustomerEditModal
          customer={{}}
          onClose={() => setCreating(false)}
          onSaved={(row) => {
            setRows((prev) => [row, ...prev]);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

// -------------------- Customer create/edit modal --------------------
function CustomerEditModal({ customer, onClose, onSaved }) {
  const isNew = !customer?.id;
  const [name, setName] = useState(customer.name || "");
  const [phone, setPhone] = useState(customer.phone || "");
  const [address, setAddress] = useState(customer.address || "");
  const [type, setType] = useState(customer.type || "Regular");
  const [source, setSource] = useState(
    customer.source_category || "Lainnya"
  );
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Nama wajib diisi");
    if (!phone.trim()) return toast.error("Nomor WA wajib diisi");
    setBusy(true);
    try {
      let row;
      if (isNew) {
        row = await createCustomer({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim() || null,
          type,
          source_category: source,
        });
        toast.success("Pelanggan baru tersimpan");
      } else {
        row = await updateCustomer(customer.id, {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim() || null,
          type,
          source_category: source,
        });
        toast.success("Perubahan tersimpan");
      }
      onSaved(row);
    } catch (e) {
      toast.error(isNew ? "Gagal simpan" : "Gagal update", {
        description: e.message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="bg-[#111111] border-white/10 text-white max-w-sm rounded-3xl"
        data-testid="customer-edit-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-heading font-bold text-[#FFD700]">
            {isNew ? "Tambah Pelanggan" : "Edit Pelanggan"}
          </DialogTitle>
          <DialogDescription className="text-white/50 text-xs">
            Perbarui nama, WA, alamat & sumber pelanggan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {[
            { key: "name", label: "Nama", value: name, set: setName, testid: "field-name" },
            { key: "phone", label: "No. WhatsApp", value: phone, set: setPhone, testid: "field-phone" },
            { key: "address", label: "Alamat Kosan / Rumah", value: address, set: setAddress, testid: "field-address" },
          ].map((f) => (
            <div key={f.key}>
              <div className="text-white/50 text-[10px] uppercase tracking-widest mb-1">
                {f.label}
              </div>
              <input
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                data-testid={f.testid}
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 focus:border-[#FFD700]/40 focus:outline-none px-3 text-white text-sm"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-white/50 text-[10px] uppercase tracking-widest mb-1">Tipe</div>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                data-testid="field-type"
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3"
              >
                <option value="Regular">Reguler</option>
                <option value="Member">Bulanan</option>
              </select>
            </div>
            <div>
              <div className="text-white/50 text-[10px] uppercase tracking-widest mb-1">Sumber</div>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                data-testid="field-source"
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3"
              >
                {SOURCE_CATEGORIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={busy}
            data-testid="customer-save-button"
            className="w-full h-12 mt-2 rounded-xl bg-[#FFD700] text-black font-heading font-extrabold text-sm tracking-wide disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {isNew ? "SIMPAN PELANGGAN" : "SIMPAN PERUBAHAN"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Prospects tab --------------------
function ProspectsTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [converting, setConverting] = useState(null); // prospect

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchProspects();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error("Gagal memuat prospek", { description: e.message });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.phone || "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const handleSendOffer = async (p) => {
    window.open(makeWaOfferLink(p), "_blank", "noopener");
    try {
      const updated = await updateProspect(p.id, { status: "Sudah Ditawari" });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success(`${p.name} ditandai sudah ditawari`);
    } catch (e) {
      toast.error("Gagal update status", { description: e.message });
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Hapus prospek ${p.name}?`)) return;
    try {
      await deleteProspect(p.id);
      setRows((prev) => prev.filter((r) => r.id !== p.id));
      toast.success("Prospek dihapus");
    } catch (e) {
      toast.error("Gagal hapus", { description: e.message });
    }
  };

  const handleExport = async () => {
    try {
      const csv = await exportProspectsCsv();
      download(`prospects-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      toast.success("CSV prospek diunduh");
    } catch (e) {
      toast.error("Gagal export", { description: e.message });
    }
  };
  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const r = await importProspectsCsv(text);
        toast.success(
          `Import: ${r.created} baru, ${r.updated} diperbarui, ${r.skipped} dilewati`
        );
        load();
      } catch (e) {
        toast.error("Gagal import", { description: e.message });
      }
    };
    input.click();
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FFD700] pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama / nomor WA prospek"
          data-testid="prospect-search-input"
          className="w-full h-11 pl-10 pr-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:border-[#FFD700]/50 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setCreating(true)}
          data-testid="prospect-add-button"
          className="h-10 rounded-xl bg-[#FFD700]/15 border border-[#FFD700]/40 text-[#FFD700] text-[10px] font-heading font-bold uppercase tracking-widest flex items-center justify-center gap-1"
        >
          <UserPlus size={12} /> Tambah
        </button>
        <button
          onClick={handleExport}
          data-testid="prospect-export-button"
          className="h-10 rounded-xl bg-white/5 border border-white/10 text-white/80 text-[10px] font-heading font-bold uppercase tracking-widest flex items-center justify-center gap-1"
        >
          <Download size={12} /> Export
        </button>
        <button
          onClick={handleImport}
          data-testid="prospect-import-button"
          className="h-10 rounded-xl bg-white/5 border border-white/10 text-white/80 text-[10px] font-heading font-bold uppercase tracking-widest flex items-center justify-center gap-1"
        >
          <Upload size={12} /> Import
        </button>
      </div>

      {loading ? (
        <div className="glass rounded-2xl p-10 flex items-center justify-center gap-2 text-white/60">
          <Loader2 size={16} className="animate-spin" /> Memuat...
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="glass rounded-2xl p-10 text-center text-white/50"
          data-testid="prospects-empty"
        >
          <Sparkles size={22} className="mx-auto text-white/40" strokeWidth={1.5} />
          <div className="font-heading font-bold text-white/70 text-sm mt-2">
            Belum ada prospek
          </div>
          <div className="text-xs">
            Tambahkan calon pelanggan lewat tombol Tambah atau Import CSV.
          </div>
        </div>
      ) : (
        <div className="space-y-2" data-testid="prospect-list">
          {filtered.map((p) => (
            <div
              key={p.id}
              data-testid={`prospect-row-${p.id}`}
              className="glass rounded-xl p-3 border border-white/10 space-y-2"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white/70 font-heading font-black">
                  {(p.name || "?")[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-heading font-bold text-white text-sm truncate">
                      {p.name}
                    </span>
                    <span
                      className={`px-1.5 py-0 rounded text-[9px] font-heading font-bold uppercase tracking-wider border ${PROSPECT_STATUS_STYLE[p.status]}`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="text-white/50 text-[11px] mt-0.5 font-mono truncate">
                    {p.phone}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(p)}
                  data-testid={`prospect-delete-${p.id}`}
                  title="Hapus"
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:border-[#FF6B6B]/40 text-white/50 hover:text-[#FFA0A0] flex items-center justify-center"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSendOffer(p)}
                  data-testid={`prospect-send-offer-${p.id}`}
                  disabled={p.status === "Konversi"}
                  className="h-9 rounded-lg bg-[#25D366]/15 border border-[#25D366]/40 text-[#25D366] text-[10px] font-heading font-bold uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-[#25D366]/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <MessageCircle size={11} /> Send Offer
                </button>
                <button
                  onClick={() => setConverting(p)}
                  data-testid={`prospect-convert-${p.id}`}
                  disabled={p.status === "Konversi"}
                  className="h-9 rounded-lg bg-[#FFD700]/15 border border-[#FFD700]/40 text-[#FFD700] text-[10px] font-heading font-bold uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-[#FFD700]/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles size={11} /> Jadikan Pelanggan
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <ProspectAddModal
          onClose={() => setCreating(false)}
          onCreated={(row) => {
            setRows((prev) => [row, ...prev]);
            setCreating(false);
          }}
        />
      )}
      {converting && (
        <ConvertProspectModal
          prospect={converting}
          onClose={() => setConverting(null)}
          onConverted={(updatedProspect) => {
            setRows((prev) =>
              prev.map((r) => (r.id === updatedProspect.id ? updatedProspect : r))
            );
            setConverting(null);
          }}
        />
      )}
    </div>
  );
}

// -------------------- Prospect add modal --------------------
function ProspectAddModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      return toast.error("Nama & WA wajib diisi");
    }
    setBusy(true);
    try {
      const row = await createProspect({
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim() || null,
      });
      toast.success("Prospek ditambahkan");
      onCreated(row);
    } catch (e) {
      toast.error("Gagal simpan", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="bg-[#111111] border-white/10 text-white max-w-sm rounded-3xl"
        data-testid="prospect-add-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-heading font-bold text-[#FFD700]">
            Tambahkan Calon Pelanggan
          </DialogTitle>
          <DialogDescription className="text-white/50 text-xs">
            Data awal untuk marketing outreach.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-white/50 text-[10px] uppercase tracking-widest mb-1">Nama</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="prospect-field-name"
              className="w-full h-11 rounded-xl bg-white/5 border border-white/10 focus:border-[#FFD700]/40 focus:outline-none px-3 text-white text-sm"
            />
          </div>
          <div>
            <div className="text-white/50 text-[10px] uppercase tracking-widest mb-1">No. WhatsApp</div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              data-testid="prospect-field-phone"
              className="w-full h-11 rounded-xl bg-white/5 border border-white/10 focus:border-[#FFD700]/40 focus:outline-none px-3 text-white text-sm"
            />
          </div>
          <div>
            <div className="text-white/50 text-[10px] uppercase tracking-widest mb-1">Catatan (opsional)</div>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="prospect-field-notes"
              className="w-full h-11 rounded-xl bg-white/5 border border-white/10 focus:border-[#FFD700]/40 focus:outline-none px-3 text-white text-sm"
              placeholder="Referral dari Andini, dsb."
            />
          </div>
          <button
            onClick={handleSave}
            disabled={busy}
            data-testid="prospect-save-button"
            className="w-full h-12 mt-2 rounded-xl bg-[#FFD700] text-black font-heading font-extrabold text-sm tracking-wide disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            SIMPAN PROSPEK
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Convert prospect → customer --------------------
function ConvertProspectModal({ prospect, onClose, onConverted }) {
  const [name, setName] = useState(prospect.name || "");
  const [phone, setPhone] = useState(prospect.phone || "");
  const [address, setAddress] = useState("");
  const [type, setType] = useState("Regular");
  const [source, setSource] = useState("Lainnya");
  const [busy, setBusy] = useState(false);

  const handleConvert = async () => {
    setBusy(true);
    try {
      await convertProspect(prospect.id, {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim() || null,
        type,
        source_category: source,
      });
      toast.success(`${name} kini pelanggan aktif`);
      onConverted({ ...prospect, status: "Konversi" });
    } catch (e) {
      toast.error("Gagal konversi", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="bg-[#111111] border-white/10 text-white max-w-sm rounded-3xl"
        data-testid="prospect-convert-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-heading font-bold text-[#FFD700]">
            Jadikan Pelanggan
          </DialogTitle>
          <DialogDescription className="text-white/50 text-xs">
            Prospek akan pindah ke tab Pelanggan Aktif.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {[
            { label: "Nama", value: name, set: setName, testid: "convert-name" },
            { label: "No. WhatsApp", value: phone, set: setPhone, testid: "convert-phone" },
            { label: "Alamat Kosan / Rumah", value: address, set: setAddress, testid: "convert-address" },
          ].map((f) => (
            <div key={f.label}>
              <div className="text-white/50 text-[10px] uppercase tracking-widest mb-1">
                {f.label}
              </div>
              <input
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                data-testid={f.testid}
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 focus:border-[#FFD700]/40 focus:outline-none px-3 text-white text-sm"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-white/50 text-[10px] uppercase tracking-widest mb-1">Tipe</div>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                data-testid="convert-type"
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3"
              >
                <option value="Regular">Reguler</option>
                <option value="Member">Bulanan</option>
              </select>
            </div>
            <div>
              <div className="text-white/50 text-[10px] uppercase tracking-widest mb-1">Sumber</div>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                data-testid="convert-source"
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3"
              >
                {SOURCE_CATEGORIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleConvert}
            disabled={busy}
            data-testid="convert-submit-button"
            className="w-full h-12 mt-2 rounded-xl bg-[#FFD700] text-black font-heading font-extrabold text-sm tracking-wide disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            KONVERSI KE PELANGGAN
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
