import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { toast } from 'sonner';

export type BillingCycle = 'monthly' | 'quarterly' | 'semiannual';

export interface SubscriptionData {
  subscribed: boolean;
  plan: 'start' | 'scale' | null;
  billing_cycle: BillingCycle | null;
  status: 'active' | 'canceled' | 'past_due' | 'inactive' | 'trialing' | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id?: string;
}

export interface PlanFeatures {
  pipelines: number | 'unlimited';
  users: number | 'unlimited';
  automations_limit: number | 'unlimited';
  broadcasts: boolean;
  ai: boolean;
  meta_ads: boolean;
  reports_advanced: boolean;
}

export const PLAN_FEATURES: Record<'start' | 'scale', PlanFeatures> = {
  start: {
    pipelines: 2,
    users: 3,
    automations_limit: 2,
    broadcasts: false,
    ai: false,
    meta_ads: false,
    reports_advanced: false,
  },
  scale: {
    pipelines: 'unlimited',
    users: 'unlimited',
    automations_limit: 'unlimited',
    broadcasts: true,
    ai: true,
    meta_ads: true,
    reports_advanced: true,
  },
};

export const PLAN_PRICES = {
  start: {
    monthly: 197,
    quarterly: 177,
    quarterly_total: 531,
    semiannual: 157,
    semiannual_total: 942,
  },
  scale: {
    monthly: 397,
    quarterly: 357,
    quarterly_total: 1071,
    semiannual: 317,
    semiannual_total: 1902,
  },
};

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
};

export function useSubscription() {
  const { user, isLoaded: userLoaded } = useUser();
  const { profile, orgId: authOrgId } = useAuth();
  const api = useApi();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const organizationId = profile?.organization_id || authOrgId;

  const checkSubscription = useCallback(async () => {
    if (!user?.id || !organizationId) {
      setSubscription({ subscribed: false, plan: null, billing_cycle: null, status: null, current_period_end: null, cancel_at_period_end: false });
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await api.billing.subscription() as any;
      setSubscription(data);
      setError(null);
    } catch (err) {
      console.error('Error checking subscription:', err);
      setError(err as Error);
      setSubscription({ subscribed: false, plan: null, billing_cycle: null, status: null, current_period_end: null, cancel_at_period_end: false });
    } finally {
      setLoading(false);
    }
  }, [user?.id, organizationId, api]);

  useEffect(() => {
    if (userLoaded && (profile || organizationId)) {
      checkSubscription();
    }
  }, [userLoaded, profile, organizationId, checkSubscription]);

  useEffect(() => {
    if (!organizationId) return;
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [organizationId, checkSubscription]);

  const createCheckout = useCallback(async (plan: 'start' | 'scale', billingCycle: BillingCycle) => {
    if (!user || !organizationId) {
      toast.error('Você precisa estar logado para assinar um plano');
      return;
    }
    try {
      const data = await api.billing.checkout({ plan, billing_cycle: billingCycle }) as any;
      if (data?.checkout_url) window.open(data.checkout_url, '_blank');
      else if (data?.url) window.open(data.url, '_blank');
    } catch (err) {
      console.error('Error creating checkout:', err);
      toast.error('Erro ao iniciar checkout. Tente novamente.');
    }
  }, [user, organizationId, api]);

  const openCustomerPortal = useCallback(async () => {
    if (!user || !organizationId) {
      toast.error('Você precisa estar logado para gerenciar sua assinatura');
      return;
    }
    try {
      const data = await api.billing.portal(window.location.href) as any;
      if (data?.portal_url) window.open(data.portal_url, '_blank');
      else if (data?.url) window.open(data.url, '_blank');
    } catch (err) {
      console.error('Error opening customer portal:', err);
      toast.error('Erro ao abrir portal de gerenciamento. Tente novamente.');
    }
  }, [user, organizationId, api]);

  const hasFeature = useCallback((feature: keyof PlanFeatures): boolean => {
    if (!subscription?.subscribed || !subscription.plan) return false;
    const featureValue = PLAN_FEATURES[subscription.plan][feature];
    if (typeof featureValue === 'boolean') return featureValue;
    if (featureValue === 'unlimited') return true;
    return (featureValue as number) > 0;
  }, [subscription]);

  const getFeatureLimit = useCallback((feature: 'pipelines' | 'users' | 'automations_limit'): number | 'unlimited' => {
    if (!subscription?.subscribed || !subscription.plan) return 0;
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
