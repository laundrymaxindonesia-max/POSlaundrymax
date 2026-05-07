import { Minus, Plus } from "lucide-react";
import { formatIDR } from "@/components/pos/data";
import CounterBtn from "@/components/pos/CounterBtn";

/**
 * ItemRow — single product row used in Satuan / Sepatu / Showcase tabs.
 * `multiplier` adjusts the displayed price for speed-tier (Flash ×1.5, Express ×2.0).
 * Showcase passes multiplier=1 (flat retail price).
 */
export default function ItemRow({
  item,
  count,
  onInc,
  onDec,
  idx,
  multiplier = 1,
}) {
  const effectivePrice = Math.round(item.price * multiplier);
  return (
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
          {multiplier !== 1 ? (
            <>
              <span className="line-through text-white/30 mr-1">
                {formatIDR(item.price)}
              </span>
              <span
                className="text-[#FFD700] font-semibold"
                data-testid={`item-price-${item.id}`}
              >
                {formatIDR(effectivePrice)}
              </span>{" "}
              <span className="text-white/40">/ pcs</span>
            </>
          ) : (
            <span data-testid={`item-price-${item.id}`}>
              {formatIDR(effectivePrice)} / pcs
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 ml-2">
        <CounterBtn onClick={onDec} testid={`item-counter-decrease-${item.id}`}>
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
}
