import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2, XCircle, Clock, Play, Loader2, AlertTriangle, Eye,
  RotateCw, Activity, Search,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

interface Run {
  id: string;
  automationId: string;
  status: string;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  automation?: { name: string } | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  running:   { label: "Rodando",    color: "bg-blue-500/10 text-blue-600 border-blue-200",           icon: Clock },
  completed: { label: "Concluído",  color: "bg-emerald-500/10 text-emerald-600 border-emerald-200",  icon: CheckCircle2 },
  failed:    { label: "Erro",       color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  waiting:   { label: "Aguardando", color: "bg-amber-500/10 text-amber-600 border-amber-200",         icon: AlertTriangle },
};

interface Props {
  organizationId: string | undefined;
}

export function AutomationExecutionsPanel({ organizationId }: Props) {
  const { isAdmin } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [workerRunning, setWorkerRunning] = useState(false);
  const [detailRun, setDetailRun] = useState<Run | null>(null);

  const fetchRuns = useCallback(async () => {
    if (!organizationId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await api.automations.allRuns(100);
      setRuns(Array.isArray(data) ? data : []);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const handleWorker = async () => {
    setWorkerRunning(true);
    try {
      await api.automations.triggerWorker();
    } catch { /* ignore */ }
    setTimeout(async () => {
      await fetchRuns();
      setWorkerRunning(false);
    }, 2000);
  };

  const stats = {
    total:     runs.length,
    completed: runs.filter(r => r.status === "completed").length,
    failed:    runs.filter(r => r.status === "failed").length,
    waiting:   runs.filter(r => r.status === "waiting").length,
    running:   runs.filter(r => r.status === "running").length,
  };

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total",      value: stats.total,     icon: Activity,      color: "text-primary" },
          { label: "Sucesso",    value: stats.completed, icon: CheckCircle2,  color: "text-emerald-600" },
          { label: "Erro",       value: stats.failed,    icon: XCircle,       color: "text-destructive" },
          { label: "Aguardando", value: stats.waiting,   icon: AlertTriangle, color: "text-amber-600" },
          { label: "Rodando",    value: stats.running,   icon: Clock,         color: "text-blue-600" },
        ].map((item) => (
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

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={fetchRuns} className="font-poppins gap-1.5">
          <RotateCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
        {isAdmin && (
          <Button
            variant="outline" size="sm" onClick={handleWorker}
            disabled={workerRunning} className="font-poppins gap-1.5"
          >
            {workerRunning
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processando...</>
              : <><Play className="h-3.5 w-3.5" /> Executar worker agora</>
            }
          </Button>
        )}
      </div>

      {/* Runs list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : runs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-10">
            <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-poppins text-center">
              Nenhuma execução registrada ainda. Ative uma automação e dispare um gatilho para ver os resultados aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-2">
            {runs.map((run) => {
              const cfg = statusConfig[run.status] || statusConfig.running;
              const Icon = cfg.icon;

              return (
                <Card key={run.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 shrink-0 ${
                        run.status === "completed" ? "text-emerald-600" :
                        run.status === "failed"    ? "text-destructive" :
                        run.status === "waiting"   ? "text-amber-600"   : "text-blue-600"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>
                            {cfg.label}
                          </Badge>
                          {run.automation?.name && (
                            <span className="text-xs font-medium font-poppins truncate">
                              {run.automation.name}
                            </span>
                          )}
                        </div>
                        {run.errorMessage && (
                          <p className="text-xs text-destructive mt-0.5 truncate font-poppins">
                            {run.errorMessage}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground font-poppins mt-0.5">
                          {format(new Date(run.startedAt), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                          {run.completedAt && (
                            <> · {Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s</>
                          )}
                        </p>
                      </div>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                        onClick={() => setDetailRun(run)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Detail modal */}
      <Dialog open={!!detailRun} onOpenChange={() => setDetailRun(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-poppins">Detalhes da Execução</DialogTitle>
          </DialogHeader>
          {detailRun && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground font-poppins">Status:</span>
                  <Badge variant="outline" className={`ml-2 ${(statusConfig[detailRun.status] || statusConfig.running).color}`}>
                    {(statusConfig[detailRun.status] || statusConfig.running).label}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground font-poppins">Automação:</span>
                  <span className="ml-2 font-poppins">{detailRun.automation?.name || detailRun.automationId}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-poppins">Início:</span>
                  <span className="ml-2 font-poppins">{format(new Date(detailRun.startedAt), "dd/MM/yy HH:mm:ss", { locale: ptBR })}</span>
                </div>
                {detailRun.completedAt && (
                  <div>
                    <span className="text-muted-foreground font-poppins">Fim:</span>
                    <span className="ml-2 font-poppins">{format(new Date(detailRun.completedAt), "dd/MM/yy HH:mm:ss", { locale: ptBR })}</span>
                  </div>
                )}
              </div>
              {detailRun.errorMessage && (
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="font-poppins font-medium text-destructive text-xs">Erro:</p>
                  <p className="font-poppins mt-1 text-xs">{detailRun.errorMessage}</p>
                </div>
              )}
              <p className="font-poppins text-xs text-muted-foreground">ID: {detailRun.id}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
