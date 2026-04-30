import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Package, Calendar, CheckCircle2 } from "lucide-react";
import { STAGES } from "@/components/pos/data";

function TrackingProgress({ stage }) {
  return (
    <div className="space-y-3">
      <div className="relative px-2 pt-8 pb-2">
        <div className="absolute left-6 right-6 top-12 h-1 bg-white/10 rounded-full" />
        <div
          className="absolute left-6 top-12 h-1 bg-gradient-to-r from-[#FFD700] to-[#FFE966] rounded-full transition-all duration-700"
          style={{
            width: `calc((100% - 48px) * ${stage / (STAGES.length - 1)})`,
          }}
        />
        <div className="relative flex justify-between">
          {STAGES.map((s, i) => {
            const done = i <= stage;
            return (
              <div
                key={s}
                className="flex flex-col items-center gap-2 flex-1"
                data-testid={`track-stage-${i}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    done
                      ? "bg-[#FFD700] border-[#FFD700] text-black shadow-[0_0_12px_rgba(255,215,0,0.5)]"
                      : "bg-[#1a1a1a] border-white/15 text-white/40"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 size={14} strokeWidth={2.5} />
                  ) : (
                    <span className="text-[10px] font-heading font-bold">{i + 1}</span>
                  )}
                </div>
                <span
                  className={`text-[9px] font-heading font-bold uppercase tracking-wider text-center leading-tight ${
                    done ? "text-[#FFD700]" : "text-white/40"
                  }`}
                >
                  {s}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TrackingModal({ order, onClose }) {
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="bg-[#111111] border-white/10 text-white max-w-md rounded-3xl"
        data-testid="tracking-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-heading font-bold text-[#FFD700] flex items-center gap-2">
            <Package size={18} />
            {order?.id}
          </DialogTitle>
          <DialogDescription className="text-white/60 text-xs flex items-center gap-2">
            <span>{order?.customer}</span>
            <span className="text-white/30">·</span>
            <span>{order?.kg} kg</span>
            <span className="text-white/30">·</span>
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {order?.date}
            </span>
          </DialogDescription>
        </DialogHeader>
        {order && <TrackingProgress stage={order.stage} />}
        <div className="p-3 rounded-xl bg-[#FFD700]/5 border border-[#FFD700]/20 text-xs text-white/70 leading-relaxed">
          Status saat ini:{" "}
          <span className="font-heading font-bold text-[#FFD700]">
            {order && STAGES[order.stage]}
          </span>
          . Estimasi selesai dalam{" "}
          {order && Math.max(1, STAGES.length - 1 - order.stage)} tahap lagi.
        </div>
        <button
          onClick={onClose}
          className="w-full h-11 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
          data-testid="tracking-close"
        >
          Tutup
        </button>
      </DialogContent>
    </Dialog>
  );
}
