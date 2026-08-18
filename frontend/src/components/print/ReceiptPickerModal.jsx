import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Printer, FileText, ClipboardList, Tag } from "lucide-react";
import ReceiptPreviewModal from "@/components/print/ReceiptPreviewModal";
import { fetchReceiptSettings } from "@/lib/api";

const MODELS = [
  {
    id: "customer",
    label: "Nota Pelanggan",
    desc: "Detail + harga + QR",
    Icon: FileText,
  },
  {
    id: "production",
    label: "Slip Produksi",
    desc: "Tanpa harga · fokus item",
    Icon: ClipboardList,
  },
  {
    id: "bagtag",
    label: "Label Bag / Pack",
    desc: "Minimal · tempel di tas",
    Icon: Tag,
  },
];

/**
 * ReceiptPickerModal — reusable 3-option picker used by Courier, Tracking
 * and Customer History screens. Opens ReceiptPreviewModal on selection.
 *
 * Props
 * -----
 * order    — printPayload-shaped receipt data (customer, items, total, etc.)
 * title    — dialog title override (defaults to "Cetak Ulang Nota")
 * onClose  — dismiss handler
 */
export default function ReceiptPickerModal({ order, title, onClose }) {
  const [settings, setSettings] = useState(null);
  const [chosen, setChosen] = useState(null);

  useEffect(() => {
    fetchReceiptSettings().then(setSettings).catch(() => setSettings({}));
  }, []);

  if (chosen) {
    return (
      <ReceiptPreviewModal
        order={order}
        model={chosen}
        settings={settings}
        onClose={() => {
          setChosen(null);
          onClose?.();
        }}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent
        className="bg-[#111111] border-white/10 text-white max-w-xs rounded-3xl"
        data-testid="receipt-picker-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-heading font-bold text-[#FFD700] text-lg flex items-center gap-2">
            <Printer size={18} /> {title || "Cetak Ulang Nota"}
          </DialogTitle>
          <DialogDescription className="text-white/50 text-xs">
            {order?.id || ""} · {order?.customer || ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2">
          {MODELS.map(({ id, label, desc, Icon }) => (
            <button
              key={id}
              onClick={() => setChosen(id)}
              data-testid={`picker-model-${id}`}
              className="text-left rounded-xl border border-white/10 hover:border-[#FFD700]/40 bg-white/[0.03] hover:bg-[#FFD700]/[0.06] p-3 transition-all flex items-center gap-3 active:scale-[0.98]"
            >
              <div className="w-9 h-9 rounded-lg bg-[#FFD700]/15 border border-[#FFD700]/30 flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-[#FFD700]" strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <div className="font-heading font-bold text-white text-sm">
                  {label}
                </div>
                <div className="text-white/40 text-[10px]">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Convert a plain Order document (from GET /api/orders/{id}) into the
 * printPayload shape expected by ReceiptPreviewModal.
 */
export function orderToPrintPayload(order) {
  if (!order) return null;
  const detail = order.items_detail || "";
  const speed = /express/i.test(detail)
    ? "express"
    : /flash/i.test(detail)
      ? "flash"
      : "reguler";
  const total = Number(order.total_price) || 0;
  return {
    id: order.order_id,
    customer: order.customer_name,
    phone: order.customer_phone,
    dateLabel: new Date(order.created_at || Date.now()).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    cashier: "-",
    speedTier: speed,
    serviceLabel: detail || "-",
    items_detail: detail,
    weight_kg: order.weight_kg,
    notes: order.notes || "",
    qrPayload: order.order_id,
    paymentStatus: order.payment_status === "Lunas" ? "lunas" : "nanti",
    bagIndex: 1,
    bagTotal: 1,
    items: [
      {
        name: detail || "Cucian",
        qty: order.weight_kg ? `${order.weight_kg} kg` : "1",
        subtotal: total,
      },
    ],
    subtotal: total,
    discount: 0,
    total,
  };
}
