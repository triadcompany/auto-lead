import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Loader2,
  Calendar as CalendarIcon,
  Shield,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface OrgRow {
  id: string;
  name: string;
  createdAt: string;
  userCount: number;
  subscription: {
    plan: string | null;
    status: string;
    currentPeriodEnd: string | null;
    currentPeriodStart: string | null;
  } | null;
}

interface AdminGrant {
  id: string;
  action: string;
  plan: string | null;
  expiresAt: string | null;
  grantedBy: string;
  note: string | null;
  createdAt: string;
}

const PLAN_LABELS: Record<string, string> = { start: "Start", scale: "Scale" };

const STATUS_STYLES: Record<string, string> = {
  active: "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
  inactive: "border-border bg-muted text-muted-foreground",
  trialing: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  past_due: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  canceled: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  trialing: "Trial",
  past_due: "Inadimplente",
  canceled: "Cancelado",
};

export default function AdminOrganizations() {
  const { userEmail } = useAuth();
  const api = useApi();
  const { toast } = useToast();

  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<OrgRow | null>(null);
  const [grants, setGrants] = useState<AdminGrant[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantTarget, setGrantTarget] = useState<OrgRow | null>(null);
  const [grantPlan, setGrantPlan] = useState("scale");
  const [grantDate, setGrantDate] = useState<Date | undefined>(undefined);
  const [grantDateOpen, setGrantDateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const superadminEmail = import.meta.env.VITE_SUPERADMIN_EMAIL;
  const isSuperAdmin = !superadminEmail || userEmail === superadminEmail;

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.listOrganizations();
      setOrgs(data);
    } catch {
      toast({ title: "Erro ao carregar organizações", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [api, toast]);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const openHistory = async (org: OrgRow) => {
    setSelectedOrg(org);
    setShowHistory(true);
    setGrantsLoading(true);
    try {
      const data = await api.admin.getOrgGrants(org.id);
      setGrants(data);
    } catch {
      setGrants([]);
    } finally {
      setGrantsLoading(false);
    }
  };

  const handleGrant = async () => {
    if (!grantTarget) return;
    setSubmitting(true);
    try {
      await api.admin.grantOrg(grantTarget.id, {
        plan: grantPlan,
        expires_at: grantDate ? grantDate.toISOString() : null,
      });
      toast({ title: "Acesso liberado com sucesso" });
      setShowGrantModal(false);
      await loadOrgs();
      if (showHistory && selectedOrg?.id === grantTarget.id) {
        const data = await api.admin.getOrgGrants(grantTarget.id);
        setGrants(data);
      }
    } catch {
      toast({ title: "Erro ao liberar acesso", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (org: OrgRow) => {
    setRevoking(org.id);
    try {
      await api.admin.revokeOrg(org.id);
      toast({ title: "Acesso revogado" });
      await loadOrgs();
      if (showHistory && selectedOrg?.id === org.id) {
        const data = await api.admin.getOrgGrants(org.id);
        setGrants(data);
      }
    } catch {
      toast({ title: "Erro ao revogar acesso", variant: "destructive" });
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Organizações</h1>
            <p className="text-sm text-muted-foreground">Painel Superadmin</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">{orgs.length} orgs</Badge>
          <Button variant="ghost" size="icon" onClick={loadOrgs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Organização</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usuários</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Criado em</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plano</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Válido até</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : orgs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhuma organização encontrada
                  </td>
                </tr>
              ) : (
                orgs.map(org => {
                  const sub = org.subscription;
                  const status = sub?.status ?? "inactive";
                  const isActive = status === "active";
                  return (
                    <tr key={org.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openHistory(org)}
                          className="flex items-center gap-2 font-medium hover:text-primary transition-colors text-left"
                        >
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          {org.name}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-muted-foreground tabular-nums">
                          <Users className="h-3 w-3" />
                          {org.userCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {format(new Date(org.createdAt), "dd/MM/yyyy")}
                      </td>
                      <td className="px-4 py-3">
                        {sub?.plan ? (
                          <span className="font-medium">{PLAN_LABELS[sub.plan] ?? sub.plan}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${STATUS_STYLES[status] ?? STATUS_STYLES.inactive}`}>
                          {STATUS_LABELS[status] ?? status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {sub?.currentPeriodEnd
                          ? format(new Date(sub.currentPeriodEnd), "dd/MM/yyyy")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setGrantTarget(org);
                              setGrantPlan("scale");
                              setGrantDate(undefined);
                              setShowGrantModal(true);
                            }}
                          >
                            Liberar
                          </Button>
                          {isActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={revoking === org.id}
                              onClick={() => handleRevoke(org)}
                            >
                              {revoking === org.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : "Revogar"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grant Modal */}
      <Dialog open={showGrantModal} onOpenChange={setShowGrantModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Liberar acesso</DialogTitle>
          </DialogHeader>
          {grantTarget && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{grantTarget.name}</span>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Plano</label>
                <Select value={grantPlan} onValueChange={setGrantPlan}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start">Start</SelectItem>
                    <SelectItem value="scale">Scale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Válido até</label>
                <Popover open={grantDateOpen} onOpenChange={setGrantDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {grantDate ? format(grantDate, "dd/MM/yyyy") : "Sem data limite (10 anos)"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={grantDate}
                      onSelect={(d) => { setGrantDate(d ?? undefined); setGrantDateOpen(false); }}
                      disabled={(d) => d < new Date()}
                      initialFocus
                    />
                    {grantDate && (
                      <div className="p-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => setGrantDate(undefined)}
                        >
                          Limpar data
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrantModal(false)}>Cancelar</Button>
            <Button onClick={handleGrant} disabled={submitting}>
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Sheet */}
      <Sheet open={showHistory} onOpenChange={setShowHistory}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Histórico — {selectedOrg?.name}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {grantsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : grants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum histórico encontrado
              </p>
            ) : (
              grants.map(g => (
                <div key={g.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  {g.action === "grant"
                    ? <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    : <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {g.action === "grant"
                        ? `Liberado — ${PLAN_LABELS[g.plan ?? ""] ?? g.plan ?? ""}`
                        : "Revogado"}
                    </p>
                    {g.expiresAt && (
                      <p className="text-xs text-muted-foreground">
                        Até {format(new Date(g.expiresAt), "dd/MM/yyyy")}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(g.createdAt), "dd/MM/yyyy HH:mm")} · {g.grantedBy}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
