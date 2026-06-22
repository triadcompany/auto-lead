import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Check, X, Zap, Clock, CreditCard, AlertTriangle, 
  ExternalLink, Loader2, Calendar, ArrowRight
} from "lucide-react";
import { useSubscription, PLAN_FEATURES, PLAN_PRICES } from "@/hooks/useSubscription";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function BillingSettings() {
  const { 
    subscription, 
    loading, 
    createCheckout, 
    openCustomerPortal,
    checkSubscription,
    isSubscribed,
    isPastDue 
  } = useSubscription();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedBilling, setSelectedBilling] = useState<'monthly' | 'yearly'>('yearly');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  // Sync subscription when returning from Stripe checkout with session_id
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (sessionId && !syncLoading) {
      syncSubscriptionFromCheckout(sessionId);
    }
  }, [searchParams]);

  const syncSubscriptionFromCheckout = async (sessionId: string) => {
    setSyncLoading(true);
    try {
      console.log('[BillingSettings] Syncing subscription from checkout session:', sessionId);
      
      const { data, error } = await supabase.functions.invoke('sync-subscription-from-checkout', {
        body: { session_id: sessionId },
      });

      if (error) {
        console.error('[BillingSettings] Sync error:', error);
        toast.error('Erro ao sincronizar assinatura. Tente recarregar a página.');
        return;
      }

      if (data?.success) {
        console.log('[BillingSettings] Subscription synced successfully:', data);
        toast.success(`Plano ${data.plan?.toUpperCase()} ativado com sucesso!`);
        
        // Refresh subscription status
        await checkSubscription();
        
        // Remove session_id from URL to prevent re-sync
        searchParams.delete('session_id');
        setSearchParams(searchParams, { replace: true });
      } else {
        console.warn('[BillingSettings] Sync returned unsuccessful:', data);
        toast.error(data?.error || 'Não foi possível validar a assinatura.');
      }
    } catch (err) {
      console.error('[BillingSettings] Sync exception:', err);
      toast.error('Erro inesperado ao sincronizar assinatura.');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSubscribe = async (plan: 'start' | 'scale') => {
    setCheckoutLoading(plan);
    await createCheckout(plan, selectedBilling);
    setCheckoutLoading(null);
  };

  const startFeatures = [
    { text: "Gestão de leads", included: true },
    { text: "1 pipeline de vendas", included: true },
    { text: "Cadastro manual de leads", included: true },
    { text: "Follow-ups manuais", included: true },
    { text: "Tags básicas", included: true },
    { text: "Histórico de interações", included: true },
    { text: "Relatórios simples", included: true },
    { text: "Até 3 usuários", included: true },
  ];

  const scaleFeatures = [
    { text: "Tudo do plano Start", included: true, highlight: true },
    { text: "Pipelines ilimitados", included: true },
    { text: "Follow-ups automáticos", included: true },
    { text: "Cadastro automático de leads", included: true },
    { text: "Relatórios inteligentes", included: true },
    { text: "Tags avançadas", included: true },
    { text: "Usuários ilimitados", included: true },
    { text: "Controle de permissões", included: true },
  ];

  const scaleRoadmap = [
    "IA de atendimento",
    "IA que avança etapas do funil",
    "Sistema de multiatendimento",
    "Disparo em massa",
    "Automações avançadas",
  ];

  if (loading || syncLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {syncLoading && (
          <p className="text-sm text-muted-foreground">Validando sua assinatura...</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      {isSubscribed && subscription && (
        <Card className={cn(
          "border-2",
          isPastDue ? "border-destructive bg-destructive/5" : "border-primary bg-primary/5"
        )}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {isPastDue && <AlertTriangle className="h-5 w-5 text-destructive" />}
                  Plano Atual
                </CardTitle>
                <CardDescription>
                  {isPastDue 
                    ? "Há um problema com seu pagamento" 
                    : "Sua assinatura está ativa"
                  }
                </CardDescription>
              </div>
              <Badge variant={isPastDue ? "destructive" : "default"} className="text-sm">
                {subscription.plan?.toUpperCase()} - {subscription.billing_cycle === 'yearly' ? 'Anual' : 'Mensal'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {subscription.cancel_at_period_end ? (
                    <span>Cancela em {subscription.current_period_end && format(new Date(subscription.current_period_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                  ) : (
                    <span>Renova em {subscription.current_period_end && format(new Date(subscription.current_period_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                  )}
                </div>
                {isPastDue && (
                  <p className="text-sm text-destructive font-medium">
                    Atualize seu método de pagamento para continuar usando o AutoLead.
                  </p>
                )}
              </div>
              <Button onClick={openCustomerPortal} variant="outline">
                <CreditCard className="h-4 w-4 mr-2" />
                Gerenciar assinatura
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing Toggle */}
      {!isSubscribed && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setSelectedBilling('monthly')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              selectedBilling === 'monthly' 
                ? "bg-foreground text-background" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Mensal
          </button>
          <button
            onClick={() => setSelectedBilling('yearly')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              selectedBilling === 'yearly' 
                ? "bg-foreground text-background" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Anual
            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              2 meses grátis
            </span>
          </button>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Plan START */}
        <Card className={cn(
          "border-2 transition-all",
          subscription?.plan === 'start' ? "border-primary" : "border-border/50 hover:border-border"
        )}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Start</CardTitle>
              {subscription?.plan === 'start' && (
                <Badge>Seu plano</Badge>
              )}
            </div>
            <CardDescription>
              Para organizar o processo comercial e ter controle dos leads.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">
                  R$ {selectedBilling === 'yearly' ? PLAN_PRICES.start.yearly : PLAN_PRICES.start.monthly}
                </span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              {selectedBilling === 'yearly' && (
                <p className="text-sm text-muted-foreground mt-1">
                  Cobrado anualmente (R$ {PLAN_PRICES.start.yearly_total}/ano)
                </p>
              )}
            </div>

            {!isSubscribed && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleSubscribe('start')}
                disabled={checkoutLoading !== null}
              >
                {checkoutLoading === 'start' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Assinar Start
              </Button>
            )}

            {subscription?.plan === 'scale' && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={openCustomerPortal}
              >
                Fazer downgrade
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            )}

            <div className="space-y-3">
              <p className="text-sm font-semibold">O que está incluído:</p>
              <ul className="space-y-2">
                {startFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{feature.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Plan SCALE */}
        <Card className={cn(
          "border-2 relative",
          subscription?.plan === 'scale' ? "border-primary" : "border-primary/50"
        )}>
          {!subscription?.plan && (
            <div className="absolute top-0 right-0">
              <div className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded-bl-lg">
                Recomendado
              </div>
            </div>
          )}
          
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Scale
                <Zap className="h-5 w-5 text-primary" />
              </CardTitle>
              {subscription?.plan === 'scale' && (
                <Badge>Seu plano</Badge>
              )}
            </div>
            <CardDescription>
              Para escalar vendas com automação e inteligência.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">
                  R$ {selectedBilling === 'yearly' ? PLAN_PRICES.scale.yearly : PLAN_PRICES.scale.monthly}
                </span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              {selectedBilling === 'yearly' && (
                <p className="text-sm text-muted-foreground mt-1">
                  Cobrado anualmente (R$ {PLAN_PRICES.scale.yearly_total}/ano)
                </p>
              )}
            </div>

            {!isSubscribed && (
              <Button 
                className="w-full"
                onClick={() => handleSubscribe('scale')}
                disabled={checkoutLoading !== null}
              >
                {checkoutLoading === 'scale' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Assinar Scale
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}

            {subscription?.plan === 'start' && (
              <Button 
                className="w-full"
                onClick={openCustomerPortal}
              >
                Fazer upgrade
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            )}

            <div className="space-y-3">
              <p className="text-sm font-semibold">O que está incluído:</p>
              <ul className="space-y-2">
                {scaleFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm">
                    <Check className={cn(
                      "h-4 w-4 shrink-0 mt-0.5",
                      feature.highlight ? "text-primary" : "text-primary"
                    )} />
                    <span className={feature.highlight ? "font-medium text-primary" : ""}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-accent" />
                  <p className="text-sm font-semibold text-accent">Em breve:</p>
                </div>
                <ul className="space-y-2">
                  {scaleRoadmap.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm">
                      <div className="h-4 w-4 rounded-full border-2 border-accent/50 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Help Text */}
      <p className="text-center text-sm text-muted-foreground">
        Todos os planos incluem suporte por chat e atualizações gratuitas.{" "}
        <a href="mailto:suporte@autolead.com.br" className="text-primary hover:underline">
          Dúvidas? Fale conosco.
        </a>
      </p>
    </div>
  );
}
