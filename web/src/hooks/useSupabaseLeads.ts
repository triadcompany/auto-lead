import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { triggerN8nWebhook } from '@/services/n8nWebhook';
import { publishAutomationEvent, AI_EVENTS } from '@/services/automationEventBus';

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  seller_id: string;
  source: string;
  interest: string;
  price?: string;
  observations: string;
  stage_id: string;
  created_at: string;
  created_by: string;
  valor_negocio?: number;
  servico?: string;
  cidade?: string;
  estado?: string;
  seller_name?: string;
  stage_name?: string;
  stage_position?: number;
}

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
  color: string;
  is_active: boolean;
}

export interface KanbanColumn {
  id: string;
  title: string;
  leads: Lead[];
  color: string;
  count: number;
  position: number;
}

// ─── query key factories ───────────────────────────────────────────────────
const stagesKey = (orgId: string | undefined, pipelineId: string | undefined) =>
  ['stages', orgId, pipelineId] as const;

const leadsKey = (orgId: string | undefined, isAdmin: boolean, sellerId: string | undefined) =>
  ['leads', orgId, isAdmin, sellerId] as const;

// ─── hook ─────────────────────────────────────────────────────────────────
export function useSupabaseLeads(pipelineId?: string) {
  const { profile, isAdmin, orgId: authOrgId } = useAuth();
  // Always prefer the ACTIVE org from AuthContext (kept in sync on org switch).
  const orgId = authOrgId || profile?.organization_id;
  const clerkUserId = profile?.clerk_user_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // ── Stages query ─────────────────────────────────────────────────────────
  const stagesQuery = useQuery({
    queryKey: stagesKey(orgId, pipelineId),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PipelineStage[]> => {
      if (!orgId) return [];

      let activePipelineId = pipelineId;

      if (!activePipelineId) {
        const { data: orgPipelines } = await supabase.rpc('get_org_pipelines', {
          p_org_id: orgId,
        });
        const list = (orgPipelines || []) as any[];
        const defaultPipeline = list.find((p: any) => p.is_default) || list[0];

        if (!defaultPipeline) {
          if (clerkUserId) {
            const { data: seededId } = await supabase.rpc('ensure_default_pipeline', {
              p_org_id: orgId,
              p_created_by: clerkUserId,
            });
            activePipelineId = seededId;
          }
        } else {
          activePipelineId = defaultPipeline.id;
        }
      }

      if (!activePipelineId) return [];

      const { data, error } = await supabase.rpc('get_pipeline_stages', {
        p_pipeline_id: activePipelineId,
      });

      if (error) throw new Error(error.message);
      return (data || []) as PipelineStage[];
    },
    meta: { errorMessage: 'Erro ao carregar etapas do pipeline' },
  });

  // ── Leads query ──────────────────────────────────────────────────────────
  const leadsQuery = useQuery({
    queryKey: leadsKey(orgId, isAdmin, profile?.id),
    enabled: !!orgId && !!clerkUserId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<Lead[]> => {
      if (!orgId || !clerkUserId) return [];

      const { data, error } = await supabase.rpc('get_org_leads', {
        p_clerk_user_id: clerkUserId,
        p_org_id: orgId,
        p_is_admin: isAdmin || false,
        p_seller_id: (!isAdmin && profile?.id) ? profile.id : null,
      });

      if (error) throw new Error(error.message);
      return ((data as unknown) as Lead[]) || [];
    },
    meta: { errorMessage: 'Erro ao carregar leads' },
  });

  // Surface query errors as toasts (single place, not per-mutation)
  if (stagesQuery.error && !stagesQuery.isFetching) {
    toast({ title: 'Erro', description: 'Erro ao carregar etapas do pipeline', variant: 'destructive' });
  }
  if (leadsQuery.error && !leadsQuery.isFetching) {
    toast({ title: 'Erro', description: 'Erro ao carregar leads', variant: 'destructive' });
  }

  const leads = leadsQuery.data ?? [];
  const stages = stagesQuery.data ?? [];
  const loading = leadsQuery.isLoading || stagesQuery.isLoading;

  // ── Memoized derived state ────────────────────────────────────────────────
  const filteredLeads = useMemo<Lead[]>(() => {
    if (!searchTerm.trim()) return leads;
    const term = searchTerm.toLowerCase();
    return leads.filter(lead =>
      lead.name.toLowerCase().includes(term) ||
      lead.phone.toLowerCase().includes(term) ||
      (lead.email && lead.email.toLowerCase().includes(term)) ||
      (lead.interest && lead.interest.toLowerCase().includes(term)) ||
      (lead.observations && lead.observations.toLowerCase().includes(term))
    );
  }, [leads, searchTerm]);

  const kanbanColumns = useMemo<KanbanColumn[]>(() => {
    return stages
      .map(stage => {
        const stageLeads = filteredLeads.filter(lead => lead.stage_id === stage.id);
        return {
          id: stage.id,
          title: stage.name,
          leads: stageLeads,
          color: stage.color,
          count: stageLeads.length,
          position: stage.position,
        };
      })
      .sort((a, b) => a.position - b.position);
  }, [filteredLeads, stages]);

  // ── moveLead mutation (optimistic update) ────────────────────────────────
  const moveLeadMutation = useMutation({
    mutationFn: async ({ leadId, newStageId }: { leadId: string; newStageId: string }) => {
      if (!profile?.clerk_user_id) throw new Error('Not authenticated');
      const { error } = await supabase.rpc('update_lead_rpc', {
        p_clerk_user_id: profile.clerk_user_id,
        p_lead_id: leadId,
        p_data: { stage_id: newStageId } as any,
      });
      if (error) throw new Error(error.message);
      return { leadId, newStageId };
    },
    onMutate: async ({ leadId, newStageId }) => {
      // Optimistic update — update cache immediately so Kanban feels instant
      await queryClient.cancelQueries({ queryKey: leadsKey(orgId, isAdmin, profile?.id) });
      const previous = queryClient.getQueryData<Lead[]>(leadsKey(orgId, isAdmin, profile?.id));
      queryClient.setQueryData<Lead[]>(leadsKey(orgId, isAdmin, profile?.id), old =>
        (old ?? []).map(l =>
          l.id === leadId
            ? { ...l, stage_id: newStageId, stage_name: stages.find(s => s.id === newStageId)?.name }
            : l
        )
      );
      return { previous };
    },
    onSuccess: ({ leadId, newStageId }) => {
      toast({ title: 'Sucesso', description: 'Lead movido com sucesso' });

      const currentLead = leads.find(l => l.id === leadId);
      const oldStage = stages.find(s => s.id === currentLead?.stage_id);
      const newStage = stages.find(s => s.id === newStageId);

      if (currentLead && profile?.organization_id) {
        triggerN8nWebhook(
          profile.organization_id,
          { id: currentLead.id, name: currentLead.name, email: currentLead.email,
            phone: currentLead.phone, source: currentLead.source,
            interest: currentLead.interest, observations: currentLead.observations },
          { from: oldStage?.name || 'Desconhecido', to: newStage?.name || 'Desconhecido',
            fromId: currentLead.stage_id, toId: newStageId }
        );

        publishAutomationEvent({
          organizationId: profile.organization_id,
          eventName: AI_EVENTS.DEAL_STAGE_CHANGED as any,
          entityType: 'lead', entityId: currentLead.id, leadId: currentLead.id,
          payload: {
            trace_id: crypto.randomUUID(),
            lead_id: currentLead.id, phone: currentLead.phone,
            email: currentLead.email, lead_name: currentLead.name,
            lead_source: currentLead.source,
            lead_value: currentLead.valor_negocio || null,
            from_stage_id: currentLead.stage_id, from_stage_name: oldStage?.name || '',
            to_stage_id: newStageId, to_stage_name: newStage?.name || '',
            pipeline_id: pipelineId || '', changed_by_user_id: profile.id,
            occurred_at: new Date().toISOString(),
          },
          source: 'human',
          idempotencyParts: [currentLead.id, newStageId],
        }).catch(() => {/* non-blocking */});
      }
    },
    onError: (err: Error, _, context) => {
      // Roll back optimistic update
      if (context?.previous) {
        queryClient.setQueryData(leadsKey(orgId, isAdmin, profile?.id), context.previous);
      }
      toast({ title: 'Erro', description: err.message || 'Erro ao mover lead', variant: 'destructive' });
    },
  });

  // ── updateLead mutation ───────────────────────────────────────────────────
  const updateLeadMutation = useMutation({
    mutationFn: async ({ leadId, updatedData }: { leadId: string; updatedData: Partial<Lead> }) => {
      if (!profile?.clerk_user_id) throw new Error('Not authenticated');
      const { error } = await supabase.rpc('update_lead_rpc', {
        p_clerk_user_id: profile.clerk_user_id,
        p_lead_id: leadId,
        p_data: updatedData as any,
      });
      if (error) throw new Error(error.message);
      return { leadId, updatedData };
    },
    onMutate: async ({ leadId, updatedData }) => {
      await queryClient.cancelQueries({ queryKey: leadsKey(orgId, isAdmin, profile?.id) });
      const previous = queryClient.getQueryData<Lead[]>(leadsKey(orgId, isAdmin, profile?.id));
      queryClient.setQueryData<Lead[]>(leadsKey(orgId, isAdmin, profile?.id), old =>
        (old ?? []).map(l => l.id === leadId ? { ...l, ...updatedData } : l)
      );
      return { previous };
    },
    onSuccess: () => {
      toast({ title: 'Sucesso', description: 'Lead atualizado com sucesso' });
    },
    onError: (err: Error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(leadsKey(orgId, isAdmin, profile?.id), context.previous);
      }
      toast({ title: 'Erro', description: `Erro ao atualizar lead: ${err.message}`, variant: 'destructive' });
    },
  });

  // ── addLead mutation ──────────────────────────────────────────────────────
  const addLeadMutation = useMutation({
    mutationFn: async (newLeadData: Omit<Lead, 'id' | 'created_at' | 'created_by' | 'stage_id'> & { stage_id?: string }) => {
      if (!profile?.clerk_user_id) throw new Error('Sessão não está pronta. Recarregue a página.');

      const stageId = (newLeadData as any).stage_id
        || [...stages].sort((a, b) => a.position - b.position)[0]?.id;

      if (!stageId) throw new Error('Nenhuma etapa do funil disponível. Selecione uma etapa.');

      const { data, error } = await supabase.rpc('create_lead_rpc', {
        p_clerk_user_id: profile.clerk_user_id,
        p_name: newLeadData.name,
        p_phone: newLeadData.phone || '',
        p_email: newLeadData.email || '',
        p_source: newLeadData.source || '',
        p_interest: newLeadData.interest || '',
        p_price: (newLeadData as any).price || '',
        p_observations: newLeadData.observations || '',
        p_servico: (newLeadData as any).servico || '',
        p_cidade: (newLeadData as any).cidade || '',
        p_estado: (newLeadData as any).estado || '',
        p_seller_id: (newLeadData as any).seller_id || null,
        p_stage_id: stageId,
        p_org_id: orgId || null,
      } as any);

      if (error) throw new Error(error.message);
      return data as any;
    },
    onSuccess: (createdLead) => {
      queryClient.invalidateQueries({ queryKey: leadsKey(orgId, isAdmin, profile?.id) });
      toast({ title: 'Sucesso', description: 'Lead criado com sucesso' });

      if (orgId && createdLead?.id) {
        supabase.functions.invoke('automation-trigger', {
          body: {
            organization_id: orgId, trigger_type: 'lead_created',
            entity_type: 'lead', entity_id: createdLead.id,
            context: {
              lead_name: createdLead.name, lead_phone: createdLead.phone,
              lead_email: createdLead.email, lead_source: createdLead.source,
              stage_id: createdLead.stage_id, seller_id: createdLead.seller_id,
            },
          },
        }).then(({ error: fnErr }) => {
          if (fnErr) console.error('automation-trigger error:', fnErr);
        });
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Erro', description: err.message || 'Erro ao criar lead', variant: 'destructive' });
    },
  });

  // ── deleteLead mutation ───────────────────────────────────────────────────
  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      if (!profile?.clerk_user_id) throw new Error('Not authenticated');
      const { error } = await supabase.rpc('delete_lead_rpc', {
        p_clerk_user_id: profile.clerk_user_id,
        p_lead_id: leadId,
      });
      if (error) throw new Error(error.message);
      return leadId;
    },
    onMutate: async (leadId) => {
      await queryClient.cancelQueries({ queryKey: leadsKey(orgId, isAdmin, profile?.id) });
      const previous = queryClient.getQueryData<Lead[]>(leadsKey(orgId, isAdmin, profile?.id));
      queryClient.setQueryData<Lead[]>(leadsKey(orgId, isAdmin, profile?.id), old =>
        (old ?? []).filter(l => l.id !== leadId)
      );
      return { previous };
    },
    onSuccess: () => {
      toast({ title: 'Sucesso', description: 'Lead excluído com sucesso' });
    },
    onError: (err: Error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(leadsKey(orgId, isAdmin, profile?.id), context.previous);
      }
      toast({ title: 'Erro', description: err.message || 'Erro ao excluir lead. Verifique suas permissões.', variant: 'destructive' });
    },
  });

  // ── Supabase Realtime — updates cache without page reload ────────────────
  // Refs keep the callback closure stable without re-subscribing on every render.
  const isAdminRef = useRef(isAdmin);
  const profileIdRef = useRef(profile?.id);
  const stagesRef = useRef(stages);
  const queryClientRef = useRef(queryClient);
  isAdminRef.current = isAdmin;
  profileIdRef.current = profile?.id;
  stagesRef.current = stages;
  queryClientRef.current = queryClient;

  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`leads-rt-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads', filter: `organization_id=eq.${orgId}` },
        (payload) => {
          const qc = queryClientRef.current;
          const key = leadsKey(orgId, isAdminRef.current, profileIdRef.current);

          if (payload.eventType === 'DELETE') {
            // Remove immediately from cache — no refetch needed
            const deletedId = (payload.old as any).id as string;
            qc.setQueryData<Lead[]>(key, (old) => (old ?? []).filter((l) => l.id !== deletedId));
          } else if (payload.eventType === 'UPDATE') {
            // Patch cache with updated fields + resolve stage_name from local stages
            const updated = payload.new as any;
            qc.setQueryData<Lead[]>(key, (old) =>
              (old ?? []).map((l) =>
                l.id === updated.id
                  ? {
                      ...l,
                      ...updated,
                      stage_name:
                        stagesRef.current.find((s) => s.id === updated.stage_id)?.name ??
                        l.stage_name,
                    }
                  : l
              )
            );
          } else if (payload.eventType === 'INSERT') {
            // Invalidate so the RPC is re-run with all JOIN fields (stage_name, seller_name…)
            qc.invalidateQueries({ queryKey: key });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]); // Recreate channel whenever the active org changes

  // ── Stable wrappers (same signatures as before) ───────────────────────────
  const moveLead = (leadId: string, newStageId: string) =>
    moveLeadMutation.mutateAsync({ leadId, newStageId });

  const updateLead = (leadId: string, updatedData: Partial<Lead>) =>
    updateLeadMutation.mutateAsync({ leadId, updatedData });

  const addLead = (newLeadData: Omit<Lead, 'id' | 'created_at' | 'created_by' | 'stage_id'> & { stage_id?: string }) =>
    addLeadMutation.mutateAsync(newLeadData);

  const deleteLead = (leadId: string) =>
    deleteLeadMutation.mutateAsync(leadId);

  const refreshLeads = () =>
    queryClient.invalidateQueries({ queryKey: leadsKey(orgId, isAdmin, profile?.id) });

  return {
    leads,
    stages,
    loading,
    searchTerm,
    setSearchTerm,
    filteredLeads,
    kanbanColumns,
    moveLead,
    updateLead,
    addLead,
    deleteLead,
    refreshLeads,
  };
}
