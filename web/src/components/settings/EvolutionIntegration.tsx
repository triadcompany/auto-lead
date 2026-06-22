import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@clerk/clerk-react";
import {
  MessageSquare, Wifi, WifiOff, Loader2, CheckCircle,
  RefreshCw, Smartphone, ShieldAlert,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import QRCodeLib from "qrcode";

interface Connection {
  id: string;
  organization_id: string;
  instance_name: string;
  phone_number: string | null;
  status: "disconnected" | "connecting" | "connected" | "error" | string;
  qr_code: string | null;
  connected_at: string | null;
  last_connected_at: string | null;
  last_disconnected_at: string | null;
  mirror_enabled: boolean;
  mirror_enabled_at: string | null;
}

/* ── QR rendering ── */
function QrDisplay({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDataUrl = value.startsWith("data:image");

  useEffect(() => {
    if (!isDataUrl && canvasRef.current && value) {
      QRCodeLib.toCanvas(canvasRef.current, value, { width: 288, margin: 2 }).catch((err) => {
        console.error("[QR] render error:", err);
      });
    }
  }, [value, isDataUrl]);

  if (isDataUrl) {
    return <img src={value} alt="QR Code WhatsApp" className="w-72 h-72 rounded-lg" />;
  }
  return <canvas ref={canvasRef} className="rounded-lg" />;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function EvolutionIntegration() {
  const { toast } = useToast();
  const { profile, isAdmin, orgId: authOrgId } = useAuth();
  const { user: clerkUser } = useUser();
  const orgId = authOrgId || profile?.organization_id;
  const clerkUserId = clerkUser?.id;

  const [conn, setConn] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"connect" | "disconnect" | "refresh" | null>(null);
  const [qrStartedAt, setQrStartedAt] = useState<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const lastOrgRef = useRef<string | null>(null);
  const activeOrgRef = useRef<string | null>(orgId || null);

  const resetConnectionState = useCallback((nextLoading = false) => {
    setConn(null);
    setBusy(null);
    setQrStartedAt(null);
    setLoading(nextLoading);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /* ── Fetch status ── */
  const fetchStatus = useCallback(async (refreshQr = false): Promise<Connection | null> => {
    const requestOrgId = orgId;
    if (!requestOrgId) return null;

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-status", {
        body: { organization_id: requestOrgId, refresh_qr: refreshQr },
        headers: clerkUserId ? { "x-clerk-user-id": clerkUserId } : {},
      });
      if (error) throw error;

      if (activeOrgRef.current !== requestOrgId) {
        return null;
      }

      if (!data?.ok) return null;
      if (data.status === "not_configured" || !data.connection) {
        if (activeOrgRef.current === requestOrgId) {
          setConn(null);
        }
        return null;
      }

      // Defesa anti-vazamento entre orgs
      if (data.connection.organization_id !== requestOrgId) {
        if (activeOrgRef.current === requestOrgId) {
          setConn(null);
        }
        return null;
      }

      setConn(data.connection);
      return data.connection;
    } catch (err) {
      console.error("[fetchStatus]", err);
      return null;
    }
  }, [orgId, clerkUserId]);

  /* ── Reset on org switch ── */
  useEffect(() => {
    activeOrgRef.current = orgId || null;
    const requestOrgId = orgId || null;

    if (lastOrgRef.current !== orgId) {
      lastOrgRef.current = orgId || null;
      resetConnectionState(Boolean(orgId));
    }

    if (!orgId) {
      resetConnectionState(false);
      return;
    }

    fetchStatus().finally(() => {
      if (activeOrgRef.current === requestOrgId) {
        setLoading(false);
      }
    });
  }, [orgId, fetchStatus, resetConnectionState]);

  /* ── Polling while connecting ── */
  useEffect(() => {
    if (conn?.status === "connecting") {
      if (!qrStartedAt) setQrStartedAt(Date.now());
      if (!pollRef.current) {
        pollRef.current = window.setInterval(() => {
          fetchStatus().then((c) => {
            if (c?.status === "connected") {
              toast({ title: "WhatsApp conectado!", description: "Pronto para enviar e receber mensagens." });
            }
          });
        }, 3000);
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (conn?.status !== "connecting") setQrStartedAt(null);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [conn?.status, qrStartedAt, fetchStatus, toast]);

  /* ── Actions ── */
  const handleConnect = async () => {
    if (!orgId || !clerkUserId) return;
    setBusy("connect");
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { organization_id: orgId },
        headers: { "x-clerk-user-id": clerkUserId },
      });
      if (error) throw error;
      if (!data?.ok) {
        // Caso o backend detecte que já existe conexão ativa, sincronize a UI
        const errMsg = String(data?.error || "");
        if (/já existe|already/i.test(errMsg)) {
          await fetchStatus();
          toast({
            title: "WhatsApp já está conectado",
            description: "Sincronizamos o status atual da sua conexão.",
          });
          return;
        }
        throw new Error(errMsg || "Falha ao iniciar conexão");
      }

      setConn(data.connection);
      setQrStartedAt(Date.now());
      toast({ title: "QR Code gerado", description: "Escaneie com seu WhatsApp." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Tratamento amigável: se a Edge Function devolveu non-2xx (ex.: 409), o supabase-js
      // joga FunctionsHttpError sem o body. Tentamos sincronizar antes de mostrar erro feio.
      if (/non-2xx|FunctionsHttpError|409/i.test(msg)) {
        const synced = await fetchStatus();
        if (synced?.status === "connected") {
          toast({
            title: "WhatsApp já está conectado",
            description: "Sincronizamos o status atual da sua conexão.",
          });
          return;
        }
      }
      toast({ title: "Erro ao conectar", description: msg, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleRefreshQr = async () => {
    setBusy("refresh");
    try {
      await fetchStatus(true);
      setQrStartedAt(Date.now());
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    if (!orgId || !clerkUserId) return;
    setBusy("disconnect");
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-disconnect", {
        body: { organization_id: orgId },
        headers: { "x-clerk-user-id": clerkUserId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao desconectar");
      toast({ title: "WhatsApp desconectado" });
      await fetchStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleToggleMirror = async (enabled: boolean) => {
    if (!conn) return;
    const { error } = await supabase
      .from("whatsapp_connections")
      .update({
        mirror_enabled: enabled,
        mirror_enabled_at: enabled ? new Date().toISOString() : conn.mirror_enabled_at,
      })
      .eq("id", conn.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setConn({ ...conn, mirror_enabled: enabled });
    toast({
      title: enabled ? "Espelhamento ativado" : "Espelhamento desativado",
      description: enabled ? "Conversas serão exibidas no Inbox" : "Conversas não serão exibidas",
    });
  };

  /* ── Permission gate ── */
  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              Apenas administradores podem gerenciar a conexão do WhatsApp.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center min-h-[200px]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  /* ── A) Sem conexão ── */
  if (!conn || conn.status === "disconnected" && !conn.last_disconnected_at) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            WhatsApp
          </CardTitle>
          <CardDescription>
            Conecte seu WhatsApp para receber e enviar mensagens pelo sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">Conectar WhatsApp</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Conecte seu WhatsApp para receber e enviar mensagens pelo sistema.
          </p>
          <Button onClick={handleConnect} disabled={busy === "connect"} size="lg">
            {busy === "connect" ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando QR…</>
            ) : (
              <><Wifi className="w-4 h-4 mr-2" />Conectar WhatsApp</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  /* ── B) Connecting (QR Code) ── */
  if (conn.status === "connecting") {
    const elapsedSec = qrStartedAt ? Math.floor((Date.now() - qrStartedAt) / 1000) : 0;
    const showRefresh = elapsedSec > 120;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Conectar WhatsApp
          </CardTitle>
          <CardDescription>Escaneie o QR code com seu WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6 py-6">
          {conn.qr_code ? (
            <div className="p-4 bg-white rounded-xl border-2 border-border">
              <QrDisplay value={conn.qr_code} />
            </div>
          ) : (
            <div className="w-72 h-72 flex items-center justify-center bg-muted rounded-xl">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}

          <div className="text-sm text-muted-foreground space-y-1 text-center max-w-md">
            <p className="font-medium text-foreground">Como conectar:</p>
            <p>1. Abra o WhatsApp no seu celular</p>
            <p>2. Toque em <strong>Aparelhos conectados</strong></p>
            <p>3. Toque em <strong>Conectar aparelho</strong></p>
            <p>4. Aponte para este QR Code</p>
          </div>

          <div className="flex gap-2">
            {showRefresh ? (
              <Button onClick={handleRefreshQr} disabled={busy === "refresh"} variant="default">
                {busy === "refresh" ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando…</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" />Gerar novo QR code</>
                )}
              </Button>
            ) : (
              <Button onClick={handleRefreshQr} variant="outline" disabled={busy === "refresh"}>
                <RefreshCw className="w-4 h-4 mr-2" />Atualizar QR
              </Button>
            )}
            <Button onClick={handleDisconnect} variant="ghost" disabled={busy === "disconnect"}>
              Cancelar
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">Aguardando leitura… ({elapsedSec}s)</p>
        </CardContent>
      </Card>
    );
  }

  /* ── C) Connected ── */
  if (conn.status === "connected") {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                WhatsApp
              </CardTitle>
              <CardDescription>Conexão ativa com a Evolution API</CardDescription>
            </div>
            <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
              <CheckCircle className="w-3 h-3 mr-1" />
              Conectado
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Número conectado</Label>
              <p className="text-sm font-medium flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
                {conn.phone_number ? `+${conn.phone_number}` : "—"}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Conectado desde</Label>
              <p className="text-sm font-medium">{formatDateTime(conn.connected_at)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Última atividade</Label>
              <p className="text-sm font-medium">{formatDateTime(conn.last_connected_at)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="space-y-0.5">
              <Label htmlFor="mirror-toggle" className="text-sm font-medium">
                Espelhar conversas no Inbox
              </Label>
              <p className="text-xs text-muted-foreground">
                Quando ativo, todas as conversas aparecem no módulo Inbox.
              </p>
            </div>
            <Switch
              id="mirror-toggle"
              checked={conn.mirror_enabled}
              onCheckedChange={handleToggleMirror}
            />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={busy === "disconnect"}>
                {busy === "disconnect" ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Desconectando…</>
                ) : (
                  <><WifiOff className="w-4 h-4 mr-2" />Desconectar</>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Desconectar WhatsApp?</AlertDialogTitle>
                <AlertDialogDescription>
                  O WhatsApp será desconectado e a instância removida da Evolution.
                  O histórico de conversas permanece preservado.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDisconnect}>Desconectar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  /* ── D) Disconnected (com histórico) ── */
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
              WhatsApp
            </CardTitle>
            <CardDescription>
              Desconectado desde {formatDateTime(conn.last_disconnected_at)}
            </CardDescription>
          </div>
          <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10">
            <WifiOff className="w-3 h-3 mr-1" />
            Desconectado
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 py-6">
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Reconecte para voltar a enviar e receber mensagens. O histórico anterior permanece preservado.
        </p>
        <Button onClick={handleConnect} disabled={busy === "connect"} size="lg">
          {busy === "connect" ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando QR…</>
          ) : (
            <><RefreshCw className="w-4 h-4 mr-2" />Reconectar</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
