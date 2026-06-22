import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@clerk/clerk-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface SubscriptionData {
  subscribed: boolean;
  plan: 'start' | 'scale' | null;
  billing_cycle: 'monthly' | 'yearly' | null;
  status: 'active' | 'canceled' | 'past_due' | 'inactive' | 'trialing' | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id?: string;
}

export interface PlanFeatures {
  pipelines: number | 'unlimited';
  users: number | 'unlimited';
  followups_auto: boolean;
  leads_auto: boolean;
  reports_advanced: boolean;
  permissions: boolean;
  automations: boolean;
  ai: boolean;
}

export const PLAN_FEATURES: Record<'start' | 'scale', PlanFeatures> = {
  start: {
    pipelines: 1,
    users: 3,
    followups_auto: false,
    leads_auto: false,
    reports_advanced: false,
    permissions: false,
    automations: false,
    ai: false,
  },
  scale: {
    pipelines: 'unlimited',
    users: 'unlimited',
    followups_auto: true,
    leads_auto: true,
    reports_advanced: true,
    permissions: true,
    automations: false, // Coming soon
    ai: false, // Coming soon
  },
};

export const PLAN_PRICES = {
  start: {
    monthly: 117,
    yearly: 97, // Price per month when paid yearly
    yearly_total: 1164,
  },
  scale: {
    monthly: 237,
    yearly: 197, // Price per month when paid yearly
    yearly_total: 2364,
  },
};

export function useSubscription() {
  const { user, isLoaded: userLoaded } = useUser();
  const { profile, orgId: authOrgId } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const organizationId = profile?.organization_id || authOrgId;

  const checkSubscription = useCallback(async () => {
    if (!user?.id || !organizationId) {
      setSubscription({
        subscribed: false,
        plan: null,
        billing_cycle: null,
        status: null,
        current_period_end: null,
        cancel_at_period_end: false,
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data, error: fnError } = await supabase.functions.invoke('check-subscription', {
        headers: {
          'x-clerk-user-id': user.id,
          'x-clerk-org-id': organizationId,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      setSubscription(data);
      setError(null);
    } catch (err) {
      console.error('Error checking subscription:', err);
      setError(err as Error);
      setSubscription({
        subscribed: false,
        plan: null,
        billing_cycle: null,
        status: null,
        current_period_end: null,
        cancel_at_period_end: false,
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, organizationId]);

  // Check subscription on mount and when org changes
  useEffect(() => {
    if (userLoaded && (profile || organizationId)) {
      checkSubscription();
    }
  }, [userLoaded, profile, organizationId, checkSubscription]);

  // Refresh subscription periodically (every 60 seconds)
  useEffect(() => {
    if (!organizationId) return;
    
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [organizationId, checkSubscription]);

  const createCheckout = useCallback(async (plan: 'start' | 'scale', billingCycle: 'monthly' | 'yearly') => {
    if (!user || !organizationId) {
      toast.error('Você precisa estar logado para assinar um plano');
      return;
    }

    try {
      // Identity is derived server-side from the Clerk JWT and verified against
      // org_members. clerk_org_id is only a *requested* org id the server validates.
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: {
          plan,
          billingCycle,
          userEmail: user.primaryEmailAddress?.emailAddress,
          userName: user.fullName || user.firstName || 'Usuário',
          clerk_org_id: organizationId,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.url) {
        // Open Stripe Checkout in a new tab
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Error creating checkout:', err);
      toast.error('Erro ao iniciar checkout. Tente novamente.');
    }
  }, [user, organizationId]);

  const openCustomerPortal = useCallback(async () => {
    if (!user || !organizationId) {
      toast.error('Você precisa estar logado para gerenciar sua assinatura');
      return;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke('customer-portal', {
        headers: {
          'x-clerk-user-id': user.id,
          'x-clerk-org-id': organizationId,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Error opening customer portal:', err);
      toast.error('Erro ao abrir portal de gerenciamento. Tente novamente.');
    }
  }, [user, organizationId]);

  const hasFeature = useCallback((feature: keyof PlanFeatures): boolean => {
    if (!subscription?.subscribed || !subscription.plan) {
      return false;
    }
    
    const planFeatures = PLAN_FEATURES[subscription.plan];
    const featureValue = planFeatures[feature];
    
    // Boolean features
    if (typeof featureValue === 'boolean') {
      return featureValue;
    }
    
    // Unlimited features
    if (featureValue === 'unlimited') {
      return true;
    }
    
    // Numeric features - always return true if they have any value
    return featureValue > 0;
  }, [subscription]);

  const getFeatureLimit = useCallback((feature: 'pipelines' | 'users'): number | 'unlimited' => {
    if (!subscription?.subscribed || !subscription.plan) {
      return 0;
    }
    
    return PLAN_FEATURES[subscription.plan][feature];
  }, [subscription]);

  return {
    subscription,
    loading,
    error,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
    hasFeature,
    getFeatureLimit,
    isSubscribed: subscription?.subscribed ?? false,
    isPastDue: subscription?.status === 'past_due',
    isCanceled: subscription?.status === 'canceled',
  };
}
