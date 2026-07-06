import { useNavigate, useLocation } from "react-router-dom";
import { Zap, RefreshCw, Loader2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useState } from "react";

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { subscription, loading, error, isSubscribed, isExpired, trialUsed, startTrial } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  const [starting, setStarting] = useState(false);

  // Fail open: erro de rede não bloqueia o app
  if (error) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isSubscribed) return <>{children}</>;

  // Permite acesso às páginas de configurações e admin sem assinatura ativa
  if (location.pathname === "/settings" || location.pathname.startsWith("/admin/")) return <>{children}</>;

  // Trial expirado ou assinatura cancelada/inativa
  if (isExpired || (trialUsed && !isSubscribed)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-muted mx-auto">
            <RefreshCw className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-2">
              {subscription?.status === 'trialing' ? 'Teste encerrado' : 'Acesso suspenso'}
            </h1>
            <p className="text-muted-foreground">
              {isExpired
                ? "Seu período de teste chegou ao fim. Assine um plano para continuar usando o Triad CRM."
                : "Sua assinatura está inativa. Renove para voltar a usar o sistema."}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button size="lg" className="w-full" onClick={() => { window.location.href = "/settings?tab=billing"; }}>
              <Zap className="h-5 w-5 mr-2" />
              Ver planos e assinar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Dúvidas? Fale com a gente em{" "}
            <a href="mailto:suporte@autolead.com.br" className="text-primary hover:underline">
              suporte@autolead.com.br
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Sem assinatura e sem trial usado — tela de boas-vindas com opção de trial
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mx-auto">
          <Zap className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">Bem-vindo ao Triad CRM!</h1>
          <p className="text-muted-foreground">
            Teste gratuitamente por <strong>3 dias</strong> com acesso completo ao plano Scale, sem precisar de cartão.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full"
            onClick={async () => {
              setStarting(true);
              await startTrial();
              setStarting(false);
            }}
            disabled={starting}
          >
            {starting ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <FlaskConical className="h-5 w-5 mr-2" />
            )}
            Iniciar teste gratuito de 3 dias
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={() => { window.location.href = "/settings?tab=billing"; }}>
            Ver planos e preços
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Sem compromisso. Cancele quando quiser.
        </p>
      </div>
    </div>
  );
}
