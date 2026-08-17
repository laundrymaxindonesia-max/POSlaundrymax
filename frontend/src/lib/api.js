/**
 * Thin wrappers around the LaundryMax backend API. Each function returns
 * the parsed JSON body and throws on non-2xx with a `detail`-aware message.
 */

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function unwrap(res) {
  const text = await res.text();
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    let body = null;
    try {
      body = JSON.parse(text);
      if (body?.detail) detail = body.detail;
    } catch (e) { /* not JSON */ }
    const err = new Error(detail);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}

// ---------- Orders ----------
export async function fetchOrders(params = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.payment_status) q.set("payment_status", params.payment_status);
  if (params.since) q.set("since", params.since);
  if (params.limit) q.set("limit", String(params.limit));
  return unwrap(await fetch(`${API}/orders?${q.toString()}`));
}

export async function fetchOrder(orderId) {
  return unwrap(await fetch(`${API}/orders/${encodeURIComponent(orderId)}`));
}

// Legacy alias — several new callers use fetchOrderById()
export const fetchOrderById = fetchOrder;

export async function createOrder(payload) {
  return unwrap(
    await fetch(`${API}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}

export async function patchOrderStatus(orderId, newStatus, actor) {
  return unwrap(
    await fetch(`${API}/orders/${encodeURIComponent(orderId)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_status: newStatus, actor }),
    })
  );
}

export async function markOrderPaid(orderId, actor = "kasir") {
  return unwrap(
    await fetch(
      `${API}/orders/${encodeURIComponent(orderId)}/payment?actor=${encodeURIComponent(actor)}`,
      { method: "PATCH" }
    )
  );
}

/**
 * parseQrPayload — extract an `order_id` from the raw QR string. Accepts
 * either the plain `LND-xxx` label used on Bag tags OR a JSON blob emitted
 * by the POS QR modal `{order_id, customer, ...}`.
 * Returns `null` if nothing looks like an order id.
 */
export function parseQrPayload(text) {
  if (!text) return null;
  const raw = String(text).trim();
  if (raw.startsWith("{")) {
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj.order_id === "string") return obj.order_id;
    } catch (e) { /* fall through */ }
  }
  const match = raw.match(/(LND-[A-Za-z0-9\-]+)/i);
  if (match) return match[1];
  return null;
}

export async function uploadPod(orderId, { actor, kind = "delivery", photo, lat, lng }) {
  const fd = new FormData();
  fd.append("actor", actor);
  fd.append("kind", kind);
  fd.append("photo", photo, photo.name || "pod.jpg");
  if (typeof lat === "number") fd.append("lat", String(lat));
  if (typeof lng === "number") fd.append("lng", String(lng));
  return unwrap(
    await fetch(`${API}/orders/${encodeURIComponent(orderId)}/pod`, {
      method: "POST",
      body: fd,
    })
  );
}

/** GET /api/receipt-settings — returns the singleton settings row.
 *  Always resolves (falls back to a static default if the API is down)
 *  so print never throws for a network glitch. */
export async function fetchReceiptSettings() {
  try {
    return unwrap(await fetch(`${API}/receipt-settings`));
  } catch (e) {
    console.warn("receipt-settings fetch failed, using default:", e.message);
    return {
      header_order: ["speed", "qr", "logo"],
      store_name: "LAUNDRYMAX",
      store_address: "Jl. Contoh No. 1, Bandung",
      store_phone: "0812-3456-7890",
      footer_message: "Terima kasih!",
      paper_width: "58mm",
    };
  }
}

// ---------- Prices ----------
export async function fetchPrices() {
  return unwrap(await fetch(`${API}/prices`));
}

// ---------- Customers ----------
export async function searchCustomers(q) {
  const url = q
    ? `${API}/customers?q=${encodeURIComponent(q)}&limit=25`
    : `${API}/customers?limit=25`;
  return unwrap(await fetch(url));
}

export async function createCustomer(payload) {
  return unwrap(
    await fetch(`${API}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}

export async function deductQuota(customerId, kg, reason) {
  return unwrap(
    await fetch(`${API}/customers/${encodeURIComponent(customerId)}/deduct`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kg, reason }),
    })
  );
}

// ---------- B2B quotas ----------
export async function fetchB2BQuotas() {
  return unwrap(await fetch(`${API}/b2b_quotas`));
}

// ---------- Staff ----------
export async function fetchStaff() {
  return unwrap(await fetch(`${API}/staff`));
}

