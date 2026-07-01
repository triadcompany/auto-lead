import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check, Zap, CreditCard, AlertTriangle,
  ExternalLink, Loader2, Calendar, ArrowRight
} from "lucide-react";
import { useSubscription, PLAN_FEATURES, PLAN_PRICES, type BillingCycle } from "@/hooks/useSubscription";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const BILLING_OPTIONS: { value: BillingCycle; label: string; badge?: string }[] = [
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral", badge: "10% off" },
  { value: "semiannual", label: "Semestral", badge: "20% off" },
];

const CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
};

const startFeatures = [
  "Gestão de leads (kanban)",
  "2 pipelines de vendas",
  "WhatsApp conectado (inbox)",
  "Até 3 usuários",
  "2 automações ativas",
  "Follow-ups manuais",
  "Relatórios básicos",
];

const scaleFeatures = [
  "Tudo do plano Start",
  "Pipelines ilimitados",
  "Usuários ilimitados",
  "Automações ilimitadas",
  "IA de atendimento",
  "Disparo em massa",
  "Meta Ads (CAPI + Lead Ads)",
  "Relatórios avançados",
];

function cycleTotal(plan: "start" | "scale", cycle: BillingCycle): string {
  const p = PLAN_PRICES[plan];
  if (cycle === "quarterly") return `R$${p.quarterly_total} a cada 3 meses`;
  if (cycle === "semiannual") return `R$${p.semiannual_total} a cada 6 meses`;
  return "Cobrado mensalmente";
}

function cyclePrice(plan: "start" | "scale", cycle: BillingCycle): number {
  return PLAN_PRICES[plan][cycle];
}

export default function BillingSettings() {
  const {
    subscription,
    loading,
    createCheckout,
    openCustomerPortal,
    checkSubscription,
    isSubscribed,
    isTrialing,
    isTrial,
    trialDaysLeft,
    isPastDue,
  } = useSubscription();

  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("semiannual");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (sessionId && !syncLoading) syncSubscriptionFromCheckout(sessionId);
  }, [searchParams]);

  const syncSubscriptionFromCheckout = async (sessionId: string) => {
    setSyncLoading(true);
    try {
      await checkSubscription();
      toast.success("Assinatura confirmada com sucesso!");
      searchParams.delete("session_id");
      setSearchParams(searchParams, { replace: true });
    } catch {
      toast.error("Erro inesperado ao confirmar assinatura.");
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSubscribe = async (plan: "start" | "scale") => {
    setCheckoutLoading(plan);
    await createCheckout(plan, selectedCycle);
    setCheckoutLoading(null);
  };

  if (loading || syncLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {syncLoading && (
          <p className="text-sm text-muted-foreground">Confirmando sua assinatura...</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Trial ativo — mostra status + aviso */}
      {isTrialing && isTrial && (
        <Card className="border-2 border-primary bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Período de Teste — Scale
                </CardTitle>
                <CardDescription>
                  {trialDaysLeft === 0
                    ? "Seu teste termina hoje! Assine para não perder o acesso."
                    : `${trialDaysLeft} dia${trialDaysLeft !== 1 ? "s" : ""} restante${trialDaysLeft !== 1 ? "s" : ""} no período gratuito.`}
                </CardDescription>
              </div>
              <Badge variant="default" className="text-sm">TRIAL</Badge>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Assinatura real ativa */}
      {isSubscribed && !isTrial && subscription && (
        <Card className={cn("border-2", isPastDue ? "border-destructive bg-destructive/5" : "border-primary bg-primary/5")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {isPastDue && <AlertTriangle className="h-5 w-5 text-destructive" />}
                  Plano Atual
                </CardTitle>
                <CardDescription>
                  {isPastDue ? "Há um problema com seu pagamento" : "Sua assinatura está ativa"}
                </CardDescription>
              </div>
              <Badge variant={isPastDue ? "destructive" : "default"} className="text-sm">
                {subscription.plan?.toUpperCase()} · {subscription.billing_cycle ? CYCLE_LABEL[subscription.billing_cycle] : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {subscription.cancel_at_period_end ? (
                  <span>Cancela em {subscription.current_period_end && format(new Date(subscription.current_period_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                ) : (
                  <span>Renova em {subscription.current_period_end && format(new Date(subscription.current_period_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
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

      {/* Toggle de ciclo — mostra para não assinantes E para trial (podem assinar) */}
      {(!isSubscribed || isTrialing) && (
        <div className="flex items-center justify-center">
          <div className="flex items-center bg-muted rounded-xl p-1 gap-1">
            {BILLING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedCycle(opt.value)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                  selectedCycle === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
                {opt.badge && (
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {opt.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cards dos planos — mostra para não assinantes e trial */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Start */}
        <Card className={cn("border-2 transition-all", subscription?.plan === "start" ? "border-primary" : "border-border/50 hover:border-border")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Start</CardTitle>
              {subscription?.plan === "start" && <Badge>Seu plano</Badge>}
            </div>
            <CardDescription>Para organizar o processo comercial e ter controle dos leads.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">R${cyclePrice("start", selectedCycle)}</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{cycleTotal("start", selectedCycle)}</p>
            </div>

            {(!isSubscribed || isTrialing) && (
              <Button variant="outline" className="w-full" onClick={() => handleSubscribe("start")} disabled={checkoutLoading !== null}>
                {checkoutLoading === "start" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isTrialing ? "Assinar Start" : "Assinar Start"}
              </Button>
            )}
            {isSubscribed && !isTrial && subscription?.plan === "scale" && (
              <Button variant="outline" className="w-full" onClick={openCustomerPortal}>
                Fazer downgrade <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            )}

            <ul className="space-y-2">
              {startFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Scale */}
        <Card className={cn("border-2 relative", subscription?.plan === "scale" ? "border-primary" : "border-primary/50")}>
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
                Scale <Zap className="h-5 w-5 text-primary" />
              </CardTitle>
              {subscription?.plan === "scale" && <Badge>Seu plano</Badge>}
            </div>
            <CardDescription>Para escalar vendas com automação e inteligência.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">R${cyclePrice("scale", selectedCycle)}</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{cycleTotal("scale", selectedCycle)}</p>
            </div>

            {(!isSubscribed || isTrialing) && (
              <Button className="w-full" onClick={() => handleSubscribe("scale")} disabled={checkoutLoading !== null}>
                {checkoutLoading === "scale" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Assinar Scale <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {isSubscribed && !isTrial && subscription?.plan === "start" && (
              <Button className="w-full" onClick={openCustomerPortal}>
                Fazer upgrade <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            )}

            <ul className="space-y-2">
              {scaleFeatures.map((f, i) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <Check className={cn("h-4 w-4 shrink-0 mt-0.5 text-primary")} />
                  <span className={i === 0 ? "font-medium text-primary" : ""}>{f}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Todos os planos incluem suporte e atualizações gratuitas.{" "}
        <a href="mailto:suporte@autolead.com.br" className="text-primary hover:underline">
          Dúvidas? Fale conosco.
        </a>
      </p>
    </div>
  );
}
