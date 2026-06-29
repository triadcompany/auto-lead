import { useNavigate } from "react-router-dom";
import { Clock, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useState } from "react";

export function TrialBanner() {
  const { isTrialing, trialDaysLeft } = useSubscription();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (!isTrialing || dismissed) return null;

  const isUrgent = (trialDaysLeft ?? 0) <= 1;

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2 text-sm ${isUrgent ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" />
        <span>
          {trialDaysLeft === 0
            ? "Seu período de teste termina hoje!"
            : `Teste grátis do plano Scale — ${trialDaysLeft} dia${trialDaysLeft !== 1 ? "s" : ""} restante${trialDaysLeft !== 1 ? "s" : ""}`}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          onClick={() => navigate("/settings?tab=billing")}
        >
          <Zap className="h-3 w-3 mr-1" />
          Assinar agora
        </Button>
        <button onClick={() => setDismissed(true)} className="opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
