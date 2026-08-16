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

