import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useUser, useSession } from '@clerk/clerk-react';

function resolveApiUrl(): string {
  const env = import.meta.env.VITE_API_URL as string
  if (env) return env
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:3000'
    return `${protocol}//${hostname.replace('-web.', '-api.')}`
  }
  return 'http://localhost:3000'
}

const API_URL = resolveApiUrl();

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
  name?: string;
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

function toProfile(raw: any): Profile | null {
  if (!raw) return null;
  return {
    id: raw.id,
    user_id: raw.userId ?? raw.user_id ?? null,
    clerk_user_id: raw.clerkUserId ?? raw.clerk_user_id ?? '',
    name: raw.name,
    email: raw.email,
    organization_id: raw.organizationId ?? raw.organization_id ?? '',
    created_at: raw.createdAt ?? raw.created_at ?? '',
    updated_at: raw.updatedAt ?? raw.updated_at ?? '',
    avatar_url: raw.avatarUrl ?? raw.avatar_url,
    whatsapp_e164: raw.whatsappE164 ?? raw.whatsapp_e164,
    onboarding_completed: raw.onboardingCompleted ?? raw.onboarding_completed,
  };
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
  const lastUserIdRef = useRef<string | null>(null);

  const bootstrap = useCallback(async (clerkUser: NonNullable<typeof user>) => {
    if (bootstrappingRef.current) return;
    bootstrappingRef.current = true;
    setError(null);

    try {
      const token = session ? await session.getToken() : null;
      if (!token) throw new Error('No session token');

      const email = clerkUser.primaryEmailAddress?.emailAddress || '';
      const name = clerkUser.fullName || clerkUser.firstName || email.split('@')[0] || 'User';
      const avatarUrl = clerkUser.imageUrl || undefined;

      // Consome o convite pendente (se houver) para anexar o usuário à empresa correta
      let invitationToken: string | undefined;
      try {
        invitationToken = sessionStorage.getItem('pending_invitation_token') || undefined;
      } catch { /* sessionStorage indisponível */ }

      const res = await withTimeout(
        fetch(`${API_URL}/auth/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email, name, avatar_url: avatarUrl, invitation_token: invitationToken }),
        }),
        12000,
        'auth/sync'
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'auth/sync failed');

      // Convite consumido com sucesso — limpa o token para não reprocessar
      if (invitationToken && !data.needsOnboarding) {
        try {
          sessionStorage.removeItem('pending_invitation_token');
          sessionStorage.removeItem('pending_invitation_org_id');
          sessionStorage.removeItem('pending_invitation_role');
        } catch { /* noop */ }
      }

      if (data.needsOnboarding) {
        setNeedsOnboarding(true);
        setProfile(null);
        setOrg(null);
        return;
      }

      setProfile(toProfile(data.profile));
      setRole((data.org?.role as 'admin' | 'seller') || null);
      setOrg(data.org ?? null);
      setNeedsOnboarding(false);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(err?.message || 'Bootstrap failed'));
    } finally {
      bootstrappingRef.current = false;
    }
  }, [session]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await withTimeout(bootstrap(user), 12000, 'refreshProfile');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Refresh failed'));
    } finally {
      setLoading(false);
    }
  }, [user, bootstrap]);

  const retryBootstrap = useCallback(async () => {
    if (!user) return;
    lastUserIdRef.current = null;
    setLoading(true);
    try {
      await withTimeout(bootstrap(user), 15000, 'retryBootstrap');
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [user, bootstrap]);

  const setActiveOrg = useCallback((next: OrgInfo) => {
    setOrg(next);
    setNeedsOnboarding(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      setProfile(null);
      setRole(null);
      setOrg(null);
      setLoading(false);
      setError(null);
      setNeedsOnboarding(false);
      lastUserIdRef.current = null;
      return;
    }

    if (lastUserIdRef.current === user.id) return;
    lastUserIdRef.current = user.id;

    setLoading(true);
    withTimeout(bootstrap(user), 15000, 'bootstrap')
      .catch((err: any) => {
        setError(err instanceof Error ? err : new Error(err?.message || 'Bootstrap failed'));
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
