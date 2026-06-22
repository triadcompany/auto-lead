import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Loader2, TestTube, ExternalLink, Info, Check, X,
  RefreshCw, Eye, AlertTriangle, Zap, RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CapiSettings {
  id: string;
  pixel_id: string;
  access_token: string;
  test_event_code: string | null;
  enabled: boolean;
  test_mode: boolean;
  domain: string | null;
}

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
  created_at: string;
  updated_at: string;
}

// ═══════════ EDGE FUNCTION HELPER ═══════════
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);

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

// ═══════════ MAIN COMPONENT ═══════════
export function MetaAdsSettings() {
  const { profile, role, loading: authLoading, orgId: authOrgId, user } = useAuth();
  const orgId = profile?.organization_id || authOrgId;
  const profileId = profile?.id || user?.id || null;
  const isAdmin = role === "admin";

  if (authLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Não foi possível carregar o contexto da organização. Verifique se você está logado e possui uma organização ativa.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Guide */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-poppins text-blue-800 dark:text-blue-200">Como fazer o Meta CAPI funcionar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 text-sm">
            <div className="flex-1 flex items-start gap-2 p-3 bg-blue-100/60 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <span className="font-bold text-blue-600 dark:text-blue-400 text-base leading-none mt-0.5">①</span>
              <div>
                <p className="font-semibold text-blue-800 dark:text-blue-200">Configurar conexão</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Pixel ID + Access Token abaixo</p>
              </div>
            </div>
            <div className="flex-1 flex items-start gap-2 p-3 bg-muted/60 rounded-lg border">
              <span className="font-bold text-muted-foreground text-base leading-none mt-0.5">②</span>
              <div>
                <p className="font-semibold">Criar automação</p>
                <p className="text-xs text-muted-foreground mt-0.5">Automações → Nova → Ação "Enviar para Meta"</p>
              </div>
            </div>
            <div className="flex-1 flex items-start gap-2 p-3 bg-muted/60 rounded-lg border">
              <span className="font-bold text-muted-foreground text-base leading-none mt-0.5">③</span>
              <div>
                <p className="font-semibold">Ativar e testar</p>
                <p className="text-xs text-muted-foreground mt-0.5">Clique "Testar Conexão" após salvar</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <TechStatusChecklist orgId={orgId} profileId={profileId} />
      )}

      <ConnectionCard orgId={orgId} profileId={profileId} isAdmin={isAdmin} />

      <QueueLogsSection orgId={orgId} profileId={profileId} isAdmin={isAdmin} />
    </div>
  );
}

// ═══════════ ERROR DETAIL MODAL ═══════════
function ErrorDetailModal({
  open,
  onClose,
  error,
}: {
  open: boolean;
  onClose: () => void;
  error: {
    endpoint: string;
    httpStatus: number;
    response: any;
    message: string;
    orgId?: string;
    profileId?: string;
  } | null;
}) {
  if (!error) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-poppins flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" /> Detalhes do Erro
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label className="text-xs font-semibold">Endpoint</Label>
            <pre className="bg-muted p-2 rounded text-xs mt-1 font-mono">{error.endpoint}</pre>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">HTTP Status</Label>
              <p className="font-mono">{error.httpStatus}</p>
            </div>
            <div>
              <Label className="text-xs font-semibold">Código</Label>
              <p className="font-mono">{error.response?.code || "N/A"}</p>
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold">Mensagem</Label>
            <p className="text-destructive">{error.message}</p>
          </div>
          <div>
            <Label className="text-xs font-semibold">Response JSON</Label>
            <pre className="bg-muted p-2 rounded text-xs mt-1 max-h-48 overflow-auto font-mono">
              {JSON.stringify(error.response, null, 2)}
            </pre>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════ TECH STATUS CHECKLIST ═══════════
function TechStatusChecklist({ orgId, profileId }: { orgId: string; profileId: string }) {
  const [status, setStatus] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const check = async () => {
    setLoading(true);
    try {
      const { status: httpStatus, data } = await callMetaCapiEndpoint({
        action: "status",
        profile_id: profileId,
        organization_id: orgId,
      });
      if (data.ok) {
        setStatus({ ...data.status, api_settings_ok: true, http_status: httpStatus });
      } else {
        setStatus({ api_settings_ok: false, error: data.message, http_status: httpStatus });
      }
    } catch (err: any) {
      setStatus({ api_settings_ok: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) check();
  }, [expanded]);

  const StatusIcon = ({ ok }: { ok: boolean }) =>
    ok ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-destructive" />;

  return (
    <Card className="border-dashed">
      <CardHeader className="py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-poppins flex items-center gap-2">
            🔧 Status Técnico (Admin)
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            {expanded ? "Fechar" : "Verificar"}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando...
            </div>
          ) : status ? (
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <StatusIcon ok={!!status.user_id} />
                <span>Session user_id detectado</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon ok={!!status.organization_id} />
                <span>organization_id detectado</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon ok={status.org_exists === true} />
                <span>organizations row exists</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon ok={status.is_admin === true} />
                <span>is_admin = true</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon ok={status.settings_exists === true} />
                <span>meta_capi_settings row exists</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon ok={status.api_settings_ok === true} />
                <span>API /meta-capi-settings funcionando</span>
              </div>
              {status.error && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{status.error}</AlertDescription>
                </Alert>
              )}
              <Button variant="outline" size="sm" className="mt-2" onClick={check}>
                <RefreshCw className="mr-2 h-3 w-3" /> Reverificar
              </Button>
            </div>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}

// ═══════════ CONNECTION CARD ═══════════
function ConnectionCard({ orgId, profileId, isAdmin }: { orgId: string; profileId: string; isAdmin: boolean }) {
  const [config, setConfig] = useState<CapiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [domain, setDomain] = useState("");
  const [errorDetail, setErrorDetail] = useState<any>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("meta_capi_settings")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (data) {
      setConfig(data);
      setPixelId(data.pixel_id || "");
      setAccessToken(data.access_token || "");
      setTestEventCode(data.test_event_code || "");
      setEnabled(data.enabled);
      setTestMode(data.test_mode || false);
      setDomain(data.domain || "");
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setSettingsSaved(!!config?.id);
  }, [config]);

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error("Somente administrador pode alterar esta configuração.");
      return;
    }
    if (!pixelId || !accessToken) {
      toast.error("Pixel ID e Access Token são obrigatórios");
      return;
    }
    if (!/^\d{10,16}$/.test(pixelId.trim())) {
      toast.error("Pixel ID inválido — deve conter apenas números (10 a 16 dígitos). Ex: 123456789012345");
      return;
    }
    setSaving(true);
    try {
      const { status, data } = await callMetaCapiEndpoint({
        action: "save",
        profile_id: profileId,
        organization_id: orgId,
        payload: { pixel_id: pixelId, access_token: accessToken, test_event_code: testEventCode || null, enabled, test_mode: testMode, domain: domain || null },
      });
      if (data.ok) {
        toast.success("Configurações salvas!");
        setSettingsSaved(true);
        load();
      } else {
        toast.error(`Erro ao salvar: ${data.message || "Erro desconhecido"}`);
        setErrorDetail({ endpoint: "meta-capi-settings (save)", httpStatus: status, response: data, message: data.message });
      }
    } catch (err: any) {
      toast.error("Erro de rede ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!settingsSaved) {
      toast.warning("Salve as configurações antes de testar.");
      return;
    }
    setTesting(true);
    try {
      const { status, data } = await callMetaCapiEndpoint({
        action: "test",
        profile_id: profileId,
        organization_id: orgId,
      });
      if (data.ok) {
        toast.success(
          `${data.message || "Conexão funcionando!"} Verifique em Gerenciador de Eventos → Teste de Eventos.`,
          { duration: 8000 }
        );
      } else {
        const codeMessages: Record<string, string> = {
          INVALID_TOKEN: "Access Token inválido ou expirado. Gere um novo token no Business Manager.",
          MISSING_PERMISSION: "Seu token não tem permissão para este Pixel. Use um System User com acesso ao Dataset.",
          INVALID_DATASET: "Pixel ID não encontrado. Verifique o ID no Gerenciador de Eventos.",
          NETWORK_ERROR: "Erro de rede ao conectar com a Meta. Tente novamente.",
        };
        const msg = codeMessages[data.code] || data.message || "Erro desconhecido";
        toast.error(msg, { duration: 10000 });
        setErrorDetail({ endpoint: "meta-capi-settings (test)", httpStatus: status, response: data, message: msg });
      }
    } catch (err: any) {
      toast.error("Erro de rede ao testar");
    } finally {
      setTesting(false);
    }
  };

  const handleToggleEnabled = async (val: boolean) => {
    if (!isAdmin) {
      toast.error("Somente administrador pode alterar esta configuração.");
      return;
    }
    if (val && (!pixelId || !accessToken)) {
      toast.error("Configure Pixel ID e Access Token antes de ativar");
      return;
    }
    setEnabled(val);
    if (config?.id) {
      await callMetaCapiEndpoint({
        action: "save", profile_id: profileId, organization_id: orgId,
        payload: { pixel_id: pixelId, access_token: accessToken, test_event_code: testEventCode || null, enabled: val, test_mode: testMode, domain: domain || null },
      });
    }
  };

  const getStatusBadge = () => {
    if (!config) return <Badge variant="secondary">Não configurado</Badge>;
    if (!enabled) return <Badge variant="secondary">Desativado</Badge>;
    return <Badge variant="default" className="bg-emerald-600"><Check className="h-3 w-3 mr-1" /> Conectado</Badge>;
  };

  const maskedToken = accessToken ? `${"•".repeat(12)}${accessToken.slice(-4)}` : "";

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-poppins">Conexão Meta (CAPI)</CardTitle>
              <CardDescription>Dataset ID (Pixel ID) e Access Token para envio de eventos</CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show summary when configured and not admin */}
          {config && !isAdmin ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Pixel ID (Dataset)</Label>
                <p className="font-mono text-sm">{"•".repeat(Math.max(0, config.pixel_id.length - 4))}{config.pixel_id.slice(-4)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Access Token</Label>
                <p className="font-mono text-sm">{maskedToken}</p>
              </div>
              {config.test_event_code && (
                <div>
                  <Label className="text-xs text-muted-foreground">Test Event Code</Label>
                  <p className="font-mono text-sm">{config.test_event_code}</p>
                </div>
              )}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Somente administradores podem editar esta configuração.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="capi-pixel-id">Pixel ID (Dataset ID)</Label>
                <Input
                  id="capi-pixel-id"
                  placeholder="Ex: 123456789012345"
                  value={pixelId}
                  onChange={(e) => setPixelId(e.target.value.replace(/\D/g, "").slice(0, 16))}
                  inputMode="numeric"
                  className={pixelId && !/^\d{10,16}$/.test(pixelId) ? "border-destructive" : ""}
                />
                {pixelId && !/^\d{10,16}$/.test(pixelId) ? (
                  <p className="text-xs text-destructive">Pixel ID inválido — apenas números, 10 a 16 dígitos</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Encontre em{" "}
                    <a href="https://business.facebook.com/events_manager2" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      Gerenciador de Eventos <ExternalLink className="h-3 w-3" />
                    </a>
                    {" "}→ Configurações → Dataset ID
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="capi-token">Access Token da API de Conversões</Label>
                <Input id="capi-token" type="password" placeholder="EAAxxxxxxxxxxxxx..." value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Gere em Gerenciador de Eventos → Configurações → API de Conversões
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capi-test-code">Test Event Code (opcional)</Label>
                <Input id="capi-test-code" placeholder="TEST12345" value={testEventCode} onChange={(e) => setTestEventCode(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capi-domain">Domínio / Site (opcional)</Label>
                <Input id="capi-domain" placeholder="https://meusite.com.br" value={domain} onChange={(e) => setDomain(e.target.value)} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Ativar envio via CAPI</Label>
                  <p className="text-sm text-muted-foreground">Habilita envio automático</p>
                </div>
                <Switch checked={enabled} onCheckedChange={handleToggleEnabled} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Modo Teste</Label>
                  <p className="text-sm text-muted-foreground">Eventos com Test Event Code</p>
                </div>
                <Switch checked={testMode} onCheckedChange={setTestMode} />
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving || !pixelId || !accessToken}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={testing || !settingsSaved}>
                  {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
                  Testar Conexão
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ErrorDetailModal open={!!errorDetail} onClose={() => setErrorDetail(null)} error={errorDetail} />
    </>
  );
}

// ═══════════ QUEUE LOGS SECTION ═══════════
function QueueLogsSection({ orgId, profileId, isAdmin }: { orgId: string; profileId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await callMetaCapiEndpoint({
        action: "queue_logs",
        profile_id: profileId,
        organization_id: orgId,
        payload: { status: "all", period: "30d" },
      });
      if (data.ok) {
        setItems(data.items || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [orgId, profileId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleAction = async (queueId: string, actionType: string) => {
    if (!isAdmin) {
      toast.error("Somente administradores podem executar essa ação.");
      return;
    }
    try {
      const { data } = await callMetaCapiEndpoint({
        action: "queue_action",
        profile_id: profileId,
        organization_id: orgId,
        payload: { queue_id: queueId, action_type: actionType },
      });
      if (data.ok) {
        toast.success(data.message);
        fetchLogs();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Erro ao executar ação");
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-300"><Check className="h-3 w-3" /> Enviado</Badge>;
      case "failed":
      case "dead":
        return <Badge variant="destructive" className="gap-1 text-xs"><X className="h-3 w-3" /> {status === "dead" ? "Morto" : "Erro"}</Badge>;
      case "pending":
        return <Badge variant="secondary" className="gap-1 text-xs"><Loader2 className="h-3 w-3 animate-spin" /> Pendente</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  // Compute stats
  const successCount = items.filter(i => i.status === "sent").length;
  const errorCount = items.filter(i => i.status === "failed" || i.status === "dead").length;
  const pendingCount = items.filter(i => i.status === "pending").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-poppins">Últimos Envios</CardTitle>
            <CardDescription>
              Eventos enviados para a Meta nos últimos 30 dias
              {items.length > 0 && (
                <span className="ml-2">
                  — ✅ {successCount} · ❌ {errorCount} · ⏳ {pendingCount}
                </span>
              )}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum evento enviado ainda.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Configure uma automação com a ação "Enviar para Meta (CAPI)" para começar.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{item.event_name}</span>
                      {statusBadge(item.status)}
                      <span className="text-xs text-muted-foreground">x{item.attempts}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(item.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      {item.lead_id && <span className="ml-2">Lead: {item.lead_id.substring(0, 8)}...</span>}
                    </p>
                    {item.last_error && (
                      <p className="text-xs text-destructive mt-1 truncate max-w-md">{item.last_error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedItem(item)}>
                      <Eye className="h-3 w-3" />
                    </Button>
                    {isAdmin && (item.status === "failed" || item.status === "dead") && (
                      <Button variant="ghost" size="sm" onClick={() => handleAction(item.id, "reprocess")}>
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Detail Modal */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes: {selectedItem?.event_name}</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold">Status</Label>
                  <div className="mt-1">{statusBadge(selectedItem.status)}</div>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Tentativas</Label>
                  <p className="font-mono">{selectedItem.attempts}/{selectedItem.max_attempts}</p>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold">Criado em</Label>
                <p className="font-mono text-xs">{format(new Date(selectedItem.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
              </div>
              {selectedItem.sent_at && (
                <div>
                  <Label className="text-xs font-semibold">Enviado em</Label>
                  <p className="font-mono text-xs">{format(new Date(selectedItem.sent_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                </div>
              )}
              {selectedItem.last_error && (
                <div>
                  <Label className="text-xs font-semibold">Último Erro</Label>
                  <pre className="bg-muted p-2 rounded text-xs mt-1 max-h-24 overflow-auto text-destructive">{selectedItem.last_error}</pre>
                </div>
              )}
              <div>
                <Label className="text-xs font-semibold">Payload</Label>
                <pre className="bg-muted p-2 rounded text-xs mt-1 max-h-48 overflow-auto font-mono">
                  {JSON.stringify(selectedItem.payload, null, 2) || "N/A"}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
