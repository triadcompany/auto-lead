import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { MessageSquare, Copy, CheckCircle, Loader2, Wifi, WifiOff, QrCode } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export function WhatsAppIntegration() {
  const [status, setStatus] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const api = useApi();

  const webhookUrl = `${import.meta.env.VITE_API_URL || ''}/whatsapp/webhook`;

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [statusRes, settingsRes] = await Promise.all([
        api.whatsapp.me().catch(() => null),
        api.whatsappSettings.get().catch(() => null),
      ]);
      setStatus(statusRes);
      setSettings(settingsRes?.integration || null);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await api.whatsapp.meConnect();
      await fetchStatus();
      toast({ title: "Conectando...", description: "Aguarde o QR Code aparecer." });
    } catch (err: any) {
      toast({ title: "Erro ao conectar", description: err?.message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.whatsapp.meDisconnect();
      await fetchStatus();
      toast({ title: "Desconectado", description: "WhatsApp desconectado com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro ao desconectar", description: err?.message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleActive = async (value: boolean) => {
    setSaving(true);
    try {
      await api.whatsappSettings.update({ is_active: value });
      setSettings((prev: any) => ({ ...prev, is_active: value }));
      toast({ title: "Salvo", description: `Integração ${value ? 'ativada' : 'desativada'}.` });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast({ title: "Copiado!", description: "URL do webhook copiada." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <Card className="card-gradient border-0">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="card-gradient border-0">
        <CardContent className="p-6">
          <Alert>
            <MessageSquare className="h-4 w-4" />
            <AlertDescription>Apenas administradores podem configurar integrações do WhatsApp.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const isConnected = status?.status === 'connected' || status?.connection?.status === 'connected';
  const isConnecting = status?.status === 'connecting' || status?.status === 'qr';
  const qrCode = status?.connection?.qr_code;

  return (
    <div className="space-y-6">
      <Card className="card-gradient border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 font-poppins">
            <MessageSquare className="h-5 w-5 text-primary" />
            <span>Integração WhatsApp</span>
          </CardTitle>
          <CardDescription className="font-poppins">
            Conecte seu WhatsApp via Evolution API para receber e enviar mensagens automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Status */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <Wifi className="h-5 w-5 text-emerald-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-poppins font-medium text-sm">Status da Conexão</p>
                <p className="text-xs text-muted-foreground font-poppins">
                  {status?.connection?.phone_number
                    ? `Número: ${status.connection.phone_number}`
                    : status?.connection?.instance_name || 'Nenhuma instância configurada'}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={isConnected
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
                : 'bg-muted text-muted-foreground'
              }
            >
              {isConnected ? 'Conectado' : isConnecting ? 'Conectando...' : 'Desconectado'}
            </Badge>
          </div>

          {/* QR Code */}
          {qrCode && (
            <div className="flex flex-col items-center gap-3 p-4 border rounded-lg">
              <div className="flex items-center gap-2 text-sm font-poppins text-muted-foreground">
                <QrCode className="h-4 w-4" />
                Escaneie o QR Code com seu WhatsApp
              </div>
              <img src={qrCode} alt="QR Code" className="w-48 h-48 rounded" />
            </div>
          )}

          {/* Connect / Disconnect */}
          <div className="flex gap-3">
            {!isConnected ? (
              <Button onClick={handleConnect} disabled={connecting} className="gap-2">
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                {connecting ? 'Conectando...' : 'Conectar WhatsApp'}
              </Button>
            ) : (
              <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting} className="gap-2">
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <WifiOff className="h-4 w-4" />}
                {disconnecting ? 'Desconectando...' : 'Desconectar'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={fetchStatus} className="font-poppins">
              Atualizar status
            </Button>
          </div>

          <Separator />

          {/* Active toggle */}
          {settings && (
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-poppins font-medium">Integração Ativa</Label>
                <p className="text-xs text-muted-foreground font-poppins mt-0.5">
                  Ativa ou desativa o recebimento de mensagens via WhatsApp
                </p>
              </div>
              <Switch
                checked={settings.is_active ?? true}
                onCheckedChange={handleToggleActive}
                disabled={saving}
              />
            </div>
          )}

          <Separator />

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label className="font-poppins font-medium">URL do Webhook (Evolution API)</Label>
            <div className="flex items-center gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="sm" onClick={copyWebhook} className="gap-1 shrink-0">
                {copied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground font-poppins">
              Configure esta URL na sua instância Evolution API como destino dos webhooks.
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
