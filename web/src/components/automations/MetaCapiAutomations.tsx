import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, Eye, Check, X, Info, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───
interface QueueItem {
  id: string;
  organization_id: string;
  lead_id: string | null;
  event_name: string;
  channel: string;
  payload: any;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_retry_at: string | null;
  sent_at: string | null;
  event_hash: string;
  pipeline_id: string | null;
  stage_id: string | null;
  automation_id: string | null;
  created_at: string;
  updated_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);

const META_EVENT_OPTIONS = [
  "Lead", "QualifiedLead", "Schedule", "Contact",
  "SubmitApplication", "InitiateCheckout", "Purchase",
];

async function callMetaCapiEndpoint(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? SUPABASE_KEY;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-capi-settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

export function MetaCapiAutomations() {
  const { profile, role, orgId: authOrgId, user } = useAuth();
  const orgId = profile?.organization_id || authOrgId;
  const profileId = profile?.id || user?.id || null;
  const isAdmin = role === "admin";
  const [pixelConfigured, setPixelConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (!orgId) return;
    (supabase as any)
      .from("meta_capi_settings")
      .select("id, enabled")
      .eq("organization_id", orgId)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        setPixelConfigured(!!(data?.id));
      });
  }, [orgId]);

  if (!orgId) {
    return (
      <div className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>Carregando dados do usuário...</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pixelConfigured === false && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
            <span>
              Nenhum Pixel configurado. Configure o Pixel ID e Access Token antes de usar os envios de eventos.
            </span>
            <a
              href="/settings?tab=meta-ads"
              className="underline font-medium whitespace-nowrap"
            >
              Ir para Configurações →
            </a>
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Os envios de eventos para a Meta são definidos como <strong>ações dentro das Automações</strong>.
          A conexão técnica (Pixel ID, Token) é configurada em <strong>Configurações → Meta Ads (CAPI)</strong>.
        </AlertDescription>
      </Alert>

      <LogsCard orgId={orgId} profileId={profileId} isAdmin={isAdmin} />
    </div>
  );
}

// ═══════════ LOGS CARD (same source as Settings — event_dispatch_queue via edge function) ═══════════
function LogsCard({ orgId, profileId, isAdmin }: { orgId: string; profileId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("7d");
  const [runningWorker, setRunningWorker] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { status: httpStatus, data } = await callMetaCapiEndpoint({
        action: "queue_logs",
        profile_id: profileId,
        organization_id: orgId,
        payload: { status: statusFilter, event_name: eventFilter, period: periodFilter },
      });

      if (isAdmin) {
        console.log("[MetaCapiAutomations] endpoint=meta-capi-settings action=queue_logs", {
          orgId,
          httpStatus,
          itemsReturned: data.items?.length ?? 0,
        });
      }

      if (!data.ok) throw new Error(`HTTP ${httpStatus}: ${data.message || "Erro ao carregar"}`);
      setItems(data.items || []);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar fila");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, profileId, statusFilter, eventFilter, periodFilter, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const handleRunWorker = async () => {
    setRunningWorker(true);
    try {
      const { data } = await callMetaCapiEndpoint({
        action: "run_worker",
        profile_id: profileId,
        organization_id: orgId,
      });
      if (data.ok) {
        const wr = data.worker_result || {};
        toast.success(`Worker executado: ${wr.processed || 0} processados, ${wr.errors || 0} erros`);
        load();
      } else {
        toast.error(data.message || "Erro ao executar worker");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro de rede");
    } finally {
      setRunningWorker(false);
    }
  };

  const handleQueueAction = async (queueId: string, actionType: string) => {
    setActionLoading(queueId);
    try {
      const { data } = await callMetaCapiEndpoint({
        action: "queue_action",
        profile_id: profileId,
        organization_id: orgId,
        payload: { queue_id: queueId, action_type: actionType },
      });
      if (data.ok) {
        toast.success(data.message);
        load();
      } else {
        toast.error(data.message || "Erro");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-200"><Check className="h-3 w-3" /> Enviado</Badge>;
      case "pending":
        return <Badge variant="secondary" className="gap-1 text-xs">⏳ Pendente</Badge>;
      case "processing":
        return <Badge className="gap-1 text-xs bg-blue-500">⚙️ Enviando</Badge>;
      case "failed":
        return <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-200">⚠️ Falhou</Badge>;
      case "dead":
        return <Badge variant="destructive" className="gap-1 text-xs"><X className="h-3 w-3" /> Morto</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1 text-xs">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="font-poppins">Fila de Eventos Meta CAPI</CardTitle>
            <CardDescription>Histórico de envio com retry automático e deduplicação</CardDescription>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="default" size="sm" onClick={handleRunWorker} disabled={runningWorker}>
                {runningWorker ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Executar Worker
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="processing">Enviando</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="dead">Morto</SelectItem>
            </SelectContent>
          </Select>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos eventos</SelectItem>
              {META_EVENT_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7d</SelectItem>
              <SelectItem value="30d">Últimos 30d</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum log encontrado para este período/filtros.</p>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{item.event_name}</span>
                      {getStatusBadge(item.status)}
                      {item.attempts > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          tentativa {item.attempts}/{item.max_attempts}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(item.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      {item.sent_at && (
                        <span className="ml-2 text-emerald-600">
                          → enviado {format(new Date(item.sent_at), "HH:mm:ss", { locale: ptBR })}
                        </span>
                      )}
                      {item.lead_id && <span className="ml-2 font-mono text-[10px] bg-muted px-1 py-0.5 rounded">Lead: {item.lead_id.substring(0, 8)}</span>}
                    </p>
                    {item.last_error && (
                      <p className="text-xs text-destructive mt-1 truncate">{item.last_error}</p>
                    )}
                    {item.next_retry_at && item.status === "failed" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Próxima tentativa: {format(new Date(item.next_retry_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isAdmin && (item.status === "failed" || item.status === "dead") && (
                      <>
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2"
                          disabled={actionLoading === item.id}
                          onClick={() => handleQueueAction(item.id, "reprocess")}
                          title="Reprocessar agora">
                          🔄
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2"
                          disabled={actionLoading === item.id}
                          onClick={() => handleQueueAction(item.id, "reset")}
                          title="Resetar tentativas">
                          ↩️
                        </Button>
                      </>
                    )}
                    {isAdmin && item.status !== "dead" && item.status !== "success" && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2"
                        disabled={actionLoading === item.id}
                        onClick={() => handleQueueAction(item.id, "mark_dead")}
                        title="Marcar como morto">
                        💀
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setSelectedItem(item)}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-poppins">Detalhes: {selectedItem?.event_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Status:</span> {selectedItem && getStatusBadge(selectedItem.status)}</div>
              <div><span className="text-muted-foreground">Tentativas:</span> <span className="font-mono">{selectedItem?.attempts}/{selectedItem?.max_attempts}</span></div>
              <div><span className="text-muted-foreground">Lead ID:</span> <span className="font-mono text-xs">{selectedItem?.lead_id?.substring(0, 12) || "—"}</span></div>
              <div><span className="text-muted-foreground">Pipeline:</span> <span className="font-mono text-xs">{selectedItem?.pipeline_id?.substring(0, 12) || "—"}</span></div>
              <div><span className="text-muted-foreground">Etapa:</span> <span className="font-mono text-xs">{selectedItem?.stage_id?.substring(0, 12) || "—"}</span></div>
              <div><span className="text-muted-foreground">Enviado:</span> <span className="font-mono text-xs">{selectedItem?.sent_at ? format(new Date(selectedItem.sent_at), "dd/MM HH:mm:ss", { locale: ptBR }) : "—"}</span></div>
            </div>
            {selectedItem?.last_error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{selectedItem.last_error}</AlertDescription>
              </Alert>
            )}
            {selectedItem?.next_retry_at && selectedItem.status === "failed" && (
              <div>
                <Label className="text-xs font-semibold">Próxima tentativa</Label>
                <p className="text-xs font-mono">{format(new Date(selectedItem.next_retry_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
              </div>
            )}
            <div>
              <Label className="text-xs font-semibold">Event Hash (Dedupe)</Label>
              <pre className="text-xs bg-muted p-2 rounded mt-1 font-mono break-all">
                {selectedItem?.event_hash || "N/A"}
              </pre>
            </div>
            <div>
              <Label className="text-xs font-semibold">Payload</Label>
              <pre className="text-xs bg-muted p-2 rounded mt-1 max-h-48 overflow-auto">
                {JSON.stringify(selectedItem?.payload, null, 2) || "N/A"}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
