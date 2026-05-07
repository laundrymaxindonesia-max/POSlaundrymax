import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Plus,
  Minus,
  Scale,
  Shirt,
  Footprints,
  ShoppingBag,
  Package,
  ChevronDown,
  ChevronUp,
  Crown,
  Sparkles,
  Star,
} from "lucide-react";
import {
  KILOAN_DETAIL_ITEMS,
  SATUAN_ITEMS,
  SEPATU_ITEMS,
  SHOWCASE_ITEMS,
  TIER_STYLE,
  formatIDR,
} from "@/components/pos/data";
import CounterBtn from "@/components/pos/CounterBtn";
import ItemRow from "@/components/pos/ItemRow";

/**
 * ServiceTabs — the 4-tab service selector (Kiloan / Satuan / Sepatu / Showcase).
 *
 * The Kiloan tab has its own keypad + collapsible state and a per-membership
 * deduction helper. Satuan & Sepatu apply the active speed multiplier to
 * their per-item base prices; Showcase keeps a flat retail price.
 *
 * All state is owned by the parent (POSScreen). This component is purely
 * presentational; callers pass setters / handlers directly.
 */
export default function ServiceTabs({
  // tab state
  activeTab,
  setActiveTab,
  // kiloan
  kiloanKg,
  kiloanInput,
  kiloanRate,
  minKg,
  speedTierDef,
  speedMultiplier,
  handleKiloanIncrement,
  handleKiloanDecrement,
  handleKiloanInputChange,
  handleKiloanInputBlur,
  // kiloan optional detail
  showKiloanDetail,
  setShowKiloanDetail,
  kiloanDetail,
  bumpKiloanDetail,
  // satuan / sepatu / showcase
  satuanCounts,
  bumpSatuan,
  sepatuCounts,
  bumpSepatu,
  showcaseCounts,
  bumpShowcase,
  // membership helper
  usingMembership,
  activeMember,
  memberRemainingAfter,
}) {
  return (
    <section className="animate-fade-up" style={{ animationDelay: "120ms" }}>
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
        <TabsContent value="kiloan" className="mt-4 animate-fade-up">
          {kiloanKg <= 0 ? (
            <button
              type="button"
              onClick={handleKiloanIncrement}
              data-testid="kiloan-add-button"
              className="group w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl glass border border-dashed border-[#FFD700]/30 hover:border-[#FFD700]/60 hover:bg-[#FFD700]/[0.04] transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#FFD700]/15 border border-[#FFD700]/30 flex items-center justify-center flex-shrink-0 group-hover:bg-[#FFD700] group-hover:text-black transition-colors">
                  <Plus
                    size={20}
                    className="text-[#FFD700] group-hover:text-black"
                    strokeWidth={2.5}
                  />
                </div>
                <div className="text-left min-w-0">
                  <div className="font-heading font-extrabold text-white text-sm tracking-tight">
                    Tambah Cuci Kiloan
                  </div>
                  <div className="text-white/40 text-[11px] mt-0.5">
                    Mulai {minKg.toFixed(1)} kg · {formatIDR(kiloanRate)}/kg ·{" "}
                    <span style={{ color: speedTierDef.accent }}>
                      {speedTierDef.label}
                    </span>
                  </div>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-widest font-heading font-bold text-[#FFD700]/70 flex-shrink-0">
                Opsional
              </span>
            </button>
          ) : (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-heading font-bold text-xl text-white">
                  Cuci Kiloan
                </h3>
                <span className="text-[#FFD700] font-semibold text-sm">
                  {formatIDR(kiloanRate)}/kg
                </span>
              </div>
              <p className="text-white/50 text-xs mb-5">
                Atur berat cucian · min {minKg.toFixed(1)} kg ·{" "}
                <span
                  className="font-semibold"
                  style={{ color: speedTierDef.accent }}
                  data-testid="kiloan-active-speed-label"
                >
                  {speedTierDef.label} ({speedTierDef.sub})
                </span>
              </p>
              <div className="flex items-center justify-between gap-3">
                <CounterBtn
                  onClick={handleKiloanDecrement}
                  testid="kiloan-decrease"
                  disabled={kiloanKg <= 0}
                >
                  <Minus size={22} />
                </CounterBtn>
                <div className="flex-1 text-center">
                  <div className="relative flex items-baseline justify-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={kiloanInput}
                      onChange={handleKiloanInputChange}
                      onBlur={handleKiloanInputBlur}
                      data-testid="kiloan-manual-input"
                      className="w-28 bg-transparent text-center font-heading font-black text-[#FFD700] text-5xl leading-none tracking-tight focus:outline-none border-b-2 border-transparent focus:border-[#FFD700]/40 transition-colors"
                    />
                    <span className="font-heading font-bold text-white/40 text-lg">
                      kg
                    </span>
                  </div>
                  <div
                    className="text-white/50 text-[10px] uppercase tracking-widest mt-1.5"
                    data-testid="kiloan-kg-display"
                  >
                    Kilogram
                  </div>
                </div>
                <CounterBtn
                  onClick={handleKiloanIncrement}
                  testid="kiloan-increase"
                  variant="primary"
                >
                  <Plus size={22} />
                </CounterBtn>
              </div>
              <div className="mt-5 pt-4 border-t border-white/5 flex justify-between items-center">
                <span className="text-white/60 text-sm">Subtotal kiloan</span>
                <span
                  className="font-heading font-bold text-white text-lg"
                  data-testid="kiloan-subtotal"
                >
                  {formatIDR(kiloanKg * kiloanRate)}
                </span>
              </div>
            </div>
          )}

          {kiloanKg > 0 && usingMembership && (
            <div
              className={`mt-3 p-3 rounded-xl border ${TIER_STYLE[activeMember.tier].bg} ${TIER_STYLE[activeMember.tier].border}`}
              data-testid="membership-helper"
            >
              <div className="flex items-start gap-2.5">
                {activeMember.tier === "Platinum" ? (
                  <Crown size={14} className={TIER_STYLE[activeMember.tier].text} />
                ) : activeMember.tier === "Gold" ? (
                  <Sparkles
                    size={14}
                    className={TIER_STYLE[activeMember.tier].text}
                  />
                ) : (
                  <Star size={14} className={TIER_STYLE[activeMember.tier].text} />
                )}
                <div className="flex-1 text-xs leading-relaxed">
                  <span className="text-white/70">
                    Akan memotong sisa kuota membership.
                  </span>{" "}
                  <span
                    className={`font-heading font-bold ${TIER_STYLE[activeMember.tier].text}`}
                  >
                    −{kiloanKg.toFixed(1)} kg
                  </span>
                  <div className="text-white/40 text-[10px] mt-0.5">
                    Sisa setelah order: {memberRemainingAfter.toFixed(1)} kg
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Optional kiloan detail */}
          {kiloanKg > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <button
                onClick={() => setShowKiloanDetail((v) => !v)}
                data-testid="toggle-kiloan-detail"
                className="w-full flex items-center justify-between px-3 h-11 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#FFD700]/30 text-sm transition-all"
              >
                <span className="flex items-center gap-2 text-white/80 font-medium">
                  <Package size={14} className="text-[#FFD700]" />
                  Hitung Detail Item (Opsional)
                </span>
                {showKiloanDetail ? (
                  <ChevronUp size={16} className="text-white/50" />
                ) : (
                  <ChevronDown size={16} className="text-white/50" />
                )}
              </button>
              {showKiloanDetail && (
                <div
                  className="mt-3 p-3 rounded-xl bg-black/30 border border-white/5 space-y-2 animate-fade-up"
                  data-testid="kiloan-detail-list"
                >
                  <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium px-1">
                    Catat isi bag · tidak mempengaruhi harga
                  </p>
                  {KILOAN_DETAIL_ITEMS.map((item) => {
                    const c = kiloanDetail[item.id] || 0;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between px-2 py-1.5"
                        data-testid={`kiloan-detail-${item.id}`}
                      >
                        <span className="text-white/80 text-sm">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => bumpKiloanDetail(item.id, -1)}
                            data-testid={`kiloan-detail-dec-${item.id}`}
                            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
                          >
                            <Minus size={14} />
                          </button>
                          <span
                            className="min-w-[1.5rem] text-center font-heading font-bold text-[#FFD700] text-sm"
                            data-testid={`kiloan-detail-count-${item.id}`}
                          >
                            {c}
                          </span>
                          <button
                            onClick={() => bumpKiloanDetail(item.id, 1)}
                            data-testid={`kiloan-detail-inc-${item.id}`}
                            className={`w-8 h-8 rounded-lg border flex items-center justify-center active:scale-90 transition-all ${
                              c > 0
                                ? "bg-[#FFD700] text-black border-[#FFD700]"
                                : "bg-white/5 border-white/10 hover:bg-white/10"
                            }`}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="satuan" className="mt-4 space-y-2.5">
          {SATUAN_ITEMS.map((item, i) => (
            <ItemRow
              key={item.id}
              item={item}
              count={satuanCounts[item.id] || 0}
              onInc={() => bumpSatuan(item.id, 1)}
              onDec={() => bumpSatuan(item.id, -1)}
              idx={i}
              multiplier={speedMultiplier}
            />
          ))}
        </TabsContent>
        <TabsContent value="sepatu" className="mt-4 space-y-2.5">
          {SEPATU_ITEMS.map((item, i) => (
            <ItemRow
              key={item.id}
              item={item}
              count={sepatuCounts[item.id] || 0}
              onInc={() => bumpSepatu(item.id, 1)}
              onDec={() => bumpSepatu(item.id, -1)}
              idx={i}
              multiplier={speedMultiplier}
            />
          ))}
        </TabsContent>
        <TabsContent value="showcase" className="mt-4 space-y-2.5">
          {SHOWCASE_ITEMS.map((item, i) => (
            <ItemRow
              key={item.id}
              item={item}
              count={showcaseCounts[item.id] || 0}
              onInc={() => bumpShowcase(item.id, 1)}
              onDec={() => bumpShowcase(item.id, -1)}
              idx={i}
            />
          ))}
        </TabsContent>
      </Tabs>
    </section>
  );
}
