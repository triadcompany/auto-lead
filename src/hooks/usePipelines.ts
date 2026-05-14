import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  organization_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
  color: string;
  is_active: boolean;
  pipeline_id: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

function prefKey(clerkUserId: string | undefined, orgId: string | undefined) {
  return `pipeline_pref_${clerkUserId || ''}_${orgId || ''}`;
}

export function usePipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [preferredPipelineId, setPreferredPipelineIdState] = useState<string | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [ensuring, setEnsuring] = useState(false);
  const { profile, orgId: authOrgId, user } = useAuth();
  const orgId = profile?.organization_id || authOrgId;
  const clerkUserId = profile?.clerk_user_id || user?.id;
  const { toast } = useToast();

  // Load saved preference from localStorage on mount
  useEffect(() => {
    if (!clerkUserId || !orgId) return;
    const saved = localStorage.getItem(prefKey(clerkUserId, orgId));
    if (saved) setPreferredPipelineIdState(saved);
  }, [clerkUserId, orgId]);

  const setPreferredPipeline = useCallback((pipelineId: string) => {
    if (!clerkUserId || !orgId) return;
    localStorage.setItem(prefKey(clerkUserId, orgId), pipelineId);
    setPreferredPipelineIdState(pipelineId);
    toast({ title: 'Pipeline padrão definido', description: 'Esta pipeline será carregada ao abrir Oportunidades.' });
  }, [clerkUserId, orgId, toast]);

  // Silent version: auto-saves last selected pipeline without showing a toast.
  // Used in Oportunidades so the last opened kanban is restored on next visit.
  const selectPipeline = useCallback((pipeline: Pipeline | null) => {
    setSelectedPipeline(pipeline);
    if (pipeline && clerkUserId && orgId) {
      localStorage.setItem(prefKey(clerkUserId, orgId), pipeline.id);
      setPreferredPipelineIdState(pipeline.id);
    }
  }, [clerkUserId, orgId]);

  // Ensure default pipeline exists for the org
  const ensureDefaultPipeline = useCallback(async () => {
    if (!orgId) return false;
    
    setEnsuring(true);
    try {
      const { data, error } = await supabase.rpc('ensure_default_pipeline', {
        p_org_id: orgId,
        p_created_by: clerkUserId || 'system',
      });
      
      if (error) {
        console.error('Error ensuring pipeline:', error);
        return false;
      }
      
      console.log('✅ Default pipeline ensured:', data);
      return true;
    } catch (err) {
      console.error('Exception ensuring pipeline:', err);
      return false;
    } finally {
      setEnsuring(false);
    }
  }, [orgId, clerkUserId]);

  // Fetch pipelines using RPC (bypasses RLS for Clerk)
  const fetchPipelines = useCallback(async () => {
    if (!orgId) return;

    try {
      const { data, error } = await supabase.rpc('get_org_pipelines', {
        p_org_id: orgId,
      });

      if (error) throw error;

      let pipelineList = (data || []) as Pipeline[];

      // If no pipelines, ensure default and re-fetch
      if (pipelineList.length === 0) {
        const ensured = await ensureDefaultPipeline();
        if (ensured) {
          const { data: refreshed, error: refreshError } = await supabase.rpc('get_org_pipelines', {
            p_org_id: orgId,
          });
          if (!refreshError) pipelineList = (refreshed || []) as Pipeline[];
        }
      }

      setPipelines(pipelineList);

      // Auto-select: user preference → org default → first
      if (pipelineList.length > 0) {
        const savedId = localStorage.getItem(prefKey(clerkUserId, orgId));
        const preferred = savedId ? pipelineList.find(p => p.id === savedId) : null;
        const defaultPipeline = preferred || pipelineList.find(p => p.is_default) || pipelineList[0];
        setSelectedPipeline(defaultPipeline);
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao carregar pipelines",
        variant: "destructive",
      });
      console.error('Error fetching pipelines:', error);
    }
  }, [orgId, ensureDefaultPipeline, toast]);

  // Fetch stages using RPC (bypasses RLS for Clerk)
  const fetchStages = useCallback(async (pipelineId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_pipeline_stages', {
        p_pipeline_id: pipelineId,
      });

      if (error) throw error;
      setStages((data || []) as PipelineStage[]);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao carregar estágios",
        variant: "destructive",
      });
      console.error('Error fetching stages:', error);
    }
  }, [toast]);

  // Create pipeline
  const createPipeline = async (pipelineData: {
    name: string;
    description?: string;
  }) => {
    if (!orgId) {
      toast({ title: "Erro", description: "Informações de usuário não encontradas", variant: "destructive" });
      return false;
    }

    if (pipelines.length >= 10) {
      toast({ title: "Limite atingido", description: "Você pode criar no máximo 10 pipelines", variant: "destructive" });
      return false;
    }

    try {
      // If no pipelines exist yet, use the RPC to seed default pipeline first
      if (pipelines.length === 0) {
        const ensured = await ensureDefaultPipeline();
        if (ensured) {
          await fetchPipelines();
          return true;
        }
        throw new Error('Falha ao criar pipeline padrão');
      }

      const createdBy = profile?.id || clerkUserId || '';
      if (!createdBy) {
        toast({ title: "Erro", description: "Informações de usuário não encontradas", variant: "destructive" });
        return false;
      }

      const { error } = await supabase.rpc('create_pipeline', {
          p_name: pipelineData.name,
          p_description: pipelineData.description || null,
          p_org_id: orgId,
          p_created_by: createdBy,
        });

      if (error) throw error;

      toast({ title: "Sucesso", description: "Pipeline criado com sucesso" });
      await fetchPipelines();
      return true;
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao criar pipeline", variant: "destructive" });
      console.error('Error creating pipeline:', error);
      return false;
    }
  };

  // Update pipeline
  const updatePipeline = async (pipelineId: string, pipelineData: { name: string; description?: string }) => {
    try {
      const { error } = await supabase.from('pipelines').update(pipelineData).eq('id', pipelineId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Pipeline atualizado com sucesso" });
      await fetchPipelines();
      return true;
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao atualizar pipeline", variant: "destructive" });
      return false;
    }
  };

  // Delete pipeline (soft delete) — cascata: desativa estágios + pipeline via RPC seguro
  const deletePipeline = async (pipelineId: string) => {
    if (pipelines.length <= 1) {
      toast({ title: "Erro", description: "Você deve manter pelo menos um pipeline", variant: "destructive" });
      return false;
    }

    if (!clerkUserId) {
      toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
      return false;
    }

    try {
      const { error } = await supabase.rpc('delete_pipeline_rpc', {
        p_clerk_user_id: clerkUserId,
        p_pipeline_id: pipelineId,
      });
      if (error) throw error;

      toast({ title: "Sucesso", description: "Pipeline e estágios excluídos com sucesso" });

      // Limpa seleção se for o pipeline atual
      if (selectedPipeline?.id === pipelineId) {
        setSelectedPipeline(null);
      }
      await fetchPipelines();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir pipeline",
        variant: "destructive",
      });
      console.error('Error deleting pipeline:', error);
      return false;
    }
  };

  // Create stage
  const createStage = async (stageData: { name: string; color: string }) => {
    if (!selectedPipeline) {
      toast({ title: "Erro", description: "Pipeline não selecionado", variant: "destructive" });
      return false;
    }

    try {
      const createdBy = profile?.id || clerkUserId || null;
      const { error } = await supabase.rpc('create_pipeline_stage', {
        p_pipeline_id: selectedPipeline.id,
        p_name: stageData.name,
        p_color: stageData.color,
        p_created_by: createdBy,
      });

      if (error) throw error;
      toast({ title: "Sucesso", description: "Estágio criado com sucesso" });
      await fetchStages(selectedPipeline.id);
      return true;
    } catch (error: any) {
      toast({ title: "Erro", description: `Erro ao criar estágio: ${error.message || 'Erro desconhecido'}`, variant: "destructive" });
      return false;
    }
  };

  // Update stage
  const updateStage = async (stageId: string, stageData: { name: string; color: string }) => {
    try {
      const { error } = await supabase.from('pipeline_stages').update(stageData).eq('id', stageId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Estágio atualizado com sucesso" });
      if (selectedPipeline) await fetchStages(selectedPipeline.id);
      return true;
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao atualizar estágio", variant: "destructive" });
      return false;
    }
  };

  // Delete stage (soft delete)
  const deleteStage = async (stageId: string) => {
    try {
      const { error } = await supabase.from('pipeline_stages').update({ is_active: false }).eq('id', stageId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Estágio removido com sucesso" });
      if (selectedPipeline) await fetchStages(selectedPipeline.id);
      return true;
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao remover estágio", variant: "destructive" });
      return false;
    }
  };

  // Update stage positions
  const updateStagePositions = async (updatedStages: PipelineStage[]) => {
    if (!selectedPipeline) return;
    
    try {
      const stagesWithNewPositions = updatedStages.map((stage, index) => ({
        ...stage,
        position: index + 1
      }));
      setStages(stagesWithNewPositions);

      // Use temporary high positions first to avoid constraint violations
      for (let i = 0; i < stagesWithNewPositions.length; i++) {
        const { error } = await supabase
          .from('pipeline_stages')
          .update({ position: 1000 + i })
          .eq('id', stagesWithNewPositions[i].id);
        if (error) throw error;
      }

      // Then set final positions
      for (let i = 0; i < stagesWithNewPositions.length; i++) {
        const { error } = await supabase
          .from('pipeline_stages')
          .update({ position: i + 1 })
          .eq('id', stagesWithNewPositions[i].id);
        if (error) throw error;
      }

      toast({ title: "Sucesso", description: "Ordem dos estágios atualizada" });
    } catch (error: any) {
      toast({ title: "Erro", description: `Erro ao reordenar estágios: ${error.message}`, variant: "destructive" });
      await fetchStages(selectedPipeline.id);
    }
  };

  useEffect(() => {
    if (orgId) {
      fetchPipelines().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [orgId, clerkUserId, fetchPipelines]);

  useEffect(() => {
    if (selectedPipeline) {
      fetchStages(selectedPipeline.id);
    } else {
      setStages([]);
    }
  }, [selectedPipeline, fetchStages]);

  return {
    pipelines,
    selectedPipeline,
    setSelectedPipeline,
    selectPipeline,
    preferredPipelineId,
    setPreferredPipeline,
    stages,
    loading,
    ensuring,
    createPipeline,
    updatePipeline,
    deletePipeline,
    createStage,
    updateStage,
    deleteStage,
    updateStagePositions,
    refreshPipelines: fetchPipelines,
  };
}
