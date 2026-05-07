import { CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SOURCE_OPTIONS } from "@/components/pos/data";

/**
 * OrderSource — segmented dropdown for picking the order origin
 * (Walk-in / Outlet Tamel / Anter Jemput / Kosan Kerjasama).
 * Also surfaces the per-source min-kg hint and the 10% Kosan
 * discount badge when applicable.
 */
export default function OrderSource({
  sumberOrder,
  setSumberOrder,
  isMember,
  minKg,
  selectedSource,
}) {
  return (
    <div>
      <label className="text-white/50 text-xs uppercase tracking-widest mb-2 block font-medium">
        Sumber Order
      </label>
      <Select value={sumberOrder} onValueChange={setSumberOrder}>
        <SelectTrigger
          data-testid="sumber-order-dropdown"
          className="w-full h-14 glass text-white font-medium text-base rounded-2xl border-white/10 hover:border-[#FFD700]/50 transition-colors focus:ring-[#FFD700] focus:ring-offset-0"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
          {SOURCE_OPTIONS.map((opt) => (
            <SelectItem
              key={opt.id}
              value={opt.id}
              data-testid={`sumber-option-${opt.id}`}
              className="focus:bg-[#FFD700]/10 focus:text-[#FFD700] py-3"
            >
              <div className="flex items-center gap-2.5">
                <opt.Icon size={15} />
                <div>
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-[10px] text-white/40">{opt.sub}</div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isMember && (
        <div
          className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] text-xs font-semibold"
          data-testid="member-badge"
        >
          <CheckCircle2 size={12} />
          Diskon Kosan Kerjasama 10% aktif
        </div>
      )}
      {minKg > 0 && (
        <div className="mt-2 text-white/40 text-[11px]" data-testid="min-kg-hint">
          Min. kiloan untuk {selectedSource.label}: {minKg.toFixed(1)} kg
        </div>
      )}
    </div>
  );
}
