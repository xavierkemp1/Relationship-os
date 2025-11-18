import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

type Props = {
  children: ReactNode;
};

export function RequireAuth({ children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-4 text-sm text-gray-600">Checking session…</div>;
  }

  if (!user) {
    // Not logged in: go to /login and remember where we were
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User is authenticated, render the protected content
  return <>{children}</>;
}
