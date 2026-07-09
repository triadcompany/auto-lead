import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Users, Shield, UserPlus, Trash2, Mail, Copy, Clock,
} from "lucide-react";

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "seller";
  avatarUrl?: string | null;
  clerkUserId?: string | null;
}
interface PendingInvite {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

const ROLE_STYLES: Record<string, string> = {
  admin: "border-primary/30 bg-primary/10 text-primary",
  seller: "border-border bg-muted text-muted-foreground",
};
const ROLE_LABELS: Record<string, string> = { admin: "Admin", seller: "Vendedor" };

export function OrgUsersSheet({
  org, open, onClose,
}: {
  org: { id: string; name: string } | null;
  open: boolean;
  onClose: () => void;
}) {
  const api = useApi();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "seller">("seller");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!org) return;
    setLoading(true);
    try {
      const res = await api.admin.getOrgUsers(org.id);
      setUsers(res.users || []);
      setInvites(res.pending_invites || []);
    } catch {
      toast({ title: "Erro ao carregar usuários", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && org) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, org?.id]);

  const handleAdd = async () => {
    if (!org || !newEmail.trim()) return;
    setAdding(true);
    try {
      const res = await api.admin.addOrgUser(org.id, {
        email: newEmail.trim(), name: newName.trim() || undefined, role: newRole,
      });
      if (res.moved) {
        toast({ title: "Usuário movido para esta empresa" });
      } else if (res.invite_url) {
        toast({ title: "Convite criado", description: "Link copiado para a área de transferência" });
        navigator.clipboard?.writeText(res.invite_url).catch(() => {});
      }
      setNewEmail(""); setNewName(""); setNewRole("seller");
      await load();
    } catch (e: any) {
      toast({ title: "Erro ao adicionar usuário", description: e?.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleRole = async (u: OrgUser, role: "admin" | "seller") => {
    if (!org) return;
    setBusyId(u.id);
    try {
      await api.admin.setOrgUserRole(org.id, u.id, role);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
      toast({ title: `Papel alterado para ${ROLE_LABELS[role]}` });
    } catch {
      toast({ title: "Erro ao alterar papel", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (u: OrgUser) => {
    if (!org) return;
    if (!confirm(`Remover ${u.name} desta empresa?`)) return;
    setBusyId(u.id);
    try {
      await api.admin.removeOrgUser(org.id, u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast({ title: "Usuário removido" });
    } catch {
      toast({ title: "Erro ao remover usuário", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuários — {org?.name}
          </SheetTitle>
        </SheetHeader>

        {/* Adicionar usuário */}
        <div className="mt-5 rounded-lg border border-border p-3 space-y-3 bg-muted/30">
          <p className="text-sm font-medium flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Adicionar usuário
          </p>
          <Input
            placeholder="E-mail"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <div className="flex gap-2">
            <Input
              placeholder="Nome (opcional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
            />
            <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "seller")}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seller">Vendedor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={adding || !newEmail.trim()} className="w-full">
            {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
            Adicionar
          </Button>
          <p className="text-xs text-muted-foreground">
            Se o e-mail já tiver conta, o usuário é movido para esta empresa. Senão, um convite é
            criado e o link copiado para você enviar.
          </p>
        </div>

        {/* Lista de usuários */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Membros ({users.length})</p>
            <Badge variant="outline" className="text-xs">{adminCount} admin(s)</Badge>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum usuário nesta empresa.</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {u.avatarUrl
                      ? <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                      : <span className="text-sm font-semibold text-primary">{u.name?.[0]?.toUpperCase() || "?"}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <Select
                    value={u.role}
                    onValueChange={(v) => handleRole(u, v as "admin" | "seller")}
                    disabled={busyId === u.id}
                  >
                    <SelectTrigger className={`h-7 w-28 text-xs ${ROLE_STYLES[u.role]}`}>
                      {busyId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue />}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seller">Vendedor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    disabled={busyId === u.id}
                    onClick={() => handleRemove(u)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Convites pendentes */}
        {invites.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Convites pendentes ({invites.length})
            </p>
            <div className="space-y-2">
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-border">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABELS[inv.role] || inv.role} · aguardando aceite</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="Copiar link do convite"
                    onClick={() => {
                      const url = `${window.location.origin}/invite?token=${inv.id}`;
                      navigator.clipboard?.writeText(url);
                      toast({ title: "Link copiado" });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
