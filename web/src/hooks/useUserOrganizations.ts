import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useClerk } from '@clerk/clerk-react';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';

export interface UserOrganization {
  organization_id: string;
  clerk_org_id: string | null;
  name: string;
  role: 'admin' | 'seller';
  is_current: boolean;
  logo_url: string | null;
}

export function useUserOrganizations() {
  const { user, orgId, profile, orgName, switchActiveOrg, refreshProfile } = useAuth();
  const { setActive } = useClerk();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const api = useApi();
  const [organizations, setOrganizations] = useState<UserOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !orgId || !profile) {
      setOrganizations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let logoUrl: string | null = null;
      try {
        const orgData = await api.organizations.me() as any;
        logoUrl = orgData?.logoUrl || orgData?.logo_url || null;
      } catch { /* non-critical */ }

      const org: UserOrganization = {
        organization_id: profile.organization_id || orgId,
        clerk_org_id: null,
        name: orgName || 'Minha Empresa',
        role: (profile.role as 'admin' | 'seller') || 'seller',
        is_current: true,
        logo_url: logoUrl,
      };
      setOrganizations([org]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, orgId, profile, orgName]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('org-details-updated', handler);
    return () => window.removeEventListener('org-details-updated', handler);
  }, [load]);

  const switchOrg = useCallback(
    async (target: UserOrganization) => {
      if (!user?.id) return;
      if (target.organization_id === orgId) return;
      setSwitching(true);
      try {
        if (target.clerk_org_id) {
          try {
            await setActive({ organization: target.clerk_org_id });
          } catch (err) {
            console.warn('switchOrg: Clerk setActive failed (non-critical)', err);
          }
        }

        switchActiveOrg({
          org_id: target.organization_id,
          clerk_org_id: target.clerk_org_id || 'unknown',
          role: target.role,
        });

        try { await refreshProfile(); } catch { /* non-critical */ }

        await queryClient.invalidateQueries();

        toast({ title: 'Organização alterada', description: `Você está agora em ${target.name}.` });
        navigate('/dashboard', { replace: true });
      } catch (err: any) {
        toast({ title: 'Erro ao trocar organização', description: err?.message || 'Tente novamente.', variant: 'destructive' });
      } finally {
        setSwitching(false);
      }
    },
    [user?.id, orgId, setActive, switchActiveOrg, queryClient, navigate, toast, refreshProfile]
  );

  return { organizations, loading, switching, switchOrg, reload: load };
}
