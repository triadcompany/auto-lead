import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2, XCircle, Clock, Play, Loader2, AlertTriangle, Eye,
  RotateCw, Activity, Search, Send,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Execution {
  id: string;
  organization_id: string;
  trace_id: string;
  event_name: string;
  automation_id: string | null;
  status: string;
  fail_reason: string | null;
  message_text: string | null;
  phone: string | null;
  channel: string | null;
  debug_json: Record<string, unknown>;
  created_at: string;
}

interface ExecStats {
  total: number;
  success: number;
  error: number;
  no_match: number;
  pending: number;
}

interface WorkerHeartbeat {
  worker_name: string;
  last_run_at: string;
  processed_count: number;
  error_count: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);

async function apiCall(action: string, params: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/automations-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ action, ...params }),
  });
  return res.json();
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  received:            { label: "Recebido",    color: "bg-blue-500/10 text-blue-600 border-blue-200", icon: Clock },
  event_published:     { label: "Publicado",   color: "bg-blue-500/10 text-blue-600 border-blue-200", icon: Clock },
  automation_fired:    { label: "Disparou",    color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
  success:             { label: "Sucesso",     color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
  no_match:            { label: "Sem match",   color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: AlertTriangle },
  filter_failed:       { label: "Filtro",      color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  keyword_not_matched: { label: "Keyword ✗",   color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  error:               { label: "Erro",        color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  skipped:             { label: "Pulado",      color: "bg-muted text-muted-foreground border-muted", icon: Clock },
};

interface Props {
  organizationId: string | undefined;
}

export function AutomationExecutionsPanel({ organizationId }: Props) {
  const { isAdmin, profile } = useAuth();
  const { toast } = useToast();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [stats, setStats] = useState<ExecStats>({ total: 0, success: 0, error: 0, no_match: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [heartbeat, setHeartbeat] = useState<WorkerHeartbeat | null>(null);
  const [workerRunning, setWorkerRunning] = useState(false);
  const [detailExec, setDetailExec] = useState<Execution | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  const [simPhone, setSimPhone] = useState("5547999999999");
  const [simText, setSimText] = useState("anuncio");
  const [simLoading, setSimLoading] = useState(false);

  const fetchExecutions = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const result = await apiCall("list_executions", { organization_id: organizationId, limit: 50 });
    if (result.ok) {
      setExecutions(result.items || []);
      setStats(result.stats || { total: 0, success: 0, error: 0, no_match: 0, pending: 0 });
    }
    setLoading(false);
  }, [organizationId]);

  const fetchHeartbeat = useCallback(async () => {
    const result = await apiCall("worker_heartbeat", {});
    if (result.ok && result.heartbeat) {
      setHeartbeat(result.heartbeat);
    }
  }, []);

  useEffect(() => {
    fetchExecutions();
    fetchHeartbeat();
  }, [fetchExecutions, fetchHeartbeat]);

  const handleWorker = async () => {
    setWorkerRunning(true);
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/automation-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({}),
      });
    } catch { /* ignore */ }
    setTimeout(async () => {
      await fetchExecutions();
      await fetchHeartbeat();
      setWorkerRunning(false);
    }, 2000);
  };

  const handleSimulate = async () => {
    if (!organizationId || !simPhone.trim()) return;
    setSimLoading(true);
    try {
      const result = await apiCall("simulate_inbound", {
        organization_id: organizationId,
        phone: simPhone.trim(),
        channel: "whatsapp",
        message_body: simText.trim() || "anuncio",
        actor_user_id: profile?.id || null,
        actor_type: "admin_ui",
      });
      if (result.ok) {
        toast({
          title: "Evento simulado!",
          description: `trace_id: ${result.trace_id}. Atualizando execuções...`,
        });
        setSimOpen(false);
        // Wait for processing then refresh
        setTimeout(async () => {
          await fetchExecutions();
          await fetchHeartbeat();
        }, 3000);
      } else {
        toast({ title: "Erro", description: result.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erro", description: String(err), variant: "destructive" });
    }
    setSimLoading(false);
  };

  const heartbeatAge = heartbeat
    ? Math.round((Date.now() - new Date(heartbeat.last_run_at).getTime()) / 60000)
    : null;

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Activity, color: "text-primary" },
          { label: "Sucesso", value: stats.success, icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Erro/Filtro", value: stats.error, icon: XCircle, color: "text-destructive" },
          { label: "Sem match", value: stats.no_match, icon: AlertTriangle, color: "text-amber-600" },
          { label: "Pendente", value: stats.pending, icon: Clock, color: "text-blue-600" },
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

      {/* Worker heartbeat + actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {heartbeat && heartbeatAge !== null && (
          <Badge variant="outline" className="font-poppins text-xs gap-1">
            <Activity className="h-3 w-3" />
            Worker: {heartbeatAge < 1 ? "agora" : `${heartbeatAge} min atrás`}
            {" · "}{heartbeat.processed_count} proc · {heartbeat.error_count} err
          </Badge>
        )}
        <Button variant="outline" size="sm" onClick={fetchExecutions} className="font-poppins gap-1.5">
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
        {isAdmin && (
          <Button
            variant="outline" size="sm" onClick={() => setSimOpen(true)}
            className="font-poppins gap-1.5"
          >
            <Send className="h-3.5 w-3.5" /> Simular Primeira Mensagem
          </Button>
        )}
      </div>

      {/* Executions list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : executions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-10">
            <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-poppins text-center">
              Nenhuma execução registrada. Use "Simular Primeira Mensagem" ou envie uma mensagem com a palavra-chave para testar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-2">
            {executions.map((exec) => {
              const cfg = statusConfig[exec.status] || statusConfig.received;
              const Icon = cfg.icon;
              const debug = exec.debug_json || {};

              return (
                <Card key={exec.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 shrink-0 ${
                        exec.status === "success" || exec.status === "automation_fired" ? "text-emerald-600" :
                        exec.status === "error" || exec.status === "filter_failed" || exec.status === "keyword_not_matched" ? "text-destructive" :
                        exec.status === "no_match" ? "text-amber-600" : "text-blue-600"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>
                            {cfg.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-poppins">
                            {exec.event_name}
                          </span>
                          {(debug as any).automation_name && (
                            <span className="text-xs font-medium font-poppins truncate">
                              → {String((debug as any).automation_name)}
                            </span>
                          )}
                          {exec.phone && (
                            <span className="text-[10px] text-muted-foreground font-poppins">
                              📱 {exec.phone.slice(-8)}
                            </span>
                          )}
                          {(debug as any).simulated && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">SIM</Badge>
                          )}
                        </div>
                        {exec.fail_reason && (
                          <p className="text-xs text-destructive mt-0.5 truncate font-poppins">
                            {exec.fail_reason}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground font-poppins mt-0.5">
                          {format(new Date(exec.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                          {" · trace: "}{exec.trace_id.substring(0, 16)}
                        </p>
                      </div>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                        onClick={() => setDetailExec(exec)}
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
      <Dialog open={!!detailExec} onOpenChange={() => setDetailExec(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="font-poppins">Detalhes da Execução</DialogTitle>
          </DialogHeader>
          {detailExec && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground font-poppins">Status:</span>
                  <Badge variant="outline" className={`ml-2 ${(statusConfig[detailExec.status] || statusConfig.received).color}`}>
                    {(statusConfig[detailExec.status] || statusConfig.received).label}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground font-poppins">Trace ID:</span>
                  <span className="ml-2 font-mono text-xs">{detailExec.trace_id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-poppins">Evento:</span>
                  <span className="ml-2 font-poppins">{detailExec.event_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-poppins">Criado:</span>
                  <span className="ml-2 font-poppins">
                    {format(new Date(detailExec.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                  </span>
                </div>
                {detailExec.phone && (
                  <div>
                    <span className="text-muted-foreground font-poppins">Telefone:</span>
                    <span className="ml-2 font-poppins">{detailExec.phone}</span>
                  </div>
                )}
                {detailExec.channel && (
                  <div>
                    <span className="text-muted-foreground font-poppins">Canal:</span>
                    <span className="ml-2 font-poppins">{detailExec.channel}</span>
                  </div>
                )}
              </div>
              {detailExec.fail_reason && (
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-sm font-poppins font-medium text-destructive">Motivo da falha:</p>
                  <p className="text-sm font-poppins mt-1">{detailExec.fail_reason}</p>
                </div>
              )}
              {detailExec.message_text && (
                <div>
                  <p className="text-sm font-poppins font-medium mb-1">Mensagem:</p>
                  <p className="text-sm font-poppins bg-muted p-2 rounded">{detailExec.message_text}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-poppins font-medium mb-2">Debug JSON:</p>
                <pre className="bg-muted p-3 rounded-lg text-xs font-mono overflow-auto max-h-[300px] whitespace-pre-wrap">
                  {JSON.stringify(detailExec.debug_json, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Simulate modal */}
      <Dialog open={simOpen} onOpenChange={setSimOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-poppins">Simular Primeira Mensagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-poppins">Telefone</Label>
              <Input value={simPhone} onChange={(e) => setSimPhone(e.target.value)}
                placeholder="5547999999999" className="font-poppins" />
            </div>
            <div>
              <Label className="font-poppins">Texto da mensagem</Label>
              <Input value={simText} onChange={(e) => setSimText(e.target.value)}
                placeholder="anuncio" className="font-poppins" />
            </div>
            <p className="text-xs text-muted-foreground font-poppins">
              Publica um evento <code>inbound.first_message</code> no Event Bus, sem depender do WhatsApp real.
              O event-dispatcher e o worker processarão normalmente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSimOpen(false)} className="font-poppins">Cancelar</Button>
            <Button onClick={handleSimulate} disabled={simLoading || !simPhone.trim()} className="btn-gradient text-white font-poppins gap-2">
              {simLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Simular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
