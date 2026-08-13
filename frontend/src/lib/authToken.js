/**
 * Cross-origin session-token helper.
 *
 * In production the Vercel frontend and Render backend are cross-site
 * (different eTLD+1s), so many browsers (Safari, Firefox strict, Brave)
 * block the `SameSite=None; Secure` third-party cookie the backend sets
 * on `/api/auth/session`. To keep Owner login working there, we ALSO
 * persist the session_token in localStorage and forward it as an
 * `Authorization: Bearer <token>` header on subsequent requests.
 * The backend accepts either transport (see auth._resolve_session_from_cookie_or_header).
 */

const KEY = "laundrymax_session_token";

export function getSessionToken() {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
  } catch (e) {
    return null;
  }
}

export function setSessionToken(token) {
  try {
    if (token) window.localStorage.setItem(KEY, token);
  } catch (e) {
    /* private mode or storage disabled — auth will silently fall back to cookies */
  }
}

export function clearSessionToken() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (e) {
    /* ignore */
  }
}

/** Build a fetch options object that forwards both the cookie and the Bearer
 * token so the backend can authenticate the caller via whichever transport
 * the browser allows. */
export function withAuth(init = {}) {
  const token = getSessionToken();
  const headers = new Headers(init.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return {
    ...init,
    credentials: "include",
    headers,
  };
}
