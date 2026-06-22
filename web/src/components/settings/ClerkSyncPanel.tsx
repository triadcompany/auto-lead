import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Trash2, ShieldAlert, CheckCircle2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface OrphanProfile {
  id: string;
  clerk_user_id: string;
  name?: string;
  email?: string;
  organization_id?: string;
  created_at?: string;
}

interface OrphanMirror {
  id: string;
  clerk_user_id: string;
  full_name?: string;
  email?: string;
}

interface MissingMirror {
  clerk_user_id: string;
  email: string | null;
  full_name: string | null;
}

interface PreviewResult {
  totals: {
    clerk_users: number;
    profiles: number;
    users_profile: number;
  };
  orphan_profiles: OrphanProfile[];
  orphan_users_profile: OrphanMirror[];
  missing_mirror: MissingMirror[];
}

export function ClerkSyncPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const runPreview = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("clerk-reconcile-users", {
        body: { mode: "preview" },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao consultar Clerk");
      setPreview(data as PreviewResult);
      toast({
        title: "Sincronização concluída",
        description: `${data.totals.clerk_users} usuários no Clerk · ${data.orphan_profiles.length} órfãos em profiles.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro ao sincronizar",
        description: err?.message || "Verifique os logs da edge function.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const orphanIds = Array.from(
    new Set([
      ...(preview?.orphan_profiles ?? []).map((o) => o.clerk_user_id),
      ...(preview?.orphan_users_profile ?? []).map((o) => o.clerk_user_id),
    ]),
  );

  const purgeOrphans = async () => {
    if (orphanIds.length === 0) return;
    setPurging(true);
    try {
      const { data, error } = await supabase.functions.invoke("clerk-reconcile-users", {
        body: { mode: "apply", clerk_user_ids: orphanIds },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao deletar");
      toast({
        title: "Limpeza concluída",
        description: `${data.purged} usuário(s) removido(s). ${data.failed} falha(s).`,
      });
      setConfirmOpen(false);
      // refresh preview
      await runPreview();
    } catch (err: any) {
      toast({
        title: "Erro ao deletar",
        description: err?.message || "Verifique os logs da edge function.",
        variant: "destructive",
      });
    } finally {
      setPurging(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-poppins">
          <RefreshCw className="h-5 w-5" />
          Sincronização com Clerk
        </CardTitle>
        <CardDescription className="font-poppins">
          Compara os usuários do Clerk com os perfis no banco e identifica registros
          órfãos. Webhooks já mantêm a sincronização em tempo real — use esta ação para
          limpar passivos antigos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={runPreview} disabled={loading} variant="outline">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Consultando Clerk...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" /> Sincronizar usuários com Clerk
              </>
            )}
          </Button>

          {preview && orphanIds.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={purging}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Excluir {orphanIds.length} órfão(s)
            </Button>
          )}
        </div>

        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <StatBlock label="Usuários no Clerk" value={preview.totals.clerk_users} />
              <StatBlock label="Profiles no Supabase" value={preview.totals.profiles} />
              <StatBlock
                label="Mirror (users_profile)"
                value={preview.totals.users_profile}
              />
            </div>

            {orphanIds.length === 0 ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="font-poppins">
                  Tudo sincronizado. Nenhum órfão encontrado.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription className="font-poppins">
                  {orphanIds.length} usuário(s) presente(s) no banco mas ausente(s) no
                  Clerk. A exclusão remove profile, vínculos de organização e papéis em
                  cascata — irreversível.
                </AlertDescription>
              </Alert>
            )}

            {preview.orphan_profiles.length > 0 && (
              <OrphanList
                title="Órfãos em profiles"
                items={preview.orphan_profiles.map((o) => ({
                  clerk_user_id: o.clerk_user_id,
                  primary: o.name || o.email || "(sem nome)",
                  secondary: o.email,
                }))}
              />
            )}

            {preview.orphan_users_profile.length > 0 && (
              <OrphanList
                title="Órfãos em users_profile"
                items={preview.orphan_users_profile.map((o) => ({
                  clerk_user_id: o.clerk_user_id,
                  primary: o.full_name || o.email || "(sem nome)",
                  secondary: o.email,
                }))}
              />
            )}

            {preview.missing_mirror.length > 0 && (
              <Alert>
                <AlertDescription className="font-poppins">
                  {preview.missing_mirror.length} usuário(s) do Clerk ainda não foram
                  espelhados em <code>users_profile</code>. Eles serão criados
                  automaticamente no próximo evento do webhook.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {orphanIds.length} usuário(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente os perfis, vínculos de organização e
              papéis dos usuários listados. A operação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purging}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                purgeOrphans();
              }}
              disabled={purging}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {purging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Excluindo...
                </>
              ) : (
                "Confirmar exclusão"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground font-poppins">{label}</div>
      <div className="text-2xl font-semibold font-poppins">{value}</div>
    </div>
  );
}

function OrphanList({
  title,
  items,
}: {
  title: string;
  items: Array<{ clerk_user_id: string; primary: string; secondary?: string | null }>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-poppins font-semibold">{title}</h4>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      <div className="rounded-lg border divide-y max-h-64 overflow-y-auto">
        {items.map((item) => (
          <div
            key={`${title}-${item.clerk_user_id}`}
            className="px-3 py-2 text-sm flex items-center justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="font-poppins truncate">{item.primary}</div>
              {item.secondary && (
                <div className="text-xs text-muted-foreground truncate">
                  {item.secondary}
                </div>
              )}
            </div>
            <code className="text-[10px] text-muted-foreground shrink-0">
              {item.clerk_user_id.slice(0, 14)}…
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}
