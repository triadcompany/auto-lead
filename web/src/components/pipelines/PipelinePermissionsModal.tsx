import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Crown } from 'lucide-react';

interface OrgMember {
  profile_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  clerk_user_id: string;
  role: string;
  is_owner: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string | null;
  pipelineName: string;
  orgId: string | null;
}

function initials(name?: string) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function PipelinePermissionsModal({
  open,
  onOpenChange,
  pipelineId,
  pipelineName,
  orgId,
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !pipelineId || !orgId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [membersRes, permsRes] = await Promise.all([
          supabase.rpc('get_org_profile_members', { p_org_id: orgId }),
          supabase.rpc('list_pipeline_permissions', { p_pipeline_id: pipelineId }),
        ]);
        if (cancelled) return;
        if (membersRes.error) throw membersRes.error;
        if (permsRes.error) throw permsRes.error;

        const memberList = (membersRes.data || []) as OrgMember[];
        const permIds = new Set<string>(
          ((permsRes.data || []) as { profile_id: string }[]).map((p) => p.profile_id),
        );
        setMembers(memberList);
        setSelected(permIds);
      } catch (err: any) {
        toast({
          title: 'Erro',
          description: err.message || 'Falha ao carregar permissões',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, pipelineId, orgId, toast]);

  const toggle = (profileId: string, isOwner: boolean) => {
    if (isOwner) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!pipelineId) return;
    setSaving(true);
    try {
      const ids = members
        .filter((m) => !m.is_owner && selected.has(m.profile_id))
        .map((m) => m.profile_id);

      const { error } = await supabase.rpc('set_pipeline_permissions', {
        p_pipeline_id: pipelineId,
        p_profile_ids: ids,
      });
      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Permissões atualizadas' });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Falha ao salvar permissões',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Permissões — {pipelineName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[420px] pr-4">
            <div className="space-y-2">
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum usuário encontrado nesta organização.
                </p>
              )}
              {members.map((m) => {
                const checked = m.is_owner || selected.has(m.profile_id);
                return (
                  <div
                    key={m.profile_id}
                    className="flex items-center justify-between gap-3 p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9">
                        {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.name} />}
                        <AvatarFallback>{initials(m.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{m.name || m.email}</span>
                          {m.is_owner && (
                            <Crown className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                            {m.role === 'admin' ? 'Admin' : 'Vendedor'}
                          </Badge>
                          <span className="truncate">{m.email}</span>
                        </div>
                      </div>
                    </div>

                    {m.is_owner ? (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        Dono — acesso total
                      </span>
                    ) : (
                      <Switch
                        checked={checked}
                        onCheckedChange={() => toggle(m.profile_id, m.is_owner)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar permissões
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
