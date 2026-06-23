import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useUser, useAuth as useClerkAuth, useClerk, useOrganization } from '@clerk/clerk-react';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useClerkAvailable } from '@/providers/ClerkProvider';

interface Profile {
  id: string;
  user_id: string;
  clerk_user_id?: string;
  name: string;
  email: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  avatar_url?: string;
  whatsapp_e164?: string;
}

interface CompatUser {
  id: string;
  email?: string;
}

interface AuthContextType {
  user: CompatUser | null;
  session: any | null;
  profile: Profile | null;
  role: 'admin' | 'seller' | 'pre_sales' | null;
  error: Error | null;
  loading: boolean;
  needsOnboarding: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string, organizationName?: string) => Promise<{ error: any; data?: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  retryBootstrap: () => Promise<void>;
  switchActiveOrg: (next: { org_id: string; clerk_org_id: string; role: 'admin' | 'seller' | 'pre_sales' }) => void;
  isAdmin: boolean;
  orgId: string | null;
  clerkOrgId: string | null;
  userName: string;
  userEmail: string;
  orgName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProviderWithClerk({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerkAuth();
  const { openSignIn, openSignUp } = useClerk();
  const { organization: clerkOrganization } = useOrganization();

  const {
    profile, role, org, loading: sessionLoading, error,
    needsOnboarding, refreshProfile, retryBootstrap, setActiveOrg,
  } = useAuthSession();

  const user: CompatUser | null = clerkUser
    ? { id: clerkUser.id, email: clerkUser.primaryEmailAddress?.emailAddress }
    : null;

  const loading = !clerkLoaded || sessionLoading;

  // If user has an org or completed onboarding, they don't need onboarding
  const hasOrg = !!org;
  const profileOnboardingDone = profile && (profile as any).onboarding_completed === true;
  const resolvedNeedsOnboarding = hasOrg || profileOnboardingDone ? false : needsOnboarding;

  const signIn = useCallback(async (_email: string, _password: string): Promise<{ error: any }> => {
    try {
      openSignIn();
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  }, [openSignIn]);

  const signUp = useCallback(async (_email: string, _password: string, _name: string, _organizationName?: string): Promise<{ error: any; data?: any }> => {
    try {
      openSignUp();
      return { error: null, data: null };
    } catch (err) {
      return { error: err, data: null };
    }
  }, [openSignUp]);

  const signOut = useCallback(async () => {
    await clerkSignOut();
  }, [clerkSignOut]);

  // SECURITY: derive isAdmin from the single source of truth returned by sync-login
  const effectiveRole = org?.role ?? role;
  const isAdmin = effectiveRole === 'admin';

  const userName = clerkUser?.fullName
    || clerkUser?.firstName
    || clerkUser?.primaryEmailAddress?.emailAddress?.split('@')[0]
    || '';
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || '';
  const orgName = clerkOrganization?.name || '';

  const switchActiveOrg = useCallback(
    (next: { org_id: string; clerk_org_id: string; role: 'admin' | 'seller' }) => {
      setActiveOrg(next);
    },
    [setActiveOrg]
  );

  const value: AuthContextType = useMemo(() => ({
    user,
    session: clerkUser ? { user: clerkUser } : null,
    profile,
    role: org?.role || role,
    error,
    loading,
    needsOnboarding: resolvedNeedsOnboarding,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    retryBootstrap,
    switchActiveOrg,
    isAdmin,
    orgId: org?.org_id || profile?.organization_id || null,
    clerkOrgId: org?.clerk_org_id || null,
    userName,
    userEmail,
    orgName,
  }), [user, clerkUser, profile, role, error, loading, resolvedNeedsOnboarding, signIn, signUp, signOut, refreshProfile, retryBootstrap, switchActiveOrg, isAdmin, org, userName, userEmail, orgName]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function AuthProviderFallback({ children }: { children: React.ReactNode }) {
  const signIn = useCallback(async (_email: string, _password: string): Promise<{ error: any }> => {
    console.error('Clerk is not configured. Please add VITE_CLERK_PUBLISHABLE_KEY.');
    return { error: new Error('Clerk not configured') };
  }, []);

  const signUp = useCallback(async (_email: string, _password: string, _name: string, _organizationName?: string): Promise<{ error: any; data?: any }> => {
    console.error('Clerk is not configured. Please add VITE_CLERK_PUBLISHABLE_KEY.');
    return { error: new Error('Clerk not configured'), data: null };
  }, []);

  const signOut = useCallback(async () => {
    console.error('Clerk is not configured. Please add VITE_CLERK_PUBLISHABLE_KEY.');
  }, []);

  const refreshProfile = useCallback(async () => {}, []);

  const value: AuthContextType = useMemo(() => ({
    user: null, session: null, profile: null, role: null, error: null,
    loading: false, needsOnboarding: false,
    signIn, signUp, signOut, refreshProfile,
    retryBootstrap: refreshProfile,
    switchActiveOrg: () => {},
    isAdmin: false, orgId: null, clerkOrgId: null,
    userName: '', userEmail: '', orgName: '',
  }), [signIn, signUp, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const clerkAvailable = useClerkAvailable();
  if (!clerkAvailable) {
    console.warn('⚠️ Clerk is not available. Authentication will not work.');
    return <AuthProviderFallback>{children}</AuthProviderFallback>;
  }
  return <AuthProviderWithClerk>{children}</AuthProviderWithClerk>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
