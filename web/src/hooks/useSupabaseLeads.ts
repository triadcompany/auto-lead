import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';
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

function normalizeLead(l: any): Lead {
  return {
    id: l.id,
    name: l.name || '',
    email: l.email || '',
    phone: l.phone || '',
    seller_id: l.sellerId || l.seller_id || '',
    source: l.source || '',
    interest: l.interest || '',
    price: l.price,
    observations: l.observations || '',
    stage_id: l.stageId || l.stage_id || '',
    created_at: l.createdAt || l.created_at || '',
    created_by: l.createdBy || l.created_by || '',
    valor_negocio: l.valorNegocio ?? l.valor_negocio,
    servico: l.servico,
    cidade: l.cidade,
    estado: l.estado,
    seller_name: l.sellerName || l.seller_name,
    stage_name: l.stageName || l.stage_name,
    stage_position: l.stagePosition ?? l.stage_position,
  };
}

function normalizeStage(s: any): PipelineStage {
  return {
    id: s.id,
    name: s.name || '',
    position: s.position ?? 0,
    color: s.color || '#6366f1',
    is_active: s.isActive ?? s.is_active ?? true,
  };
}

// ─── query key factories ───────────────────────────────────────────────────
const stagesKey = (orgId: string | undefined, pipelineId: string | undefined) =>
  ['stages', orgId, pipelineId] as const;

const leadsKey = (orgId: string | undefined, isAdmin: boolean, sellerId: string | undefined) =>
  ['leads', orgId, isAdmin, sellerId] as const;

// ─── hook ─────────────────────────────────────────────────────────────────
export function useSupabaseLeads(pipelineId?: string) {
  const { profile, isAdmin, orgId: authOrgId } = useAuth();
  const orgId = authOrgId || profile?.organization_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const api = useApi();
  const { on } = useSocket();
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
        const pipelines = await api.pipelines.list();
        const list = Array.isArray(pipelines) ? pipelines : [];
        const defaultPipeline = list.find((p: any) => p.isDefault || p.is_default) || list[0];

        if (!defaultPipeline) {
          try {
            const seeded = await api.pipelines.ensureDefault() as any;
            activePipelineId = seeded?.id;
          } catch {
            return [];
          }
        } else {
          activePipelineId = defaultPipeline.id;
        }
      }

      if (!activePipelineId) return [];

      const data = await api.pipelines.stages(activePipelineId);
      return (Array.isArray(data) ? data : []).map(normalizeStage);
    },
    meta: { errorMessage: 'Erro ao carregar etapas do pipeline' },
  });

  // ── Leads query ──────────────────────────────────────────────────────────
  const leadsQuery = useQuery({
    queryKey: leadsKey(orgId, isAdmin, profile?.id),
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<Lead[]> => {
      if (!orgId) return [];

      const params: Record<string, string> = {};
      if (!isAdmin && profile?.id) params.seller_id = profile.id;
      if (pipelineId) params.pipeline_id = pipelineId;

      const data = await api.leads.list(params);
      return (Array.isArray(data) ? data : []).map(normalizeLead);
    },
    meta: { errorMessage: 'Erro ao carregar leads' },
  });

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
      await api.leads.moveStage(leadId, newStageId);
      return { leadId, newStageId };
    },
    onMutate: async ({ leadId, newStageId }) => {
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
      if (context?.previous) {
        queryClient.setQueryData(leadsKey(orgId, isAdmin, profile?.id), context.previous);
      }
      toast({ title: 'Erro', description: err.message || 'Erro ao mover lead', variant: 'destructive' });
    },
  });

  // ── updateLead mutation ───────────────────────────────────────────────────
  const updateLeadMutation = useMutation({
    mutationFn: async ({ leadId, updatedData }: { leadId: string; updatedData: Partial<Lead> }) => {
      await api.leads.update(leadId, updatedData as Record<string, unknown>);
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
      const stageId = (newLeadData as any).stage_id
        || [...stages].sort((a, b) => a.position - b.position)[0]?.id;

      if (!stageId) throw new Error('Nenhuma etapa do funil disponível. Selecione uma etapa.');

      const raw = await api.leads.create({
        name: newLeadData.name,
        phone: newLeadData.phone || '',
        email: newLeadData.email || '',
        source: newLeadData.source || '',
        interest: newLeadData.interest || '',
        observations: newLeadData.observations || '',
        servico: (newLeadData as any).servico || '',
        cidade: (newLeadData as any).cidade || '',
        estado: (newLeadData as any).estado || '',
        seller_id: (newLeadData as any).seller_id || null,
        stage_id: stageId,
        created_by: profile?.id || null,
      }) as any;

      return normalizeLead(raw);
    },
    onSuccess: (newLead) => {
      const key = leadsKey(orgId, isAdmin, profile?.id);
      queryClient.setQueryData<Lead[]>(key, old => {
        if (!old) return [newLead];
        if (old.some(l => l.id === newLead.id)) return old;
        return [newLead, ...old];
      });
      toast({ title: 'Sucesso', description: 'Lead criado com sucesso' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro', description: err.message || 'Erro ao criar lead', variant: 'destructive' });
    },
  });

  // ── deleteLead mutation ───────────────────────────────────────────────────
  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      await api.leads.delete(leadId);
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

  // ── Socket.io Realtime updates ────────────────────────────────────────────
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

    const offCreated = on('lead:created', (payload: any) => {
      const qc = queryClientRef.current;
      const key = leadsKey(orgId, isAdminRef.current, profileIdRef.current);
      if (!payload?.id) {
        qc.invalidateQueries({ queryKey: key });
        return;
      }
      const newLead = normalizeLead(payload);
      qc.setQueryData<Lead[]>(key, old => {
        if (!old) return [newLead];
        if (old.some(l => l.id === newLead.id)) return old;
        return [newLead, ...old];
      });
    });

    const offUpdated = on('lead:updated', (payload: any) => {
      const qc = queryClientRef.current;
      const key = leadsKey(orgId, isAdminRef.current, profileIdRef.current);
      const updated = payload?.lead || payload;
      if (!updated?.id) { qc.invalidateQueries({ queryKey: key }); return; }
      qc.setQueryData<Lead[]>(key, old =>
        (old ?? []).map(l =>
          l.id === updated.id
            ? { ...l, ...normalizeLead(updated),
                stage_name: stagesRef.current.find(s => s.id === (updated.stageId || updated.stage_id))?.name ?? l.stage_name }
            : l
        )
      );
    });

    const offDeleted = on('lead:deleted', (payload: any) => {
      const deletedId = payload?.id || payload?.leadId;
      if (!deletedId) return;
      const qc = queryClientRef.current;
      const key = leadsKey(orgId, isAdminRef.current, profileIdRef.current);
      qc.setQueryData<Lead[]>(key, old => (old ?? []).filter(l => l.id !== deletedId));
    });

    const offMoved = on('lead:moved', (payload: any) => {
      const { lead, toStageId } = payload || {};
      if (!lead?.id || !toStageId) return;
      const qc = queryClientRef.current;
      const key = leadsKey(orgId, isAdminRef.current, profileIdRef.current);
      qc.setQueryData<Lead[]>(key, old =>
        (old ?? []).map(l =>
          l.id === lead.id
            ? { ...l, ...normalizeLead(lead),
                stage_id: toStageId,
                stage_name: stagesRef.current.find(s => s.id === toStageId)?.name ?? l.stage_name }
            : l
        )
      );
    });

    return () => {
      offCreated?.();
      offUpdated?.();
      offDeleted?.();
      offMoved?.();
    };
  }, [orgId, on]);

  // ── Stable wrappers ───────────────────────────────────────────────────────
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
