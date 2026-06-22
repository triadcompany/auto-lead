import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Clock, Activity } from "lucide-react";
import type { RunStats } from "@/hooks/useAutomations";

interface Props {
  stats: RunStats;
}

export function AutomationStatsCards({ stats }: Props) {
  const items = [
    { label: "Total", value: stats.total, icon: Activity, color: "text-primary" },
    { label: "Sucesso", value: stats.completed, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Erro", value: stats.failed, icon: XCircle, color: "text-destructive" },
    { label: "Pendente", value: stats.running + stats.waiting, icon: Clock, color: "text-amber-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <item.icon className={`h-5 w-5 ${item.color}`} />
            <div>
              <p className="text-2xl font-bold font-poppins">{item.value}</p>
              <p className="text-xs text-muted-foreground font-poppins">{item.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
