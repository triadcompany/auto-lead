import { useAuth } from '@/contexts/AuthContext';

/**
 * Convenience hook for organization & role access.
 * Wraps AuthContext — no new state, no extra queries.
 */
export function useOrgRole() {
  const { orgId, role, isAdmin, loading, refreshProfile } = useAuth();

  return {
    orgId,
    role,
    isAdmin,
    isSeller: role === 'seller',
    loading,
    refresh: refreshProfile,
  };
}
