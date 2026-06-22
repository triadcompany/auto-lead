import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2, XCircle, Clock, Play, Loader2, ChevronDown, ChevronRight,
  AlertTriangle, Info, Bug,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AutomationRun, AutomationLog } from "@/hooks/useAutomations";

interface Props {
  runs: AutomationRun[];
  loading: boolean;
  onLoadLogs: (runId: string) => Promise<AutomationLog[]>;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  running:   { label: "Em execução", color: "bg-blue-500/10 text-blue-600 border-blue-200", icon: Loader2 },
  completed: { label: "Concluído",   color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
  failed:    { label: "Erro",        color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  waiting:   { label: "Aguardando",  color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: Clock },
};

const levelIcons: Record<string, React.ElementType> = {
  info: Info,
  warn: AlertTriangle,
  error: XCircle,
  debug: Bug,
};

export function AutomationRunsPanel({ runs, loading, onLoadLogs }: Props) {
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, AutomationLog[]>>({});
  const [logsLoading, setLogsLoading] = useState<string | null>(null);

  const toggleRun = async (runId: string) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
      return;
    }
    setExpandedRun(runId);
    if (!logs[runId]) {
      setLogsLoading(runId);
      const result = await onLoadLogs(runId);
      setLogs((prev) => ({ ...prev, [runId]: result }));
      setLogsLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center py-10">
          <Play className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground font-poppins">Nenhuma execução registrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="max-h-[600px]">
      <div className="space-y-2">
        {runs.map((run) => {
          const cfg = statusConfig[run.status] || statusConfig.running;
          const Icon = cfg.icon;
          const isExpanded = expandedRun === run.id;
          const runLogs = logs[run.id] || [];
          const ctx = run.context as Record<string, unknown> | null;

          return (
            <Card key={run.id} className="overflow-hidden">
              <button
                className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                onClick={() => toggleRun(run.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}

                  <Icon className={`h-4 w-4 shrink-0 ${run.status === "running" ? "animate-spin" : ""} ${
                    run.status === "completed" ? "text-emerald-600" :
                    run.status === "failed" ? "text-destructive" :
                    run.status === "waiting" ? "text-amber-600" : "text-blue-600"
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium font-poppins truncate">
                        {ctx?.lead_name ? String(ctx.lead_name) : `${run.entity_type} ${run.entity_id.slice(0, 8)}...`}
                      </span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>
                        {cfg.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-poppins">
                      {format(new Date(run.started_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      {run.finished_at && ` → ${format(new Date(run.finished_at), "HH:mm", { locale: ptBR })}`}
                    </p>
                  </div>
                </div>

                {run.last_error && (
                  <p className="text-xs text-destructive mt-1 ml-11 truncate font-poppins">{run.last_error}</p>
                )}
              </button>

              {isExpanded && (
                <div className="border-t bg-muted/10 px-4 pb-4 pt-2">
                  {logsLoading === run.id ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : runLogs.length === 0 ? (
                    <p className="text-xs text-muted-foreground font-poppins py-2">Nenhum log encontrado</p>
                  ) : (
                    <div className="relative ml-4 border-l-2 border-muted-foreground/20 pl-4 space-y-3 pt-2">
                      {runLogs.map((log) => {
                        const LevelIcon = levelIcons[log.level] || Info;
                        return (
                          <div key={log.id} className="relative">
                            <div className="absolute -left-[22px] top-0.5 w-3 h-3 rounded-full bg-background border-2 border-muted-foreground/30" />
                            <div className="flex items-start gap-2">
                              <LevelIcon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                                log.level === "error" ? "text-destructive" :
                                log.level === "warn" ? "text-amber-500" : "text-muted-foreground"
                              }`} />
                              <div className="min-w-0">
                                <p className="text-xs font-poppins leading-relaxed">{log.message}</p>
                                <p className="text-[10px] text-muted-foreground font-poppins">
                                  {format(new Date(log.created_at), "HH:mm:ss", { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}
