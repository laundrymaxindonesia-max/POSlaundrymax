/**
 * OwnerProtectedRoute — wraps /admin and /dashboard.
 *
 * Loading → render spinner.
 * No user → show OwnerLogin.
 * Authenticated → render children.
 */
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import OwnerLogin from "@/components/auth/OwnerLogin";

export default function OwnerProtectedRoute({ children, loginNextPath }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center"
        data-testid="owner-auth-loading"
      >
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 size={20} className="animate-spin text-[#FFD700]" />
          Memeriksa sesi...
        </div>
      </div>
    );
  }

  if (!user) {
    return <OwnerLogin nextPath={loginNextPath} />;
  }

  return children;
}
