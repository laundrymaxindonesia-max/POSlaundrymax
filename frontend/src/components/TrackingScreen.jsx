import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Loader2,
  Package,
  Waves,
  Flame,
  Shirt,
  PackageCheck,
  Truck,
  CheckCircle2,
  Clock,
  RefreshCw,
  User,
  Phone,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import HeaderNav from "@/components/HeaderNav";
import { fetchOrders } from "@/lib/api";
import CustomerHistoryModal from "@/components/tracking/CustomerHistoryModal";

/**
 * Seven status buckets shown as counter badges. Order + labels intentionally
 * match how the shop floor already talks about the pipeline (Kasir → Kurir).
 * "Setrika" here means "queued to iron" (backend status Kering handed off).
 */
const STATUS_BUCKETS = [
  { id: "Antrian", label: "Dalam Antrean",       Icon: Clock,         color: "#A0A0A0" },
  { id: "Cuci",    label: "Sedang Dicuci",       Icon: Waves,         color: "#3DA5FF" },
  { id: "Kering",  label: "Sedang Dikeringkan",  Icon: Flame,         color: "#FF8A3D" },
  { id: "Setrika", label: "Antrean Setrika",     Icon: Shirt,         color: "#FFD700" },
  { id: "Packing", label: "Sudah Disetrika",     Icon: PackageCheck,  color: "#7DF08F" },
  { id: "OTW",     label: "Dalam Pengantaran",   Icon: Truck,         color: "#B36BFF" },
  { id: "Selesai", label: "Sudah Diambil",       Icon: CheckCircle2,  color: "#B4F5BF" },
];

const STATUS_STYLE = {
  Antrian: "bg-white/10 text-white/70 border-white/20",
  Cuci: "bg-[#3DA5FF]/15 text-[#7FC1FF] border-[#3DA5FF]/30",
  Kering: "bg-[#FF8A3D]/15 text-[#FFB98C] border-[#FF8A3D]/30",
  Setrika: "bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/30",
  Packing: "bg-[#7DF08F]/15 text-[#B4F5BF] border-[#7DF08F]/30",
  OTW: "bg-[#B36BFF]/15 text-[#D8B4FF] border-[#B36BFF]/30",
  Selesai: "bg-white/10 text-white/70 border-white/20",
};

const formatIDR = (n) =>
  "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID").replace(/,/g, ".");

function formatTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return "";
  }
}

const PAGE_SIZE = 7;

export default function TrackingScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [activeBucket, setActiveBucket] = useState(null);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [customerHistoryName, setCustomerHistoryName] = useState(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const rows = await fetchOrders({ limit: 500 });
      setOrders(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error("Gagal memuat order", { description: e.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Counts per bucket (live)
  const counts = useMemo(() => {
    const c = {};
    for (const b of STATUS_BUCKETS) c[b.id] = 0;
    for (const o of orders) {
      if (c[o.order_status] !== undefined) c[o.order_status] += 1;
    }
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      // Rule: hide "Selesai" (Sudah Diambil) by default unless the user
      // explicitly clicks the Selesai bucket.
      if (o.order_status === "Selesai" && activeBucket !== "Selesai") {
        return false;
      }
      const matchBucket = !activeBucket || o.order_status === activeBucket;
      if (!matchBucket) return false;
      if (!q) return true;
      return (
        (o.order_id || "").toLowerCase().includes(q) ||
        (o.customer_name || "").toLowerCase().includes(q) ||
        (o.customer_phone || "").toLowerCase().includes(q)
      );
    });
  }, [orders, query, activeBucket]);

  // Unique customer names for the autocomplete dropdown. Suggestions
  // include every customer that has EVER placed an order (regardless of
  // status/date) so the operator can pull a full history modal.
  const nameSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const map = new Map();
    for (const o of orders) {
      const name = o.customer_name || "";
      if (!name) continue;
      if (!name.toLowerCase().includes(q)) continue;
      if (!map.has(name)) {
        map.set(name, {
          name,
          phone: o.customer_phone || "",
          orderCount: 1,
        });
      } else {
        map.get(name).orderCount += 1;
      }
    }
    return Array.from(map.values()).slice(0, 6);
  }, [orders, query]);

  // Pagination — 7 rows per page. Reset to page 1 whenever filters change.
  useEffect(() => {
    setPage(1);
  }, [query, activeBucket]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div
      className="relative min-h-screen text-white font-body max-w-md mx-auto md:border-x md:border-white/5"
      data-testid="tracking-screen"
    >
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#0a0a0a]/80 border-b border-white/5 px-4 py-3">
        <HeaderNav />
      </header>

      <main className="px-4 pt-4 pb-16 space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-white/50 text-[10px] uppercase tracking-widest font-medium">
              Order Pipeline
            </div>
            <h1 className="font-heading font-black text-white text-2xl tracking-tight mt-0.5">
              Pelacakan Order
            </h1>
            <p className="text-white/50 text-xs mt-0.5">
              Cari & lihat status seluruh order live dari database.
            </p>
          </div>
          <button
            onClick={load}
            disabled={refreshing}
            data-testid="tracking-refresh"
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:border-[#FFD700]/40 text-white/60 hover:text-[#FFD700] flex items-center justify-center transition-colors disabled:opacity-40"
            title="Muat ulang"
          >
            {refreshing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
          </button>
        </div>

        {/* Search + Autocomplete */}
        <div className="relative" data-testid="tracking-search-wrap">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FFD700] pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowAutocomplete(true);
            }}
            onFocus={() => setShowAutocomplete(true)}
            onBlur={() =>
              // Delay so dropdown clicks still register
              setTimeout(() => setShowAutocomplete(false), 150)
            }
            placeholder="Cari nama pelanggan / no. order / no. WA"
            data-testid="tracking-search-input"
            className="w-full h-12 pl-11 pr-4 rounded-2xl glass text-white placeholder-white/40 text-sm focus:border-[#FFD700]/50 focus:outline-none transition-colors"
          />
          {showAutocomplete && nameSuggestions.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-2 rounded-2xl glass-strong border border-[#FFD700]/20 overflow-hidden shadow-2xl z-40"
              data-testid="tracking-autocomplete"
            >
              {nameSuggestions.map((s) => (
                <button
                  key={s.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setShowAutocomplete(false);
                    setCustomerHistoryName(s.name);
                  }}
                  data-testid={`autocomplete-row-${s.name}`}
                  className="w-full flex items-center gap-3 p-3 hover:bg-[#FFD700]/8 border-b border-white/5 last:border-0 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/25 flex items-center justify-center text-[#FFD700] font-heading font-black text-sm flex-shrink-0">
                    {s.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-heading font-bold text-white text-sm truncate">
                      {s.name}
                    </div>
                    <div className="text-white/40 text-[11px] font-mono truncate">
                      {s.phone}
                    </div>
                  </div>
                  <span className="text-[10px] font-heading font-bold text-[#FFD700] uppercase tracking-wider flex-shrink-0">
                    {s.orderCount}× order
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status counter badges */}
        <div className="grid grid-cols-2 gap-2" data-testid="tracking-buckets">
          {STATUS_BUCKETS.map((b) => {
            const { Icon, color } = b;
            const isActive = activeBucket === b.id;
            return (
              <button
                key={b.id}
                onClick={() =>
                  setActiveBucket((prev) => (prev === b.id ? null : b.id))
                }
                data-testid={`bucket-${b.id}`}
                className={`rounded-xl p-3 border transition-all active:scale-[0.97] text-left ${
                  isActive
                    ? "bg-[#FFD700]/10 border-[#FFD700]/50 shadow-[0_0_20px_rgba(255,215,0,0.15)]"
                    : "bg-white/[0.03] border-white/10 hover:border-white/25"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center border"
                    style={{
                      backgroundColor: `${color}20`,
                      borderColor: `${color}40`,
                    }}
                  >
                    <Icon size={14} style={{ color }} strokeWidth={2.25} />
                  </div>
                  <div
                    className="text-[10px] uppercase tracking-wider text-white/60 leading-tight"
                    data-testid={`bucket-label-${b.id}`}
                  >
                    {b.label}
                  </div>
                </div>
                <div
                  className="font-heading font-black text-white text-2xl mt-2 tracking-tight"
                  data-testid={`bucket-count-${b.id}`}
                >
                  {counts[b.id] ?? 0}
                </div>
              </button>
            );
          })}
        </div>

        {activeBucket && (
          <button
            onClick={() => setActiveBucket(null)}
            data-testid="clear-bucket-filter"
            className="w-full h-9 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs font-medium hover:bg-white/10 hover:text-white transition-colors"
          >
            × Hapus filter status ({STATUS_BUCKETS.find((b) => b.id === activeBucket)?.label})
          </button>
        )}

        {/* Order list */}
        <section data-testid="tracking-list-section">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-heading font-bold text-white text-sm tracking-tight">
              Daftar Order
            </h2>
            <span className="text-white/40 text-[11px]" data-testid="tracking-filtered-count">
              {filtered.length} order
            </span>
          </div>

          {loading ? (
            <div
              className="glass rounded-2xl p-8 flex items-center justify-center gap-2 text-white/60"
              data-testid="tracking-loading"
            >
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Memuat order...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="glass rounded-2xl p-10 flex flex-col items-center gap-2 text-white/50"
              data-testid="tracking-empty"
            >
              <Package size={26} strokeWidth={1.5} />
              <div className="font-heading font-bold text-white/70 text-sm">
                {query || activeBucket ? "Tidak ada order cocok" : "Belum ada order"}
              </div>
              <div className="text-xs text-center">
                {query || activeBucket
                  ? "Coba ubah kata kunci atau hapus filter."
                  : "Order akan muncul di sini setelah kasir membuatnya."}
              </div>
            </div>
          ) : (
            <div className="space-y-2" data-testid="tracking-list">
              {paginated.map((o) => (
                <button
                  key={o.id || o.order_id}
                  onClick={() => setSelected(o)}
                  data-testid={`tracking-row-${o.order_id}`}
                  className="w-full glass rounded-xl p-3 flex items-center gap-3 text-left hover:border-[#FFD700]/30 border border-white/10 transition-colors active:scale-[0.99]"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/25 flex items-center justify-center flex-shrink-0 text-[#FFD700] font-heading font-black">
                    {(o.customer_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-heading font-bold text-white text-sm truncate">
                        {o.customer_name || "-"}
                      </span>
                      <span
                        className={`px-1.5 py-0 rounded text-[9px] font-heading font-bold uppercase tracking-wider border ${
                          STATUS_STYLE[o.order_status] || "bg-white/10 text-white/70 border-white/20"
                        }`}
                      >
                        {o.order_status}
                      </span>
                    </div>
                    <div className="text-white/50 text-[11px] mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono">{o.order_id}</span>
                      <span>·</span>
                      <span>{formatTime(o.created_at)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-mono text-[#FFD700] text-xs font-heading font-bold">
                      {formatIDR(o.total_price)}
                    </div>
                    <div
                      className={`text-[9px] uppercase tracking-wider mt-0.5 ${
                        o.payment_status === "Lunas" ? "text-[#B4F5BF]" : "text-[#FFB98C]"
                      }`}
                    >
                      {o.payment_status}
                    </div>
                  </div>
                </button>
              ))}

              {totalPages > 1 && (
                <Pagination
                  current={currentPage}
                  total={totalPages}
                  onPage={setPage}
                />
              )}
            </div>
          )}
        </section>
      </main>

      {/* Detail sheet */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={() => setSelected(null)}
          data-testid="tracking-detail-overlay"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#111111] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-3"
            data-testid="tracking-detail-sheet"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white/50 text-[10px] uppercase tracking-widest">
                  Order
                </div>
                <div className="font-heading font-black text-[#FFD700] text-lg tracking-widest">
                  {selected.order_id}
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-heading font-bold uppercase tracking-widest border ${
                  STATUS_STYLE[selected.order_status]
                }`}
              >
                {selected.order_status}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-white/80">
                <User size={13} className="text-[#FFD700]" />
                {selected.customer_name || "-"}
              </div>
              {selected.customer_phone && (
                <div className="flex items-center gap-2 text-white/60">
                  <Phone size={13} className="text-white/40" />
                  <span className="font-mono">{selected.customer_phone}</span>
                </div>
              )}
              {selected.customer_address && (
                <div className="flex items-start gap-2 text-white/60">
                  <MapPin size={13} className="text-white/40 mt-0.5" />
                  <span>{selected.customer_address}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-white/5">
              <div>
                <div className="text-white/40 text-[10px] uppercase tracking-wider">Berat</div>
                <div className="text-white font-heading font-bold mt-0.5">
                  {selected.weight_kg?.toFixed?.(1) || selected.weight_kg || "-"} kg
                </div>
              </div>
              <div>
                <div className="text-white/40 text-[10px] uppercase tracking-wider">Total</div>
                <div className="text-[#FFD700] font-heading font-bold mt-0.5">
                  {formatIDR(selected.total_price)}
                </div>
              </div>
              <div>
                <div className="text-white/40 text-[10px] uppercase tracking-wider">Bayar</div>
                <div
                  className={`font-heading font-bold mt-0.5 ${
                    selected.payment_status === "Lunas"
                      ? "text-[#B4F5BF]"
                      : "text-[#FFB98C]"
                  }`}
                >
                  {selected.payment_status}
                </div>
              </div>
            </div>

            {selected.items_detail && (
              <div className="pt-2 border-t border-white/5 text-xs text-white/60 leading-relaxed">
                {selected.items_detail}
              </div>
            )}

            {selected.order_events && selected.order_events.length > 0 && (
              <div className="pt-2 border-t border-white/5">
                <div className="text-white/40 text-[10px] uppercase tracking-widest mb-2">
                  Riwayat
                </div>
                <ol className="space-y-1.5" data-testid="tracking-history">
                  {selected.order_events.map((ev, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-[11px] text-white/70"
                    >
                      <span
                        className={`px-2 py-0.5 rounded-full font-heading font-bold uppercase text-[9px] tracking-widest border ${
                          STATUS_STYLE[ev.status] || "border-white/10"
                        }`}
                      >
                        {ev.status}
                      </span>
                      <span className="font-mono text-white/40">
                        {formatTime(ev.timestamp)}
                      </span>
                      {ev.actor && (
                        <span className="text-white/40">· {ev.actor}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <button
              onClick={() => setSelected(null)}
              data-testid="tracking-detail-close"
              className="w-full h-11 mt-2 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 font-medium hover:bg-white/10 hover:text-white transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {customerHistoryName && (
        <CustomerHistoryModal
          customerName={customerHistoryName}
          orders={orders}
          onClose={() => setCustomerHistoryName(null)}
        />
      )}
    </div>
  );
}

/** Compact pager rendered under the order list. Shows first, previous,
 *  current window and last-page shortcuts (1 … 4 5 6 … 12). */
function Pagination({ current, total, onPage }) {
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const items = Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const rendered = [];
  let prev = 0;
  for (const p of items) {
    if (p - prev > 1) rendered.push({ ellipsis: true, key: `e${p}` });
    rendered.push({ page: p, key: `p${p}` });
    prev = p;
  }
  return (
    <div
      className="flex items-center justify-center gap-1 pt-2"
      data-testid="tracking-pagination"
    >
      <button
        onClick={() => onPage(current - 1)}
        disabled={current === 1}
        data-testid="pagination-prev"
        className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-white/70 disabled:opacity-30 flex items-center justify-center hover:border-white/25"
      >
        <ChevronLeft size={14} />
      </button>
      {rendered.map((r) =>
        r.ellipsis ? (
          <span key={r.key} className="text-white/40 text-xs px-1">
            …
          </span>
        ) : (
          <button
            key={r.key}
            onClick={() => onPage(r.page)}
            data-testid={`pagination-page-${r.page}`}
            className={`w-9 h-9 rounded-lg text-xs font-heading font-bold transition ${
              r.page === current
                ? "bg-[#FFD700] text-black"
                : "bg-white/5 border border-white/10 text-white/70 hover:border-white/25"
            }`}
          >
            {r.page}
          </button>
        )
      )}
      <button
        onClick={() => onPage(current + 1)}
        disabled={current === total}
        data-testid="pagination-next"
        className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-white/70 disabled:opacity-30 flex items-center justify-center hover:border-white/25"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
