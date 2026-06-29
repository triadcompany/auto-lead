import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription, type PlanFeatures } from "@/hooks/useSubscription";

interface PlanGateProps {
  feature: keyof PlanFeatures;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredPlan?: "start" | "scale";
}

export function PlanGate({ feature, children, fallback, requiredPlan = "scale" }: PlanGateProps) {
  const { hasFeature } = useSubscription();
  const navigate = useNavigate();

  if (hasFeature(feature)) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="pointer-events-none select-none opacity-30 blur-[1px]">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
        <div className="text-center p-6">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-muted mx-auto mb-3">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold mb-1">
            Disponível no plano {requiredPlan === "scale" ? "Scale" : "Start"}
          </p>
          <p className="text-xs text-muted-foreground mb-4">Faça upgrade para desbloquear</p>
          <Button size="sm" onClick={() => navigate("/settings?tab=billing")}>
            Ver planos
          </Button>
        </div>
      </div>
    </div>
  );
}
