/**
 * receiptPrinter — client-side thermal receipt renderer.
 *
 * Opens a new print window with a self-contained HTML document sized for
 * 58mm or 80mm thermal paper, then calls `window.print()` automatically.
 * The document uses CSS `@page` + a single monospace font so any modern
 * thermal driver (ESC/POS bridges, browser print-to-PDF, or plain PDF
 * viewers) produces a correctly-sized receipt.
 *
 * Three templates are supported:
 *   - "customer"   Model A: full detail, prices, QR, LUNAS/PIUTANG stamp
 *   - "production" Model B: NO prices, focus on items + speed banner
 *   - "bagtag"     Model C: minimal label — customer, order id, bag N/M
 *
 * Header composition is data-driven: `settings.header_order` decides which
 * of {speed, qr, logo} appears at the top. Any unknown slot is skipped.
 */

const SPEED_STYLES = {
  reguler: { label: "REGULER", tone: "#000", bg: "#f2f2f2", size: 22 },
  flash: { label: "FLASH !!", tone: "#000", bg: "#ffe066", size: 26 },
  express: { label: "EXPRESS !!!", tone: "#fff", bg: "#000", size: 28 },
};

/** Google Charts QR is a no-JS, no-dependency renderer we can embed as <img>. */
function qrImgTag(data, size = 180) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    data
  )}`;
  return `<img src="${url}" width="${size}" height="${size}" alt="QR ${data}" />`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatIDR(n) {
  return "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID").replace(/,/g, ".");
}

function nowStamp() {
  const d = new Date();
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─────────────────────────────── HEADER SLOTS ───────────────────────────────

function renderSpeedSlot(order) {
  const speedKey = (order.speedTier || "reguler").toLowerCase();
  const s = SPEED_STYLES[speedKey] || SPEED_STYLES.reguler;
  return `<div class="speed-banner" style="background:${s.bg};color:${s.tone};font-size:${s.size}px;">${s.label}</div>`;
}

function renderQrSlot(order) {
  const payload = order.qrPayload || order.id || "LND-000";
  return `
    <div class="qr-block">
      ${qrImgTag(payload, 168)}
      <div class="qr-code">${escapeHtml(payload)}</div>
    </div>`;
}

function renderLogoSlot(settings) {
  const logo = settings.logo_url
    ? `<div class="logo-image"><img src="${escapeHtml(settings.logo_url)}" alt="Logo" /></div>`
    : "";
  return `
    <div class="logo-block">
      ${logo}
      <div class="logo-name">${escapeHtml(settings.store_name)}</div>
      <div class="logo-sub">${escapeHtml(settings.store_address)}</div>
      <div class="logo-sub">☎ ${escapeHtml(settings.store_phone)}</div>
    </div>`;
}

function renderHeader(settings, order, allowedSlots) {
  const slots = (settings.header_order || ["speed", "qr", "logo"]).filter((s) =>
    allowedSlots.includes(s)
  );
  const html = slots.map((slot) => {
    if (slot === "speed") return renderSpeedSlot(order);
    if (slot === "qr") return renderQrSlot(order);
    if (slot === "logo") return renderLogoSlot(settings);
    return "";
  });
  return `<div class="header">${html.join("")}</div>`;
}

// ─────────────────────────────── TEMPLATES ──────────────────────────────────

function renderItemsForCustomer(order) {
  const items = order.items || [];
  if (!items.length) return "";
  return `
    <table class="items">
      <thead>
        <tr><th class="l">Item</th><th class="r">Qty</th><th class="r">Harga</th></tr>
      </thead>
      <tbody>
        ${items
          .map(
            (it) => `
          <tr>
            <td class="l">${escapeHtml(it.name)}</td>
            <td class="r">${escapeHtml(it.qty)}</td>
            <td class="r">${formatIDR(it.subtotal)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function renderItemsForProduction(order) {
  const items = order.items || [];
  if (!items.length) return "<div class='muted'>(tidak ada item terinci)</div>";
  return `
    <table class="items production">
      <thead>
        <tr><th class="l">Item</th><th class="r">Qty</th></tr>
      </thead>
      <tbody>
        ${items
          .map(
            (it) => `
          <tr>
            <td class="l">${escapeHtml(it.name)}</td>
            <td class="r">${escapeHtml(it.qty)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function templateCustomer(order, settings) {
  return `
    ${renderHeader(settings, order, ["speed", "qr", "logo"])}
    <div class="divider"></div>
    <div class="kv"><span>No. Order</span><b>${escapeHtml(order.id)}</b></div>
    <div class="kv"><span>Tanggal</span><b>${escapeHtml(order.dateLabel || nowStamp())}</b></div>
    <div class="kv"><span>Kasir</span><b>${escapeHtml(order.cashier || "-")}</b></div>
    <div class="divider"></div>
    <div class="kv"><span>Pelanggan</span><b>${escapeHtml(order.customer)}</b></div>
    ${
      order.phone
        ? `<div class="kv"><span>WhatsApp</span><b>${escapeHtml(order.phone)}</b></div>`
        : ""
    }
    <div class="divider"></div>
    ${renderItemsForCustomer(order)}
    <div class="divider"></div>
    ${
      order.discount > 0
        ? `<div class="kv"><span>Subtotal</span><b>${formatIDR(order.subtotal)}</b></div>
           <div class="kv"><span>Diskon</span><b>-${formatIDR(order.discount)}</b></div>`
        : ""
    }
    <div class="kv total"><span>TOTAL</span><b>${formatIDR(order.total)}</b></div>
    <div class="stamp ${order.paymentStatus === "lunas" ? "ok" : "warn"}">
      ${order.paymentStatus === "lunas" ? "LUNAS" : "PIUTANG (BAYAR SAAT AMBIL)"}
    </div>
    <div class="divider"></div>
    <div class="footer">${escapeHtml(settings.footer_message)}</div>
    <div class="footer small">Tracking: laundrymax.id/#${escapeHtml(order.id)}</div>
  `;
}

function templateProduction(order, settings) {
  return `
    ${renderHeader(settings, order, ["speed", "qr", "logo"])}
    <div class="divider"></div>
    <div class="kv"><span>Order</span><b>${escapeHtml(order.id)}</b></div>
    <div class="kv"><span>Terima</span><b>${escapeHtml(order.dateLabel || nowStamp())}</b></div>
    <div class="kv"><span>Pelanggan</span><b>${escapeHtml(order.customer)}</b></div>
    <div class="kv"><span>Layanan</span><b>${escapeHtml(order.serviceLabel || order.items_detail || "-")}</b></div>
    ${
      order.weight_kg
        ? `<div class="kv"><span>Berat</span><b>${escapeHtml(order.weight_kg)} kg</b></div>`
        : ""
    }
    <div class="divider"></div>
    ${renderItemsForProduction(order)}
    ${
      order.notes
        ? `<div class="divider"></div>
           <div class="notes"><b>CATATAN:</b><br/>${escapeHtml(order.notes)}</div>`
        : ""
    }
    <div class="divider"></div>
    <div class="footer small">SLIP PRODUKSI · JANGAN DIBERIKAN KE PELANGGAN</div>
  `;
}

function templateBagTag(order, settings) {
  const bagIndex = order.bagIndex || 1;
  const bagTotal = order.bagTotal || 1;
  // Bag tag renders speed prominently, then customer + bag N/M + order id.
  // Skip logo/footer entirely — this label sits on the plastic bag.
  return `
    ${renderHeader(settings, order, ["speed"])}
    <div class="bag-customer">${escapeHtml(order.customer)}</div>
    <div class="bag-order">${escapeHtml(order.id)}</div>
    <div class="bag-count">BAG ${bagIndex} / ${bagTotal}</div>
    ${
      order.qrPayload || order.id
        ? `<div class="bag-qr">${qrImgTag(order.qrPayload || order.id, 132)}</div>`
        : ""
    }
  `;
}

// ─────────────────────────────── DRIVER ─────────────────────────────────────

function commonCSS(paperWidth) {
  // Thermal paper widths: 58mm printable ≈ 48mm content; 80mm ≈ 72mm.
  const contentWidth = paperWidth === "80mm" ? "72mm" : "48mm";
  return `
    @page { size: ${paperWidth} auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      width: ${contentWidth};
      margin: 0 auto;
      padding: 4mm 2mm;
      font-family: "Courier New", Consolas, monospace;
      font-size: 12px;
      color: #000;
      background: #fff;
      line-height: 1.35;
    }
    .header { text-align: center; }
    .speed-banner {
      display: block;
      text-align: center;
      font-weight: 900;
      letter-spacing: 2px;
      padding: 6px 4px;
      border: 2px solid #000;
      margin: 0 0 6px 0;
    }
    .qr-block { margin: 4px 0 6px 0; text-align: center; }
    .qr-block img { display: block; margin: 0 auto; }
    .qr-code { font-size: 10px; margin-top: 2px; letter-spacing: 1px; }
    .logo-block { margin: 4px 0 6px 0; }
    .logo-image { margin: 0 auto 4px; }
    .logo-image img { max-width: 60%; max-height: 60px; object-fit: contain; display: block; margin: 0 auto; }
    .logo-name { font-size: 18px; font-weight: 900; letter-spacing: 2px; }
    .logo-sub { font-size: 10px; }
    .divider {
      border-top: 1px dashed #000; margin: 4px 0;
    }
    .kv { display: flex; justify-content: space-between; font-size: 11px; }
    .kv span { color: #333; }
    .kv b { font-weight: 700; text-align: right; max-width: 60%; }
    .kv.total { font-size: 15px; margin-top: 6px; border-top: 2px solid #000; padding-top: 4px; }
    .kv.total b { font-size: 18px; }
    table.items { width: 100%; border-collapse: collapse; font-size: 11px; }
    table.items th { text-align: left; border-bottom: 1px solid #000; padding: 2px 0; }
    table.items td { padding: 1px 0; vertical-align: top; }
    table.items .l { text-align: left; }
    table.items .r { text-align: right; }
    table.items.production td, table.items.production th { font-size: 12px; }
    .stamp {
      display: block;
      text-align: center;
      font-weight: 900;
      letter-spacing: 3px;
      border: 2px solid #000;
      padding: 4px;
      margin: 6px 0;
      font-size: 14px;
    }
    .stamp.warn { background: #000; color: #fff; }
    .notes {
      font-size: 12px;
      border: 2px solid #000;
      padding: 4px 6px;
      background: #f5f5f5;
    }
    .footer { text-align: center; font-size: 10px; margin-top: 4px; }
    .footer.small { font-size: 9px; margin-top: 2px; }
    .muted { text-align: center; font-size: 10px; color: #555; padding: 6px 0; }
    /* Bag tag specifics */
    .bag-customer { font-size: 18px; font-weight: 900; text-align: center; margin: 6px 0 2px; }
    .bag-order { font-size: 12px; text-align: center; letter-spacing: 3px; }
    .bag-count {
      font-size: 22px; font-weight: 900; text-align: center;
      border: 2px solid #000; padding: 6px 2px; margin: 6px 0;
    }
    .bag-qr { text-align: center; margin-top: 4px; }
  `;
}

/**
 * printReceipt — opens a print window, injects the requested template,
 * and triggers window.print().
 *
 * @param {object} order    the enriched order snapshot
 * @param {"customer"|"production"|"bagtag"} model
 * @param {object} settings the current ReceiptSettings
 * @returns {Window|null}   the opened window (may be null if the popup was
 *                          blocked — caller should fall back to a toast)
 */
export function printReceipt(order, model, settings) {
  const s = settings || {
    header_order: ["speed", "qr", "logo"],
    store_name: "LAUNDRYMAX",
    store_address: "Jl. Contoh No. 1, Bandung",
    store_phone: "0812-3456-7890",
    footer_message: "Terima kasih!",
    paper_width: "58mm",
    logo_url: "",
  };
  const body =
    model === "production"
      ? templateProduction(order, s)
      : model === "bagtag"
        ? templateBagTag(order, s)
        : templateCustomer(order, s);

  const html = `<!doctype html>
<html lang="id"><head>
<meta charset="utf-8" />
<title>${s.store_name} — ${escapeHtml(order.id || "")}</title>
<style>${commonCSS(s.paper_width || "58mm")}</style>
</head><body>${body}
<script>
  // Wait one animation frame so the QR <img> can start loading, then
  // schedule print after all images are ready (or after 800ms as a fallback).
  var imgs = Array.from(document.images);
  var done = 0;
  function trigger(){ setTimeout(function(){ window.focus(); window.print(); }, 120); }
  if (!imgs.length) { trigger(); } else {
    var fallback = setTimeout(trigger, 800);
    imgs.forEach(function(img){
      if (img.complete) { done++; if (done===imgs.length){ clearTimeout(fallback); trigger(); } }
      else { img.onload = img.onerror = function(){ done++; if (done===imgs.length){ clearTimeout(fallback); trigger(); } }; }
    });
  }
</script>
</body></html>`;

  const w = window.open("", "laundrymax_receipt", "width=420,height=640");
  if (!w) return null;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return w;
}

export const RECEIPT_MODELS = [
  { id: "customer", label: "Nota Pelanggan", desc: "Ringkas + harga + QR tracking" },
  { id: "production", label: "Slip Produksi", desc: "Tanpa harga, fokus item + kecepatan" },
  { id: "bagtag", label: "Label Bag / Pack", desc: "Untuk tempel di tas cucian" },
];

/**
 * buildWhatsappText — plain-text receipt suited for the wa.me deep link.
 * Keeps lines short so WhatsApp desktop preview looks readable.
 */
export function buildWhatsappText(order, settings) {
  const s = settings || {};
  const speed = (order.speedTier || "reguler").toUpperCase();
  const items = order.items || [];
  const lines = [];
  lines.push(`*${s.store_name || "LAUNDRYMAX"}*`);
  if (s.store_address) lines.push(s.store_address);
  if (s.store_phone) lines.push(`Telp: ${s.store_phone}`);
  lines.push("─────────────");
  lines.push(`Order  : *${order.id || "-"}*`);
  lines.push(`Tanggal: ${order.dateLabel || nowStamp()}`);
  lines.push(`Kasir  : ${order.cashier || "-"}`);
  lines.push(`Nama   : ${order.customer || "-"}`);
  if (order.phone) lines.push(`No. WA : ${order.phone}`);
  lines.push(`Kecepatan: ${speed}`);
  lines.push("─────────────");
  items.forEach((it) => {
    lines.push(`• ${it.name} — ${it.qty}  ${formatIDR(it.subtotal)}`);
  });
  if (items.length === 0) lines.push("(tidak ada rincian item)");
  lines.push("─────────────");
  if (order.discount > 0) {
    lines.push(`Subtotal : ${formatIDR(order.subtotal)}`);
    lines.push(`Diskon   : -${formatIDR(order.discount)}`);
  }
  lines.push(`*TOTAL   : ${formatIDR(order.total)}*`);
  lines.push(
    order.paymentStatus === "lunas"
      ? "Status  : LUNAS ✅"
      : "Status  : BAYAR SAAT AMBIL 🕐"
  );
  if (s.footer_message) {
    lines.push("─────────────");
    lines.push(s.footer_message);
  }
  return lines.join("\n");
}

/**
 * openWhatsapp — build a wa.me link from the customer's phone and receipt
 * text. Returns the opened window (or null when the popup is blocked).
 */
export function openWhatsapp(order, settings, mode = "text") {
  const phoneDigits = String(order.phone || "").replace(/\D/g, "");
  if (!phoneDigits) return { blocked: false, missingPhone: true, window: null };
  let text;
  if (mode === "image") {
    text =
      `Halo ${order.customer || ""}, berikut nota cucian *${order.id || ""}*.\n` +
      `Silakan buka link tracking:\nhttps://laundrymax.id/#${order.id || ""}\n\n` +
      `Total: ${formatIDR(order.total)}\n` +
      `Status: ${order.paymentStatus === "lunas" ? "LUNAS ✅" : "BAYAR SAAT AMBIL 🕐"}\n\n` +
      `Screenshot nota akan menyusul dari kasir. Terima kasih!`;
  } else {
    text = buildWhatsappText(order, settings);
  }
  const url = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`;
  const w = window.open(url, "_blank", "noopener");
  return { blocked: !w, missingPhone: false, window: w };
}

/**
 * buildReceiptTextLines — plain-text (no HTML) rendering of a receipt for
 * one of the 3 models. Used both as the visible content of the preview
 * modal AND as the ESC/POS body sent to a BT thermal printer.
 * Returns { header: string[], body: string[], footer: string[] }.
 */
export function buildReceiptTextLines(order, model, settings) {
  const s = settings || {};
  const header = [];
  const body = [];
  const footer = [];
  const paperWidth = s.paper_width === "80mm" ? 42 : 32; // chars per line

  const pad = (label, value) => {
    const l = String(label);
    const v = String(value);
    if (l.length + v.length + 1 >= paperWidth) return `${l}\n  ${v}`;
    return l + " ".repeat(paperWidth - l.length - v.length) + v;
  };
  const divider = () => "-".repeat(paperWidth);

  // Header
  header.push((s.store_name || "LAUNDRYMAX").toUpperCase());
  if (s.store_address) header.push(s.store_address);
  if (s.store_phone) header.push("Telp: " + s.store_phone);

  // Body
  body.push(divider());
  body.push(pad("Order", order.id || "-"));
  body.push(pad("Tanggal", order.dateLabel || ""));
  if (order.cashier) body.push(pad("Kasir", order.cashier));
  body.push(pad("Nama", order.customer || "-"));
  if (order.phone) body.push(pad("No. WA", order.phone));
  body.push(pad("Kecepatan", (order.speedTier || "reguler").toUpperCase()));
  body.push(divider());

  if (model === "bagtag") {
    body.push("");
    body.push(`  BAG ${order.bagIndex || 1} / ${order.bagTotal || 1}`);
    body.push("");
    if (order.notes) body.push("Catatan: " + order.notes);
  } else if (model === "production") {
    (order.items || []).forEach((it) =>
      body.push(`- ${it.name} (${it.qty})`)
    );
    if ((order.items || []).length === 0) body.push("(tidak ada item)");
    body.push(divider());
    body.push("*** SLIP PRODUKSI ***");
    body.push("JANGAN DIBERIKAN KE PELANGGAN");
    if (order.notes) {
      body.push(divider());
      body.push("Catatan: " + order.notes);
    }
  } else {
    // customer
    (order.items || []).forEach((it) =>
      body.push(pad(`${it.name} (${it.qty})`, formatIDR(it.subtotal)))
    );
    body.push(divider());
    if (order.discount > 0) {
      body.push(pad("Subtotal", formatIDR(order.subtotal)));
      body.push(pad("Diskon", "-" + formatIDR(order.discount)));
    }
    body.push(pad("TOTAL", formatIDR(order.total)));
    body.push(
      order.paymentStatus === "lunas"
        ? ">>> LUNAS <<<"
        : ">>> BAYAR SAAT AMBIL <<<"
    );
  }

  // Footer
  if (model === "customer" && s.footer_message) {
    footer.push(s.footer_message);
  }
  if (model !== "bagtag") {
    footer.push("Order: " + (order.id || ""));
  }
  return { header, body, footer };
}
