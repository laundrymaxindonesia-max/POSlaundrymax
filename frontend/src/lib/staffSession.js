/**
 * Staff session helpers — persist the PIN-authenticated staff identity in
 * sessionStorage so operational pages (POS / Production / Courier) know who
 * the current actor is when they call backend APIs.
 */

const SESSION_KEY = "staff_pin_ok";
const ID_KEY = "staff_pin_id";
const NAME_KEY = "staff_pin_name";
const ROLE_KEY = "staff_pin_role";

export function getCurrentStaff() {
  if (typeof window === "undefined") return null;
  if (sessionStorage.getItem(SESSION_KEY) !== "true") return null;
  return {
    id: sessionStorage.getItem(ID_KEY) || "",
    name: sessionStorage.getItem(NAME_KEY) || "",
    role: sessionStorage.getItem(ROLE_KEY) || "",
  };
}

export function setCurrentStaff(staff) {
  sessionStorage.setItem(SESSION_KEY, "true");
  sessionStorage.setItem(ID_KEY, staff.id || staff.staff_id || "");
  sessionStorage.setItem(NAME_KEY, staff.name || "");
  sessionStorage.setItem(ROLE_KEY, staff.role || "");
}

export function clearCurrentStaff() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(ID_KEY);
  sessionStorage.removeItem(NAME_KEY);
  sessionStorage.removeItem(ROLE_KEY);
}

/**
 * Build a humanised `actor` string for audit events, e.g. "kasir-erfa".
 */
export function getActorTag() {
  const staff = getCurrentStaff();
  if (!staff) return "unknown";
  const rolePrefix = (staff.role || "staff").toLowerCase();
  return `${rolePrefix}-${(staff.name || "").toLowerCase()}`;
}
