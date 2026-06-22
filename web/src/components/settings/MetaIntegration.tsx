import { useState, useEffect } from "react";
import { MetaEventMappings } from "./MetaEventMappings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMetaIntegration } from "@/hooks/useMetaIntegration";
import { Loader2, Check, X, ExternalLink, TestTube, Info, RefreshCw, Eye, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface MetaCapiEvent {
  id: string;
  event_name: string;
  phone: string | null;
  status: string;
  attempts: number;
  fail_reason: string | null;
  payload_json: any;
  response_json: any;
  created_at: string;
  lead_id: string | null;
}

export function MetaIntegration() {
  const { config, recentEvents, loading, saveConfig, testConnection, refreshEvents } = useMetaIntegration();
  const { profile } = useAuth();
  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [capiEvents, setCapiEvents] = useState<MetaCapiEvent[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedPayload, setSelectedPayload] = useState<any>(null);

  useEffect(() => {
    if (config) {
      setPixelId(config.pixel_id || "");
      setAccessToken(config.access_token || "");
      setTestEventCode((config as any).meta_test_event_code || "");
    }
  }, [config]);

  const loadCapiEvents = async () => {
    if (!profile?.organization_id) return;
    setLoadingLogs(true);
    try {
      const { data, error } = await (supabase as any)
        .from("meta_capi_events")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setCapiEvents(data || []);
    } catch (err: any) {
      console.error("Error loading CAPI events:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (profile?.organization_id) {
      loadCapiEvents();
    }
  }, [profile?.organization_id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    await saveConfig({
      pixel_id: pixelId,
      access_token: accessToken,
      meta_test_event_code: testEventCode,
    } as any);
    setSaving(false);
  };

  const handleToggle = async (field: string, value: boolean) => {
    await saveConfig({ [field]: value });
  };

  const handleResend = async (eventId: string) => {
    try {
      await (supabase as any)
        .from("meta_capi_events")
        .update({ status: "pending", attempts: 0, fail_reason: null })
        .eq("id", eventId);
      toast.success("Evento reenfileirado para reenvio");
      loadCapiEvents();
    } catch {
      toast.error("Erro ao reenfileirar evento");
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Integre seu CRM com a Meta Conversions API (CAPI) para enviar eventos de conversão diretamente para o Facebook/Instagram,
          otimizando suas campanhas com dados reais.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="mappings">Mapeamento de Eventos</TabsTrigger>
          <TabsTrigger value="logs">Logs de Envio</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6 mt-4">
          {/* Credenciais */}
          <Card>
            <CardHeader>
              <CardTitle>Credenciais Meta Pixel / CAPI</CardTitle>
              <CardDescription>Dataset ID (Pixel ID) e Access Token</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pixel-id">Dataset / Pixel ID</Label>
                <Input
                  id="pixel-id"
                  placeholder="123456789012345"
                  value={pixelId}
                  onChange={(e) => setPixelId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Encontre no{" "}
                  <a href="https://business.facebook.com/events_manager2" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    Events Manager <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="access-token">Access Token</Label>
                <Input
                  id="access-token"
                  type="password"
                  placeholder="EAAxxxxxxxxxxxxx..."
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
                <p className="text-xs text-amber-600 dark:text-amber-500 font-medium">
                  ⚠️ Permissões: ads_management e business_management
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-code">Test Event Code (opcional)</Label>
                <Input
                  id="test-code"
                  placeholder="TEST12345"
                  value={testEventCode}
                  onChange={(e) => setTestEventCode(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Usado quando "Modo de Teste" está ativo ou ação com "Incluir código de teste"
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving || !pixelId || !accessToken}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
                <Button variant="outline" onClick={testConnection} disabled={!config?.pixel_id}>
                  <TestTube className="mr-2 h-4 w-4" />
                  Testar Conexão
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Eventos e toggles */}
          {config && (
            <Card>
              <CardHeader>
                <CardTitle>Eventos & Status</CardTitle>
                <CardDescription>Controles de envio de eventos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Lead Qualificado</Label>
                    <p className="text-sm text-muted-foreground">Evento "Lead" ao qualificar</p>
                  </div>
                  <Switch checked={config.track_lead_qualificado} onCheckedChange={(v) => handleToggle("track_lead_qualificado", v)} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Lead Super Qualificado</Label>
                    <p className="text-sm text-muted-foreground">Evento custom na proposta</p>
                  </div>
                  <Switch checked={config.track_lead_super_qualificado} onCheckedChange={(v) => handleToggle("track_lead_super_qualificado", v)} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Lead Veio na Loja</Label>
                    <p className="text-sm text-muted-foreground">Visita à loja</p>
                  </div>
                  <Switch checked={config.track_lead_veio_loja} onCheckedChange={(v) => handleToggle("track_lead_veio_loja", v)} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Lead Comprou</Label>
                    <p className="text-sm text-muted-foreground">Evento "Purchase"</p>
                  </div>
                  <Switch checked={config.track_lead_comprou} onCheckedChange={(v) => handleToggle("track_lead_comprou", v)} />
                </div>
                <Separator />
                <div className="flex items-center justify-between pt-2">
                  <div className="space-y-0.5">
                    <Label>Integração Ativa</Label>
                    <p className="text-sm text-muted-foreground">Ativar/desativar envio</p>
                  </div>
                  <Switch checked={config.is_active} onCheckedChange={(v) => handleToggle("is_active", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Modo de Teste</Label>
                    <p className="text-sm text-muted-foreground">Eventos marcados como teste no Meta</p>
                  </div>
                  <Switch checked={config.test_mode} onCheckedChange={(v) => handleToggle("test_mode", v)} />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="mappings" className="space-y-4 mt-4">
          <MetaEventMappings />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Logs Meta CAPI</CardTitle>
                  <CardDescription>Últimos 50 envios de eventos</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadCapiEvents} disabled={loadingLogs}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${loadingLogs ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {capiEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum evento enviado ainda. Configure uma automação com ação "Enviar para Meta".
                </p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {capiEvents.map((evt) => (
                      <div key={evt.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{evt.event_name}</span>
                            {evt.status === "success" ? (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <Check className="h-3 w-3" /> Enviado
                              </Badge>
                            ) : evt.status === "failed" ? (
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <X className="h-3 w-3" /> Erro
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <Loader2 className="h-3 w-3 animate-spin" /> Pendente
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              x{evt.attempts}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {evt.phone && `📱 ${evt.phone} · `}
                            {new Date(evt.created_at).toLocaleString('pt-BR')}
                          </p>
                          {evt.fail_reason && (
                            <p className="text-xs text-destructive mt-1 truncate">{evt.fail_reason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => setSelectedPayload(evt)}>
                                <Eye className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                              <DialogHeader>
                                <DialogTitle>Payload: {selectedPayload?.event_name}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-xs font-semibold">Payload Enviado</Label>
                                  <pre className="text-xs bg-muted p-2 rounded mt-1 max-h-40 overflow-auto">
                                    {JSON.stringify(selectedPayload?.payload_json, null, 2) || "N/A"}
                                  </pre>
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Resposta Meta</Label>
                                  <pre className="text-xs bg-muted p-2 rounded mt-1 max-h-40 overflow-auto">
                                    {JSON.stringify(selectedPayload?.response_json, null, 2) || "N/A"}
                                  </pre>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          {evt.status === "failed" && (
                            <Button variant="ghost" size="sm" onClick={() => handleResend(evt.id)}>
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
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
