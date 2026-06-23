import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";

export interface LeadSource {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

function leadSourcesQueryKey(orgId: string | undefined) {
  return ["lead-sources", orgId];
}

export function useLeadSources() {
  const { toast } = useToast();
  const { profile, orgId: authOrgId } = useAuth();
  const orgId = profile?.organization_id || authOrgId;
  const queryClient = useQueryClient();
  const api = useApi();

  const { data: leadSources = [], isLoading: loading, refetch } = useQuery({
    queryKey: leadSourcesQueryKey(orgId),
    queryFn: async () => {
      if (!orgId) return [];
      return api.leadSources.list() as Promise<LeadSource[]>;
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });

  const createSource = useMutation({
    mutationFn: async ({ name, sort_order }: { name: string; description?: string; sort_order?: number }) => {
      if (!orgId) throw new Error("Organização não encontrada");
      await api.leadSources.create({ name: name.trim(), sort_order });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadSourcesQueryKey(orgId) });
      toast({ title: "Sucesso", description: "Origem de lead criada com sucesso" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const updateSource = useMutation({
    mutationFn: async ({ id, name, is_active, sort_order }: { id: string; name?: string; description?: string | null; is_active?: boolean; sort_order?: number }) => {
      await api.leadSources.update(id, {
        ...(name !== undefined && { name: name.trim() }),
        ...(is_active !== undefined && { is_active }),
        ...(sort_order !== undefined && { sort_order }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadSourcesQueryKey(orgId) });
      toast({ title: "Sucesso", description: "Origem atualizada" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao atualizar origem", variant: "destructive" });
    },
  });

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      await api.leadSources.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadSourcesQueryKey(orgId) });
      toast({ title: "Sucesso", description: "Origem removida" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao remover origem", variant: "destructive" });
    },
  });

  return {
    leadSources,
    loading,
    refreshLeadSources: refetch,
    createSource,
    updateSource,
    deleteSource,
  };
}
