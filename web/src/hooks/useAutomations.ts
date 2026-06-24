import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Edge, Node } from "@xyflow/react";
import { useApi } from "@/hooks/useApi";

export interface Automation {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  channel: string;
  is_active: boolean;
  is_system: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationFlow {
  id: string;
  organization_id: string;
  automation_id: string;
  nodes: Node[];
  edges: Edge[];
  entry_node_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: string;
  organization_id: string;
  automation_id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  current_node_id: string | null;
  context: Record<string, unknown> | null;
  last_error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface RunStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
  waiting: number;
}

export function useAutomations() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const { orgId } = useAuth();
  const { toast } = useToast();
  const api = useApi();

  const fetchAutomations = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await api.automations.list() as any[];
      setAutomations(data.map(a => ({
        id: a.id,
        organization_id: a.organizationId || a.organization_id || '',
        name: a.name,
        description: a.description || null,
        channel: a.channel || 'whatsapp',
        is_active: a.isActive ?? a.is_active ?? false,
        is_system: a.isSystem ?? a.is_system ?? false,
        created_by: a.createdBy || a.created_by || '',
        created_at: a.createdAt || a.created_at || '',
        updated_at: a.updatedAt || a.updated_at || '',
      })));
    } catch (err) {
      console.error('Error fetching automations:', err);
      toast({ title: "Erro", description: "Erro ao carregar automações", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [orgId, api, toast]);

  useEffect(() => { fetchAutomations(); }, [fetchAutomations]);

  const createAutomation = async (data: { name: string; description?: string; channel?: string }) => {
    try {
      const result = await api.automations.create(data) as any;
      await fetchAutomations();
      return result;
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao criar automação", variant: "destructive" });
      return null;
    }
  };

  const updateAutomation = async (id: string, data: Record<string, unknown>) => {
    try {
      await api.automations.update(id, data);
      await fetchAutomations();
      return true;
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao atualizar automação", variant: "destructive" });
      return false;
    }
  };

  const deleteAutomation = async (id: string) => {
    try {
      await api.automations.delete(id);
      setAutomations(prev => prev.filter(a => a.id !== id));
      toast({ title: "Sucesso", description: "Automação excluída" });
      return true;
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao excluir automação", variant: "destructive" });
      return false;
    }
  };

  const duplicateAutomation = async (id: string) => {
    try {
      const result = await api.automations.duplicate(id) as any;
      await fetchAutomations();
      return result;
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao duplicar automação", variant: "destructive" });
      return null;
    }
  };

  const getAutomationFlow = async (id: string): Promise<AutomationFlow | null> => {
    try {
      return await api.automations.getFlow(id) as AutomationFlow;
    } catch {
      return null;
    }
  };

  const saveAutomationFlow = async (id: string, nodes: Node[], edges: Edge[]): Promise<AutomationFlow | null> => {
    try {
      const flow = await api.automations.saveFlow(id, nodes, edges) as AutomationFlow;
      toast({ title: "Sucesso", description: "Fluxo salvo" });
      return flow;
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao salvar fluxo", variant: "destructive" });
      return null;
    }
  };

  const getAutomationRuns = async (id: string): Promise<AutomationRun[]> => {
    try {
      return await api.automations.runs(id) as AutomationRun[];
    } catch {
      return [];
    }
  };

  const getRunStats = async (id?: string): Promise<RunStats> => {
    try {
      return await api.automations.stats(id) as RunStats;
    } catch {
      return { total: 0, running: 0, completed: 0, failed: 0, waiting: 0 };
    }
  };

  const triggerAutomation = async (id: string, leadId: string) => {
    try {
      await api.automations.trigger(id, leadId);
      toast({ title: "Sucesso", description: "Automação disparada" });
      return true;
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao disparar automação", variant: "destructive" });
      return false;
    }
  };

  const createFromTemplate = async (template: string, extra?: Record<string, unknown>) => {
    try {
      const result = await api.automations.createFromTemplate(template, extra) as any;
      await fetchAutomations();
      return result;
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao criar do template", variant: "destructive" });
      return null;
    }
  };

  const toggleActive = async (id: string, currentIsActive: boolean) => {
    return updateAutomation(id, { isActive: !currentIsActive });
  };

  const listLogs = async (_id: string) => [];

  return {
    automations,
    loading,
    fetchAutomations,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    duplicateAutomation,
    toggleActive,
    // canonical names
    getAutomationFlow,
    saveAutomationFlow,
    getAutomationRuns,
    getRunStats,
    triggerAutomation,
    createFromTemplate,
    // aliases expected by Automacoes.tsx
    getFlow: getAutomationFlow,
    saveFlow: saveAutomationFlow,
    listRuns: getAutomationRuns,
    listLogs,
    triggerWorker: triggerAutomation,
  };
}
