import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface LeadSource {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

function leadSourcesQueryKey(orgId: string | undefined) {
  return ["lead-sources", orgId];
}

export function useLeadSources() {
  const { toast } = useToast();
  const { profile, orgId: authOrgId } = useAuth();
  const orgId = profile?.organization_id || authOrgId;
  const queryClient = useQueryClient();

  const { data: leadSources = [], isLoading: loading, refetch } = useQuery({
    queryKey: leadSourcesQueryKey(orgId),
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase.rpc('get_org_lead_sources', {
        p_org_id: orgId,
      });

      if (error) throw error;
      return (data || []) as LeadSource[];
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });

  const createSource = useMutation({
    mutationFn: async ({ name, description, sort_order }: { name: string; description?: string; sort_order?: number }) => {
      if (!orgId) throw new Error("Organização não encontrada");
      const { error } = await supabase.from("lead_sources").insert({
        name: name.trim(),
        description: description?.trim() || null,
        organization_id: orgId,
        created_by: profile?.id || null,
        sort_order: sort_order ?? 0,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Já existe uma origem com este nome");
        throw error;
      }
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
    mutationFn: async ({ id, name, description, is_active, sort_order }: { id: string; name?: string; description?: string | null; is_active?: boolean; sort_order?: number }) => {
      const updates: { name?: string; description?: string | null; is_active?: boolean; sort_order?: number } = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description;
      if (is_active !== undefined) updates.is_active = is_active;
      if (sort_order !== undefined) updates.sort_order = sort_order;
      const { error } = await supabase.from("lead_sources").update(updates).eq("id", id);
      if (error) throw error;
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
      const { error } = await supabase.from("lead_sources").update({ is_active: false }).eq("id", id);
      if (error) throw error;
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
