import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { dynamicHeaders } from '@/integrations/supabase/client';
import { useClerk } from '@clerk/clerk-react';
import { useToast } from '@/hooks/use-toast';

export interface UserOrganization {
  organization_id: string;
  clerk_org_id: string | null;
  name: string;
  role: 'admin' | 'seller';
  is_current: boolean;
  logo_url: string | null;
}

/**
 * Lists every organization the logged-in user belongs to (via org_members)
 * and exposes a switchOrg() helper that updates profiles.organization_id and
 * the active Clerk organization, then reloads the app context.
 */
export function useUserOrganizations() {
  const { user, orgId, switchActiveOrg, refreshProfile } = useAuth();
  const { setActive } = useClerk();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [organizations, setOrganizations] = useState<UserOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setOrganizations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Use SECURITY DEFINER RPC because RLS on `organizations` is null in
      // Clerk-authenticated sessions. This returns name + logo joined.
      const { data: rows, error: rpcErr } = await supabase.rpc(
        'get_user_organizations_with_logos',
        { p_clerk_user_id: user.id } as any,
      );

      if (rpcErr) {
        console.error('useUserOrganizations: RPC error', rpcErr);
        setOrganizations([]);
        return;
      }

      const list: UserOrganization[] = ((rows as any[]) || [])
        .filter((row) => row?.organization_id)
        .map((row: any) => ({
          organization_id: row.organization_id,
          clerk_org_id: row.clerk_org_id,
          name: row.org_name || 'Organização',
          role: (row.role === 'admin' ? 'admin' : 'seller') as 'admin' | 'seller',
          is_current: row.organization_id === orgId,
          logo_url: row.logo_url ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setOrganizations(list);
    } finally {
      setLoading(false);
    }
  }, [user?.id, orgId]);

  useEffect(() => {
    load();
  }, [load]);

  // Reload when organization details (name/logo) are updated elsewhere
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
        // 1) Switch active org via SECURITY DEFINER RPC. The previous direct
        // UPDATE on profiles silently affected 0 rows because the UPDATE RLS
        // policy (`clerk_user_id = get_clerk_user_id()`) couldn't resolve the
        // Clerk identity from custom headers in PostgREST. The RPC bypasses
        // RLS and validates org_members membership server-side.
        const { data: switchData, error: switchErr } = await supabase.rpc(
          'switch_active_organization',
          {
            p_clerk_user_id: user.id,
            p_organization_id: target.organization_id,
          } as any,
        );

        if (switchErr) {
          throw new Error(switchErr.message);
        }

        // Verify the update landed by reading back via clerk_user_id
        const { data: verify, error: verifyErr } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('clerk_user_id', user.id)
          .maybeSingle();

        if (verifyErr) {
          console.warn('switchOrg: verify SELECT failed (continuing anyway)', verifyErr);
        } else if (verify && verify.organization_id !== target.organization_id) {
          throw new Error('A atualização do perfil não foi confirmada pelo banco.');
        }

        // 2) Switch active Clerk organization (best-effort, non-blocking).
        // Don't await — Clerk's setActive can hang and block the redirect.
        if (target.clerk_org_id && target.clerk_org_id !== 'unknown') {
          try {
            setActive({ organization: target.clerk_org_id }).catch((err) => {
              console.warn('switchOrg: Clerk setActive failed (non-critical)', err);
            });
          } catch (err) {
            console.warn('switchOrg: Clerk setActive threw (non-critical)', err);
          }
        }

        // 3) Update the in-memory AuthContext so every consumer (sidebar,
        // hooks reading orgId, RLS-derived headers) reflects the new org
        // immediately, without a full page reload.
        switchActiveOrg({
          org_id: target.organization_id,
          clerk_org_id: target.clerk_org_id || 'unknown',
          role: target.role,
        });

        // Make sure subsequent PostgREST calls carry the active org so
        // RLS-scoped policies pick up the new tenant immediately.
        dynamicHeaders['x-organization-id'] = target.organization_id;

        // 4) Refresh the profile object so AuthContext.profile reflects the
        // new organization_id, and re-resolve the role for that org via
        // user_roles. This keeps `isAdmin` and any UI bound to `profile`
        // (avatar, name, plan badge) consistent with the active org.
        try {
          await refreshProfile();
        } catch (e) {
          console.warn('switchOrg: refreshProfile failed (non-critical)', e);
        }

        // 5) Invalidate every react-query cache so leads, pipeline, inbox,
        // automations, etc. refetch under the new organization_id. They all
        // include orgId in their query keys, so the new context drives a
        // fresh fetch.
        await queryClient.invalidateQueries();

        toast({
          title: 'Organização alterada',
          description: `Você está agora em ${target.name}.`,
        });

        // 6) Navigate to the dashboard. Use `replace` so the user can't
        // back-button into a stale URL from the previous org.
        navigate('/dashboard', { replace: true });
      } catch (err: any) {
        toast({
          title: 'Erro ao trocar organização',
          description: err?.message || 'Tente novamente.',
          variant: 'destructive',
        });
      } finally {
        setSwitching(false);
      }
    },
    [user?.id, orgId, setActive, switchActiveOrg, queryClient, navigate, toast, refreshProfile]
  );

  return { organizations, loading, switching, switchOrg, reload: load };
}
