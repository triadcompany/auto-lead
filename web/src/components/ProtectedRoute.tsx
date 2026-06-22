import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user, profile, role, loading, error, refreshProfile, signOut, needsOnboarding, orgId } = useAuth();
  const location = useLocation();
  const [stuckLoading, setStuckLoading] = useState(false);

  // Diagnostic logging
  useEffect(() => {
    console.log('🛡️ ProtectedRoute state', {
      path: location.pathname,
      loading,
      user: !!user,
      hasProfile: !!profile,
      needsOnboarding,
      orgId,
      role,
      error: error?.message,
      onboardingCompleted: (profile as any)?.onboarding_completed,
    });
  }, [loading, user, profile, needsOnboarding, role, error, location.pathname, orgId]);

  // Detect stuck loading after 6 seconds
  useEffect(() => {
    if (!loading) {
      setStuckLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      if (loading) {
        console.warn('⚠️ ProtectedRoute: Loading stuck for 6s, showing recovery UI');
        setStuckLoading(true);
      }
    }, 6000);

    return () => clearTimeout(timer);
  }, [loading]);

  // Show toast when error occurs
  useEffect(() => {
    if (error && user && !profile && !needsOnboarding) {
      toast.error('Erro ao configurar conta', {
        description: 'Tente novamente em alguns segundos.',
        action: {
          label: 'Tentar novamente',
          onClick: refreshProfile,
        },
      });
    }
  }, [error, user, profile, needsOnboarding, refreshProfile]);

  // Loading state with stuck detection
  if (loading) {
    if (stuckLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center max-w-md p-6 space-y-4">
            <p className="font-poppins text-foreground">Demorando mais que o normal…</p>
            <p className="text-sm text-muted-foreground">
              Isso pode acontecer na primeira vez ou após uma atualização.
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <Button
                onClick={() => {
                  setStuckLoading(false);
                  refreshProfile();
                }}
                size="sm"
                className="font-poppins"
              >
                Tentar novamente
              </Button>
              <Button variant="outline" onClick={signOut} size="sm" className="font-poppins">
                Sair
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-2 font-poppins text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Needs onboarding — only if no org AND no completed flag
  if (needsOnboarding && !orgId && !(profile as any)?.onboarding_completed) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
  }

  // Profile missing but not onboarding — show retry UI
  if (!profile && !needsOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6 space-y-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="font-poppins text-foreground">Configurando sua conta...</p>
          <p className="text-sm text-muted-foreground">
            Isso pode levar alguns segundos na primeira vez.
          </p>
          {error && (
            <div className="space-y-2 pt-4">
              <p className="text-sm text-destructive">{error.message}</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={refreshProfile} size="sm" className="font-poppins">
                  Tentar novamente
                </Button>
                <Button variant="outline" onClick={signOut} size="sm" className="font-poppins">
                  Sair
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Admin check
  if (adminOnly && role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
