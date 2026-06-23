import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
  color: string | null;
  isActive: boolean;
  pipelineId: string;
  createdAt: string;
  updatedAt: string;
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
  const api = useApi();

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

  const selectPipeline = useCallback((pipeline: Pipeline | null) => {
    setSelectedPipeline(pipeline);
    if (pipeline && clerkUserId && orgId) {
      localStorage.setItem(prefKey(clerkUserId, orgId), pipeline.id);
      setPreferredPipelineIdState(pipeline.id);
    }
  }, [clerkUserId, orgId]);

  const ensureDefaultPipeline = useCallback(async () => {
    if (!orgId) return false;
    setEnsuring(true);
    try {
      await api.pipelines.ensureDefault();
      return true;
    } catch (err) {
      console.error('Error ensuring pipeline:', err);
      return false;
    } finally {
      setEnsuring(false);
    }
  }, [orgId, api]);

  const fetchPipelines = useCallback(async () => {
    if (!orgId) return;
    try {
      let pipelineList = await api.pipelines.list() as Pipeline[];

      if (pipelineList.length === 0) {
        const ensured = await ensureDefaultPipeline();
        if (ensured) pipelineList = await api.pipelines.list() as Pipeline[];
      }

      setPipelines(pipelineList);

      if (pipelineList.length > 0) {
        const savedId = localStorage.getItem(prefKey(clerkUserId, orgId));
        const preferred = savedId ? pipelineList.find(p => p.id === savedId) : null;
        const defaultPipeline = preferred || pipelineList.find(p => p.isDefault) || pipelineList[0];
        setSelectedPipeline(defaultPipeline);
      }
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao carregar pipelines", variant: "destructive" });
      console.error('Error fetching pipelines:', error);
    }
  }, [orgId, ensureDefaultPipeline, clerkUserId, toast, api]);

  const fetchStages = useCallback(async (pipelineId: string) => {
    try {
      const data = await api.pipelines.stages(pipelineId) as PipelineStage[];
      setStages(data);
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao carregar estágios", variant: "destructive" });
    }
  }, [toast, api]);

  const createPipeline = async (pipelineData: { name: string; description?: string }) => {
    if (!orgId) {
      toast({ title: "Erro", description: "Informações de usuário não encontradas", variant: "destructive" });
      return false;
    }
    if (pipelines.length >= 10) {
      toast({ title: "Limite atingido", description: "Você pode criar no máximo 10 pipelines", variant: "destructive" });
      return false;
    }
    try {
      await api.pipelines.create({ name: pipelineData.name });
      toast({ title: "Sucesso", description: "Pipeline criado com sucesso" });
      await fetchPipelines();
      return true;
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao criar pipeline", variant: "destructive" });
      return false;
    }
  };

  const updatePipeline = async (pipelineId: string, pipelineData: { name: string; description?: string }) => {
    try {
      await api.pipelines.update(pipelineId, { name: pipelineData.name });
      toast({ title: "Sucesso", description: "Pipeline atualizado com sucesso" });
      await fetchPipelines();
      return true;
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao atualizar pipeline", variant: "destructive" });
      return false;
    }
  };

  const deletePipeline = async (pipelineId: string) => {
    if (pipelines.length <= 1) {
      toast({ title: "Erro", description: "Você deve manter pelo menos um pipeline", variant: "destructive" });
      return false;
    }
    try {
      await api.pipelines.delete(pipelineId);
      toast({ title: "Sucesso", description: "Pipeline excluído com sucesso" });
      if (selectedPipeline?.id === pipelineId) setSelectedPipeline(null);
      await fetchPipelines();
      return true;
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Erro ao excluir pipeline", variant: "destructive" });
      return false;
    }
  };

  const createStage = async (stageData: { name: string; color: string }) => {
    if (!selectedPipeline) {
      toast({ title: "Erro", description: "Pipeline não selecionado", variant: "destructive" });
      return false;
    }
    try {
      const nextPosition = stages.length > 0 ? Math.max(...stages.map(s => s.position)) + 1 : 0;
      await api.pipelines.createStage(selectedPipeline.id, {
        name: stageData.name,
        color: stageData.color,
        position: nextPosition,
      });
      toast({ title: "Sucesso", description: "Estágio criado com sucesso" });
      await fetchStages(selectedPipeline.id);
      return true;
    } catch (error: any) {
      toast({ title: "Erro", description: `Erro ao criar estágio: ${error.message || 'Erro desconhecido'}`, variant: "destructive" });
      return false;
    }
  };

  const updateStage = async (stageId: string, stageData: { name: string; color: string }) => {
    if (!selectedPipeline) return false;
    try {
      await api.pipelines.updateStage(selectedPipeline.id, stageId, stageData);
      toast({ title: "Sucesso", description: "Estágio atualizado com sucesso" });
      await fetchStages(selectedPipeline.id);
      return true;
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao atualizar estágio", variant: "destructive" });
      return false;
    }
  };

  const deleteStage = async (stageId: string) => {
    if (!selectedPipeline) return false;
    try {
      await api.pipelines.deleteStage(selectedPipeline.id, stageId);
      toast({ title: "Sucesso", description: "Estágio removido com sucesso" });
      await fetchStages(selectedPipeline.id);
      return true;
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao remover estágio", variant: "destructive" });
      return false;
    }
  };

  const updateStagePositions = async (updatedStages: PipelineStage[]) => {
    if (!selectedPipeline) return;
    const reordered = updatedStages.map((stage, index) => ({ ...stage, position: index + 1 }));
    setStages(reordered);
    try {
      await Promise.all(
        reordered.map(s =>
          api.pipelines.updateStage(selectedPipeline.id, s.id, { position: s.position })
        )
      );
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
