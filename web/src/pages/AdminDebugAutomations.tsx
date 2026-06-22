import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, RotateCw, Play, Eye, Activity, CheckCircle2,
  XCircle, AlertTriangle, Clock, Radio, Zap, Search,
  ArrowRight, ArrowDown, Webhook, Send,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/layout/PageHeader";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function apiCall(action: string, params: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/automations-api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });
  return res.json();
}

// ─── Status badge helper ───
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
    received:            { label: "Recebido",     variant: "outline",     className: "border-blue-300 text-blue-600 bg-blue-50" },
    event_published:     { label: "Publicado",    variant: "outline",     className: "border-blue-300 text-blue-600 bg-blue-50" },
    automation_fired:    { label: "Disparou",     variant: "default",     className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
    success:             { label: "Sucesso",      variant: "default",     className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
    no_match:            { label: "Sem match",    variant: "secondary",   className: "bg-amber-500/10 text-amber-600 border-amber-200" },
    filter_failed:       { label: "Filtro falhou", variant: "destructive", className: "bg-destructive/10 text-destructive" },
    keyword_not_matched: { label: "Keyword ✗",    variant: "destructive", className: "bg-destructive/10 text-destructive" },
    error:               { label: "Erro",         variant: "destructive", className: "bg-destructive/10 text-destructive" },
    skipped:             { label: "Pulado",       variant: "secondary",   className: "bg-amber-500/10 text-amber-600 border-amber-200" },
    pending:             { label: "Pendente",     variant: "outline",     className: "border-blue-300 text-blue-600 bg-blue-50" },
    consumed:            { label: "Consumido",    variant: "default",     className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
    processed:           { label: "Processado",   variant: "default",     className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
    failed:              { label: "Falhou",       variant: "destructive", className: "bg-destructive/10 text-destructive" },
  };
  const cfg = map[status] || { label: status, variant: "outline" as const, className: "" };
  return <Badge variant={cfg.variant} className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>{cfg.label}</Badge>;
}

// ─── JSON Viewer ───
function JsonViewer({ data, title }: { data: unknown; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(true)}>
        <Eye className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="font-poppins">{title}</DialogTitle>
          </DialogHeader>
          <pre className="bg-muted p-3 rounded-lg text-xs font-mono overflow-auto max-h-[500px] whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Trace link badge ───
function TraceBadge({ traceId }: { traceId: string }) {
  return (
    <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1 py-0.5 rounded">
      {traceId?.substring(0, 16) || "—"}
    </span>
  );
}

// ═══════════════ TAB 1: INBOUND ═══════════════
function InboundTab({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await apiCall("debug_inbound", { organization_id: orgId, limit: 50 });
    if (res.ok) setItems(res.items || []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={fetch_} className="font-poppins gap-1.5">
          <RotateCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
        <span className="text-xs text-muted-foreground">{items.length} registros</span>
      </div>
      {items.length === 0 ? <EmptyState text="Nenhum inbound registrado" /> : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-2">
            {items.map((item) => {
              const debug = item.debug_json || {};
              const hasEvent = item.status !== "received";
              const firstTouch = (debug as any).is_first_touch;
              const keywordMatch = (debug as any).keyword_matched;

              return (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <Webhook className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={item.status} />
                          {item.phone && <span className="text-xs font-poppins">📱 {item.phone}</span>}
                          {item.channel && <Badge variant="outline" className="text-[10px] px-1 py-0">{item.channel}</Badge>}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {firstTouch !== undefined && (
                            <Badge variant={firstTouch ? "default" : "secondary"} className={`text-[10px] px-1 py-0 ${firstTouch ? "bg-emerald-500/10 text-emerald-600" : ""}`}>
                              {firstTouch ? "✓ First Touch" : "✗ Not First Touch"}
                            </Badge>
                          )}
                          {keywordMatch !== undefined && (
                            <Badge variant={keywordMatch ? "default" : "secondary"} className={`text-[10px] px-1 py-0 ${keywordMatch ? "bg-emerald-500/10 text-emerald-600" : ""}`}>
                              {keywordMatch ? "✓ Keyword Match" : "✗ No Keyword"}
                            </Badge>
                          )}
                          {!hasEvent && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 animate-pulse">
                              ⚠ Evento não publicado
                            </Badge>
                          )}
                        </div>
                        {item.message_text && (
                          <p className="text-xs text-muted-foreground truncate font-poppins">"{item.message_text}"</p>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground font-poppins">
                            {format(new Date(item.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                          </span>
                          <TraceBadge traceId={item.trace_id} />
                        </div>
                      </div>
                      <JsonViewer data={item.debug_json} title="Debug JSON - Inbound" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ═══════════════ TAB 2: EVENT BUS ═══════════════
function EventBusTab({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await apiCall("debug_event_bus", { organization_id: orgId, limit: 50 });
    if (res.ok) setItems(res.items || []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const handleReprocess = async (eventId: string) => {
    setReprocessingId(eventId);
    await apiCall("reprocess_event", { event_id: eventId, organization_id: orgId });
    setTimeout(async () => {
      await fetch_();
      setReprocessingId(null);
    }, 2000);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={fetch_} className="font-poppins gap-1.5">
          <RotateCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
        <span className="text-xs text-muted-foreground">{items.length} eventos</span>
      </div>
      {items.length === 0 ? <EmptyState text="Nenhum evento no bus" /> : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-2">
            {items.map((item) => {
              const hasExecution = item.processed_at != null;
              return (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <Zap className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={item.status} />
                          <span className="text-xs font-medium font-poppins">{item.event_name}</span>
                          {item.entity_type && <Badge variant="outline" className="text-[10px] px-1 py-0">{item.entity_type}</Badge>}
                        </div>
                        {!hasExecution && item.status === "processed" && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0 animate-pulse">
                            ⚠ Worker não consumiu evento
                          </Badge>
                        )}
                        {item.error && (
                          <p className="text-xs text-destructive truncate font-poppins">{item.error}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground font-poppins">
                            {format(new Date(item.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                          </span>
                          {item.source && <span className="text-[10px] text-muted-foreground">src: {item.source}</span>}
                          <TraceBadge traceId={(item.payload as any)?.trace_id} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 text-xs font-poppins gap-1"
                          disabled={reprocessingId === item.id}
                          onClick={() => handleReprocess(item.id)}
                        >
                          {reprocessingId === item.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <RotateCw className="h-3 w-3" />
                          }
                          Reprocessar
                        </Button>
                        <JsonViewer data={item.payload} title="Payload do Evento" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ═══════════════ TAB 3: AUTOMATION EXECUTIONS ═══════════════
function ExecutionsTab({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPhone, setFilterPhone] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params: Record<string, unknown> = { organization_id: orgId, limit: 50 };
    if (filterPhone.trim()) params.phone = filterPhone.trim();
    if (filterStatus !== "all") params.status = filterStatus;
    const res = await apiCall("debug_executions", params);
    if (res.ok) setItems(res.items || []);
    setLoading(false);
  }, [orgId, filterPhone, filterStatus]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Filtrar por telefone..."
          value={filterPhone}
          onChange={(e) => setFilterPhone(e.target.value)}
          className="w-48 h-8 text-xs font-poppins"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs font-poppins">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="success">Sucesso</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
            <SelectItem value="skipped">Pulado</SelectItem>
            <SelectItem value="no_match">Sem match</SelectItem>
            <SelectItem value="received">Recebido</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetch_} className="font-poppins gap-1.5">
          <Search className="h-3.5 w-3.5" /> Buscar
        </Button>
        <span className="text-xs text-muted-foreground">{items.length} execuções</span>
      </div>

      {loading ? <LoadingSpinner /> : items.length === 0 ? <EmptyState text="Nenhuma execução encontrada" /> : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-2">
            {items.map((exec) => (
              <Card key={exec.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Activity className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={exec.status} />
                        <span className="text-xs font-poppins">{exec.event_name}</span>
                        {(exec.debug_json as any)?.automation_name && (
                          <span className="text-xs font-medium font-poppins">
                            → {String((exec.debug_json as any).automation_name)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {exec.phone && <span className="text-xs font-poppins">📱 {exec.phone}</span>}
                        {exec.channel && <Badge variant="outline" className="text-[10px] px-1 py-0">{exec.channel}</Badge>}
                        {(exec.debug_json as any)?.simulated && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">SIM</Badge>
                        )}
                      </div>
                      {exec.fail_reason && (
                        <p className="text-xs text-destructive truncate font-poppins">{exec.fail_reason}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-poppins">
                          {format(new Date(exec.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                        </span>
                        <TraceBadge traceId={exec.trace_id} />
                      </div>
                    </div>
                    <JsonViewer data={exec.debug_json} title="Debug JSON" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ═══════════════ TAB 4: META CAPI ═══════════════
function MetaCapiTab({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/automations-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "debug_meta_capi", organization_id: orgId, limit: 50 }),
    });
    const data = await res.json();
    if (data.ok) {
      setItems(data.items || []);
    } else {
      // Fallback: direct query via supabase client won't work from edge, try apiCall
      setItems([]);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={fetch_} className="font-poppins gap-1.5">
          <RotateCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
        <span className="text-xs text-muted-foreground">{items.length} registros</span>
      </div>
      {items.length === 0 ? <EmptyState text="Nenhum log Meta CAPI encontrado" /> : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-2">
            {items.map((item: any) => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Send className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={item.status} />
                        <span className="text-xs font-medium font-poppins">{item.meta_event}</span>
                        {item.http_status && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">HTTP {item.http_status}</Badge>
                        )}
                      </div>
                      {item.fail_reason && (
                        <p className="text-xs text-destructive truncate font-poppins">{item.fail_reason}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-poppins">
                          {format(new Date(item.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                        </span>
                        {item.lead_id && <span className="text-[10px] text-muted-foreground">lead: {item.lead_id?.substring(0, 8)}</span>}
                        <TraceBadge traceId={item.trace_id} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <JsonViewer data={item.request_json} title="Request JSON" />
                      <JsonViewer data={item.response_json} title="Response JSON" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ─── Shared ───
function LoadingSpinner() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center py-10">
        <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground font-poppins text-center">{text}</p>
      </CardContent>
    </Card>
  );
}

// ═══════════════ MAIN PAGE ═══════════════
export default function AdminDebugAutomations() {
  const { isAdmin, profile, loading } = useAuth();
  const [workerRunning, setWorkerRunning] = useState(false);

  if (loading) return <LoadingSpinner />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const orgId = profile?.organization_id;

  const handleRunWorker = async () => {
    setWorkerRunning(true);
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/automation-worker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch { /* ignore */ }
    setTimeout(() => setWorkerRunning(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          title="Debug Automações"
          description="Visualize o fluxo completo: Webhook → Event Bus → Execução"
        />
        <Button
          onClick={handleRunWorker}
          disabled={workerRunning}
          className="btn-gradient text-white font-poppins gap-2"
        >
          {workerRunning
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Executando...</>
            : <><Play className="h-4 w-4" /> Executar Worker Agora</>
          }
        </Button>
      </div>

      {/* Flow diagram */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 text-xs font-poppins text-muted-foreground overflow-x-auto">
            <span className="flex items-center gap-1 whitespace-nowrap"><Webhook className="h-3.5 w-3.5 text-blue-500" /> Webhook</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="flex items-center gap-1 whitespace-nowrap"><Radio className="h-3.5 w-3.5 text-blue-500" /> First Touch</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="flex items-center gap-1 whitespace-nowrap"><Zap className="h-3.5 w-3.5 text-amber-500" /> Event Bus</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="flex items-center gap-1 whitespace-nowrap"><Activity className="h-3.5 w-3.5 text-primary" /> Worker</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="flex items-center gap-1 whitespace-nowrap"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Execução</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="inbound">
        <TabsList className="font-poppins">
          <TabsTrigger value="inbound" className="gap-1.5">
            <Webhook className="h-3.5 w-3.5" /> Inbound
          </TabsTrigger>
          <TabsTrigger value="eventbus" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Event Bus
          </TabsTrigger>
          <TabsTrigger value="executions" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Executions
          </TabsTrigger>
          <TabsTrigger value="metacapi" className="gap-1.5">
            <Send className="h-3.5 w-3.5" /> Meta CAPI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbound" className="mt-4">
          {orgId && <InboundTab orgId={orgId} />}
        </TabsContent>
        <TabsContent value="eventbus" className="mt-4">
          {orgId && <EventBusTab orgId={orgId} />}
        </TabsContent>
        <TabsContent value="executions" className="mt-4">
          {orgId && <ExecutionsTab orgId={orgId} />}
        </TabsContent>
        <TabsContent value="metacapi" className="mt-4">
          {orgId && <MetaCapiTab orgId={orgId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
