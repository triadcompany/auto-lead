import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface AdminRouteProps {
  children?: React.ReactNode;
  /** Where to send non-admins. Defaults to /dashboard. */
  redirectTo?: string;
}

/**
 * Silently redirects non-admin users to a safe route.
 * Used to gate admin-only top-level pages without showing any "Access denied" UI.
 */
export function AdminRoute({ children, redirectTo = '/dashboard' }: AdminRouteProps) {
  const { isAdmin, loading } = useAuth();

  if (loading) return null;
  if (!isAdmin) return <Navigate to={redirectTo} replace />;

  return <>{children}</>;
}
