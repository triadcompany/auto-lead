import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface RoleGuardProps {
  allow: Array<'admin' | 'seller'>;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders children only if the current user's role is in the `allow` list.
 * Otherwise renders `fallback` (defaults to null).
 */
export function RoleGuard({ allow, fallback = null, children }: RoleGuardProps) {
  const { role, loading } = useAuth();

  if (loading) return null;
  if (!role || !allow.includes(role)) return <>{fallback}</>;

  return <>{children}</>;
}
