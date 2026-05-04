/**
 * Thin wrappers around the LaundryMax backend API. Each function returns
 * the parsed JSON body and throws on non-2xx with a `detail`-aware message.
 */

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function unwrap(res) {
  const text = await res.text();
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text);
      if (j?.detail) detail = j.detail;
    } catch (e) { /* not JSON */ }
    throw new Error(detail);
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

export async function uploadPod(orderId, { actor, kind = "delivery", photo }) {
  const fd = new FormData();
  fd.append("actor", actor);
  fd.append("kind", kind);
  fd.append("photo", photo, photo.name || "pod.png");
  return unwrap(
    await fetch(`${API}/orders/${encodeURIComponent(orderId)}/pod`, {
      method: "POST",
      body: fd,
    })
  );
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

/**
 * Generate a simple canvas-based mock photo blob — used by Courier PoD upload
 * when the real camera isn't available in the kiosk prototype.
 */
export async function generateMockPodBlob(label = "PoD") {
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 240;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 320, 240);
  grad.addColorStop(0, "#1a1a1a");
  grad.addColorStop(1, "#0a0a0a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 320, 240);
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText(label, 20, 50);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "14px sans-serif";
  ctx.fillText(new Date().toISOString().slice(0, 19), 20, 220);
  return await new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}
