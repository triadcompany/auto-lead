import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { Loader2, Users, Merge } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onMerged?: () => void;
}

export function DuplicatesModal({ open, onClose, onMerged }: Props) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<{ key: string; leads: any[] }[]>([]);
  const [mergingKey, setMergingKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.leads.duplicates();
      setGroups(res.groups || []);
    } catch {
      toast.error("Erro ao buscar duplicados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const handleMerge = async (group: { key: string; leads: any[] }) => {
    // Mantém o lead mais antigo (primeiro) como principal
    const [primary, ...dups] = group.leads;
    setMergingKey(group.key);
    try {
      const res = await api.leads.merge(primary.id, dups.map((d) => d.id));
      toast.success(`${res.merged} lead(s) fundido(s) em "${primary.name}"`);
      setGroups((g) => g.filter((x) => x.key !== group.key));
      onMerged?.();
    } catch {
      toast.error("Erro ao fundir leads");
    } finally {
      setMergingKey(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Leads Duplicados
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : groups.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            Nenhum lead duplicado encontrado. 🎉
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {groups.length} grupo(s) de duplicados (mesmo telefone ou e-mail). Ao fundir, o lead
              mais antigo é mantido e as tarefas/conversas dos outros migram para ele.
            </p>
            {groups.map((group) => (
              <div key={group.key} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    {group.key.startsWith("p:") ? "Telefone" : "E-mail"} · {group.leads.length} leads
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleMerge(group)}
                    disabled={mergingKey === group.key}
                  >
                    {mergingKey === group.key ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Merge className="h-3.5 w-3.5 mr-1" />
                    )}
                    Fundir
                  </Button>
                </div>
                <div className="space-y-1">
                  {group.leads.map((l, i) => (
                    <div key={l.id} className="flex items-center gap-2 text-sm">
                      <span className={i === 0 ? "font-semibold text-primary" : "text-foreground"}>
                        {l.name}
                      </span>
                      {i === 0 && <span className="text-[10px] bg-primary/10 text-primary px-1.5 rounded">principal</span>}
                      <span className="text-muted-foreground text-xs">{l.phone}</span>
                      {l.email && <span className="text-muted-foreground text-xs">· {l.email}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
