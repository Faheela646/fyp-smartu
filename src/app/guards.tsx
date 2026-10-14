import { Navigate, useLocation } from "react-router-dom";
import { homeForRole, useAuthStore } from "@/store/auth";
import type { Role } from "@/types/api";
import { useRealtimeConnection } from "@/hooks/useRealtime";

export function RequireRole({ roles, children, nested }: { roles: Role[]; children: React.ReactNode; nested?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  useRealtimeConnection(!nested);
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to="/403" replace />;
  return <>{children}</>;
}

export function RedirectHome() {
  const user = useAuthStore((s) => s.user);
  return <Navigate to={user ? homeForRole(user.role) : "/login"} replace />;
}
