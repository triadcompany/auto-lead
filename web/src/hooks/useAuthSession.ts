import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useUser, useSession } from '@clerk/clerk-react';
import { supabase, dynamicHeaders } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    ),
  ]);
}

export interface Profile {
  id: string;
  user_id: string | null;
  clerk_user_id: string;
  name: string;
  email: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  avatar_url?: string;
  whatsapp_e164?: string;
  onboarding_completed?: boolean;
}

export interface OrgInfo {
  org_id: string;
  clerk_org_id: string;
  role: 'admin' | 'seller';
}

interface UseAuthSessionReturn {
  profile: Profile | null;
  role: 'admin' | 'seller' | null;
  org: OrgInfo | null;
  loading: boolean;
  error: Error | null;
  needsOnboarding: boolean;
  refreshProfile: () => Promise<void>;
  retryBootstrap: () => Promise<void>;
  setActiveOrg: (next: OrgInfo) => void;
}

export function useAuthSession(): UseAuthSessionReturn {
  const { user, isLoaded } = useUser();
  const { session } = useSession();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<'admin' | 'seller' | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const bootstrappingRef = useRef(false);
  const refreshingRef = useRef(false);
  const lastBootstrappedUserIdRef = useRef<string | null>(null);

  // ── Edge function helper ─────────────────────────────────────────────────
  const callEdgeFunction = useCallback(async (fnName: string, body: Record<string, any>) => {
    let authHeader = `Bearer ${SUPABASE_KEY}`;
    if (session) {
      try {
        const token = await session.getToken();
        if (token) authHeader = `Bearer ${token}`;
      } catch { /* expired session — fall back to anon key */ }
    }
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `${fnName} failed with status ${res.status}`);
    }
    return data;
  }, [session]);

  // ── Load profile + role for a known user ────────────────────────────────
  const loadProfile = useCallback(async (clerkUser: NonNullable<typeof user>): Promise<void> => {
    const clerkUserId = clerkUser.id;
    const email = clerkUser.primaryEmailAddress?.emailAddress || '';
    const name = clerkUser.fullName || clerkUser.firstName || email.split('@')[0] || 'User';
    const avatarUrl = clerkUser.imageUrl || undefined;

    const { data: existingProfile, error: fetchError } = await withTimeout(
      Promise.resolve(
        supabase.from('profiles').select('*').eq('clerk_user_id', clerkUserId).maybeSingle()
      ),
      8000,
      'Profile fetch'
    );

    if (fetchError && !fetchError.message?.includes('No rows')) {
      throw new Error(fetchError.message);
    }

    if (!existingProfile) {
      // sync-login should have already created the profile — try RPC as fallback
      const { data: provisioned, error: provisionError } = await supabase.rpc(
        'provision_profile_from_membership' as any,
        { p_clerk_user_id: clerkUserId, p_email: email, p_name: name, p_avatar_url: avatarUrl ?? null } as any,
      );

      if (provisionError) {
        throw new Error(`Profile provisioning failed: ${provisionError.message}`);
      }

      if (provisioned) {
        const newProfile = provisioned as Profile;
        setProfile(newProfile);
        const { data: roleRow } = await supabase
          .from('user_roles').select('role')
          .eq('clerk_user_id', clerkUserId)
          .eq('organization_id', newProfile.organization_id)
          .maybeSingle();
        setRole((roleRow?.role as 'admin' | 'seller') || 'seller');
        return;
      }

      // No profile and no membership — genuine new user
      setNeedsOnboarding(true);
      setProfile(null);
      setRole(null);
      return;
    }

    // Profile found — sync email/name/avatar if changed
    let finalProfile: Profile = existingProfile as Profile;
    const needsUpdate =
      existingProfile.email !== email ||
      existingProfile.name !== name ||
      existingProfile.avatar_url !== avatarUrl;

    if (needsUpdate) {
      const { data: updated } = await supabase
        .from('profiles')
        .update({ email, name, avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('clerk_user_id', clerkUserId)
        .select()
        .single();
      if (updated) finalProfile = updated as Profile;
    }

    setProfile(finalProfile);

    // Resolve role — prefer user_roles, fall back to org_members
    const currentOrgId = finalProfile.organization_id;
    const { data: roleData } = currentOrgId
      ? await supabase.from('user_roles').select('role')
          .eq('clerk_user_id', clerkUserId).eq('organization_id', currentOrgId).maybeSingle()
      : await supabase.from('user_roles').select('role').eq('clerk_user_id', clerkUserId).maybeSingle();

    if (roleData?.role) {
      setRole(roleData.role as 'admin' | 'seller');
    } else {
      const { data: member } = await supabase
        .from('org_members').select('role')
        .eq('clerk_user_id', clerkUserId)
        .eq('organization_id', currentOrgId)
        .eq('status', 'active')
        .maybeSingle();
      setRole((member?.role as 'admin' | 'seller') || 'seller');
    }
  }, []);

  // ── Full bootstrap: sync-login → load profile ────────────────────────────
  const bootstrap = useCallback(async (clerkUser: NonNullable<typeof user>) => {
    if (bootstrappingRef.current) return;
    bootstrappingRef.current = true;
    setError(null);

    try {
      const clerkUserId = clerkUser.id;
      // Make the user ID available to PostgREST RLS immediately
      dynamicHeaders['x-clerk-user-id'] = clerkUserId;

      const email = clerkUser.primaryEmailAddress?.emailAddress || '';
      const fullName = clerkUser.fullName || clerkUser.firstName || email.split('@')[0] || 'User';
      const avatarUrl = clerkUser.imageUrl || undefined;

      let invitationToken: string | undefined;
      try {
        invitationToken = sessionStorage.getItem('pending_invitation_token') || undefined;
      } catch { /* sessionStorage unavailable */ }

      const syncPayload = {
        clerk_user_id: clerkUserId, email, full_name: fullName,
        avatar_url: avatarUrl, invitation_token: invitationToken,
      };

      // sync-login with automatic retry on failure
      let syncResult: any;
      try {
        syncResult = await withTimeout(callEdgeFunction('sync-login', syncPayload), 8000, 'sync-login');
      } catch (firstErr: any) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        syncResult = await withTimeout(callEdgeFunction('sync-login', syncPayload), 10000, 'sync-login retry');
      }

      if (syncResult.membership) {
        try { sessionStorage.removeItem('pending_invitation_token'); } catch { /* noop */ }
        setOrg({
          org_id: syncResult.membership.organization_id,
          clerk_org_id: syncResult.membership.clerk_org_id,
          role: syncResult.membership.role as 'admin' | 'seller',
        });
        setNeedsOnboarding(false);
      } else {
        // No membership returned — check if user has a Clerk org that hasn't synced yet
        const clerkMemberships = clerkUser.organizationMemberships;
        if (clerkMemberships && clerkMemberships.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const recheck = await withTimeout(
            callEdgeFunction('sync-login', syncPayload), 8000, 'sync-login recheck'
          );
          if (recheck.membership) {
            setOrg({
              org_id: recheck.membership.organization_id,
              clerk_org_id: recheck.membership.clerk_org_id,
              role: recheck.membership.role as 'admin' | 'seller',
            });
            setNeedsOnboarding(false);
          } else {
            setOrg(null);
            setNeedsOnboarding(true);
          }
        } else {
          setOrg(null);
          setNeedsOnboarding(true);
        }
      }

      // Load profile now that sync-login has run and profile should exist
      await loadProfile(clerkUser);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(err.message || 'Unknown error'));
    } finally {
      bootstrappingRef.current = false;
    }
  }, [callEdgeFunction, loadProfile]);

  // ── refreshProfile — re-sync profile/role without re-running sync-login ──
  const refreshProfile = useCallback(async () => {
    if (!user || refreshingRef.current) return;
    refreshingRef.current = true;
    setLoading(true);
    try {
      await withTimeout(loadProfile(user), 8000, 'refreshProfile');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Refresh failed'));
    } finally {
      setLoading(false);
      refreshingRef.current = false;
    }
  }, [user, loadProfile]);

  // ── retryBootstrap — full restart ────────────────────────────────────────
  const retryBootstrap = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await withTimeout(bootstrap(user), 15000, 'retryBootstrap');
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [user, bootstrap]);

  // ── setActiveOrg — in-memory org switch (after switchActiveOrg in context) ──
  const setActiveOrg = useCallback((next: OrgInfo) => {
    setOrg(next);
    setNeedsOnboarding(false);
    setError(null);
  }, []);

  // ── Effect: run bootstrap on first load ──────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      setProfile(null);
      setRole(null);
      setOrg(null);
      setLoading(false);
      setError(null);
      setNeedsOnboarding(false);
      lastBootstrappedUserIdRef.current = null;
      delete dynamicHeaders['x-clerk-user-id'];
      return;
    }

    let hasPendingInviteToken = false;
    try { hasPendingInviteToken = !!sessionStorage.getItem('pending_invitation_token'); } catch { /* noop */ }

    if (lastBootstrappedUserIdRef.current === user.id && !hasPendingInviteToken) return;
    lastBootstrappedUserIdRef.current = user.id;

    setLoading(true);
    withTimeout(bootstrap(user), 20000, 'bootstrap')
      .catch((err: any) => {
        setError(err instanceof Error ? err : new Error(err.message || 'Bootstrap failed'));
      })
      .finally(() => setLoading(false));
  }, [user, isLoaded, bootstrap]);

  return useMemo(() => ({
    profile,
    role,
    org,
    loading: !isLoaded || loading,
    error,
    needsOnboarding,
    refreshProfile,
    retryBootstrap,
    setActiveOrg,
  }), [profile, role, org, isLoaded, loading, error, needsOnboarding, refreshProfile, retryBootstrap, setActiveOrg]);
}
