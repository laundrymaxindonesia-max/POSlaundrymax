/**
 * Owner auth context — Emergent Google OAuth.
 *
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS,
 * THIS BREAKS THE AUTH.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext({
  user: null,
  loading: true,
  checkAuth: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`${API}/auth/me`, { credentials: "include" });
      if (!res.ok) {
        setUser(null);
      } else {
        setUser(await res.json());
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If we're returning from Emergent Auth (session_id fragment), let
    // AuthCallback handle the exchange + cookie first. Running /auth/me here
    // would race and always return 401 on the first mount.
    if (typeof window !== "undefined" && window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e) { /* ignore network errors on logout */ }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, checkAuth, logout }),
    [user, loading, checkAuth, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
