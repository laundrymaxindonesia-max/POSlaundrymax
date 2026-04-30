import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Phone, MapPin, NotebookPen } from "lucide-react";
import { toast } from "sonner";

export default function RegularCustomerModal({
  open,
  onOpenChange,
  name,
  setName,
  wa,
  setWa,
  address,
  setAddress,
  onSave,
}) {
  const handleSave = () => {
    const n = name.trim();
    const w = wa.trim();
    const a = address.trim();
    if (!n) return toast.error("Isi nama lengkap dulu");
    if (!w) return toast.error("Isi nomor WhatsApp dulu");
    if (!a) return toast.error("Isi alamat dulu");
    onSave({ name: n, wa: w, address: a });
    toast.success("Data pelanggan reguler berhasil disimpan!", {
      description: `${n} · ${w}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#111111] border-white/10 text-white max-w-md rounded-3xl"
        data-testid="regular-customer-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-heading font-bold text-[#FFD700] flex items-center gap-2">
            <NotebookPen size={18} />
            Data Pelanggan Baru (Reguler)
          </DialogTitle>
          <DialogDescription className="text-white/50 text-xs">
            Simpan kontak & alamat agar kurir bisa antar-jemput dengan tepat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-white/50 text-[10px] uppercase tracking-widest mb-1.5 block font-medium">
              Nama Lengkap
            </label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FFD700]" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama lengkap pelanggan"
                data-testid="reg-cust-name-input"
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-[#0a0a0a] border border-white/10 focus:border-[#FFD700]/50 focus:outline-none text-white text-sm transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-white/50 text-[10px] uppercase tracking-widest mb-1.5 block font-medium">
              Nomor WhatsApp
            </label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FFD700]" />
              <input
                type="tel"
                value={wa}
                onChange={(e) => setWa(e.target.value)}
                placeholder="08xxxxxxxxxx"
                data-testid="reg-cust-wa-input"
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-[#0a0a0a] border border-white/10 focus:border-[#FFD700]/50 focus:outline-none text-white text-sm font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-white/50 text-[10px] uppercase tracking-widest mb-1.5 block font-medium">
              Alamat Lengkap / Nama Kosan & No. Kamar
            </label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-3 text-[#FFD700]" />
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Jl. ... / Kosan ... Kamar No. ..."
                data-testid="reg-cust-address-input"
                rows={3}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0a0a0a] border border-white/10 focus:border-[#FFD700]/50 focus:outline-none text-white text-sm transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onOpenChange(false)}
            data-testid="reg-cust-cancel-button"
            className="flex-1 h-12 rounded-xl bg-white/5 border border-white/10 text-white/80 font-medium hover:bg-white/10 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            data-testid="reg-cust-save-button"
            className="flex-1 h-12 rounded-xl bg-[#FFD700] text-black font-heading font-extrabold flex items-center justify-center gap-2 hover:bg-[#ffdf33] active:scale-95 transition-all shadow-[0_8px_30px_rgba(255,215,0,0.25)]"
          >
            <NotebookPen size={16} strokeWidth={2.5} />
            Simpan Data
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
