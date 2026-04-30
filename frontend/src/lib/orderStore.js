// Lightweight cross-component order pipeline (cashier → courier).
// Backed by localStorage so it survives route changes; emits a custom event
// for live in-tab sync, and also responds to native "storage" events for
// cross-tab updates.

const KEY = "laundrymax_pending_courier_orders";
const EVT = "laundrymax-pending-orders-changed";

export const getPendingOrders = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};

const writePendingOrders = (list) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
};

export const pushPendingOrder = (order) => {
  const list = getPendingOrders();
  // dedup by id
  if (list.some((o) => o.id === order.id)) return;
  list.unshift(order);
  writePendingOrders(list);
};

export const removePendingOrder = (id) => {
  const list = getPendingOrders().filter((o) => o.id !== id);
  writePendingOrders(list);
};

export const subscribePendingOrders = (cb) => {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
};
