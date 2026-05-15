import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Edge, Node } from "@xyflow/react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

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

export interface AutomationLog {
  id: string;
  organization_id: string;
  automation_id: string | null;
  run_id: string | null;
  node_id: string | null;
  level: string;
  message: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface RunStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
  waiting: number;
}

async function apiCall(action: string, params: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? SUPABASE_ANON_KEY;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/automations-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...params }),
  });
  return res.json();
}

export function useAutomations() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile, orgId: authOrgId, user } = useAuth();
  const { toast } = useToast();

  const orgId = profile?.organization_id || authOrgId;

  const fetchAutomations = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await apiCall("list", { organization_id: orgId });
    if (result.ok) {
      setAutomations(result.automations || []);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  const createAutomation = async (name: string, description?: string): Promise<Automation | null> => {
    if (!orgId) {
      toast({ title: "Erro", description: "Organização não encontrada. Verifique suas configurações.", variant: "destructive" });
      return null;
    }
    const createdBy = profile?.id || user?.id;
    if (!createdBy) {
      toast({ title: "Erro", description: "Perfil ainda não carregado. Aguarde e tente novamente.", variant: "destructive" });
      return null;
    }
    const result = await apiCall("create", {
      organization_id: orgId, name, description: description || null,
      created_by: createdBy, channel: "whatsapp",
    });
    if (!result.ok) {
      toast({ title: "Erro ao criar automação", description: result.message, variant: "destructive" });
      return null;
    }
    toast({ title: "Sucesso", description: "Automação criada" });
    fetchAutomations();
    return result.automation;
  };

  const updateAutomation = async (id: string, updates: Partial<Automation>): Promise<boolean> => {
    const result = await apiCall("update", { id, updates, profileId: profile?.id });
    if (!result.ok) {
      toast({ title: "Erro", description: result.message, variant: "destructive" });
      return false;
    }
    fetchAutomations();
    return true;
  };

  const deleteAutomation = async (id: string): Promise<boolean> => {
    const result = await apiCall("delete", { id, profileId: profile?.id });
    if (!result.ok) {
      toast({ title: "Erro", description: result.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Sucesso", description: "Automação excluída" });
    fetchAutomations();
    return true;
  };

  const duplicateAutomation = async (automation: Automation): Promise<Automation | null> => {
    if (!orgId || !(profile?.id || user?.id)) return null;
    const result = await apiCall("duplicate", {
      id: automation.id, organization_id: orgId, created_by: profile?.id || user?.id,
    });
    if (!result.ok) {
      toast({ title: "Erro", description: result.message, variant: "destructive" });
      return null;
    }
    toast({ title: "Sucesso", description: "Automação duplicada" });
    fetchAutomations();
    return result.automation;
  };

  const toggleActive = async (id: string, isActive: boolean): Promise<boolean> => {
    // When activating, validate that the trigger node has at least one connected action
    if (!isActive) {
      const flow = await getFlow(id);
      if (flow) {
        const triggerNode = (flow.nodes || []).find((n: any) => n.type === "trigger");
        if (triggerNode) {
          const hasOutgoing = (flow.edges || []).some((e: any) => e.source === triggerNode.id);
          if (!hasOutgoing) {
            toast({
              title: "Gatilho sem ação",
              description: "Conecte o gatilho a pelo menos uma ação antes de ativar a automação.",
              variant: "destructive",
            });
            return false;
          }
        }
      }
    }
    return updateAutomation(id, { is_active: !isActive });
  };

  // ─── Flow operations ───

  const getFlow = async (automationId: string): Promise<AutomationFlow | null> => {
    const result = await apiCall("get_flow", { automation_id: automationId });
    if (result.ok && result.flow) return result.flow;
    return null;
  };

  const saveFlow = async (automationId: string, nodes: Node[], edges: Edge[]): Promise<AutomationFlow | null> => {
    if (!orgId) return null;
    const triggers = nodes.filter((n) => n.type === "trigger");
    if (triggers.length > 1) {
      toast({ title: "Erro", description: "Só pode haver 1 nó de gatilho por automação.", variant: "destructive" });
      return null;
    }

    // Warn if trigger node exists but has no outgoing edges (automation will never fire)
    if (triggers.length === 1) {
      const triggerId = triggers[0].id;
      const hasOutgoing = edges.some((e) => e.source === triggerId);
      if (!hasOutgoing) {
        toast({
          title: "Aviso: gatilho sem ação",
          description: "O gatilho não está conectado a nenhuma ação. A automação não vai disparar até você conectá-lo.",
          variant: "destructive",
        });
        // Non-blocking: save anyway so user doesn't lose work, but warn clearly
      }
    }

    const result = await apiCall("save_flow", {
      automation_id: automationId, organization_id: orgId, nodes, edges,
    });
    if (!result.ok) {
      toast({ title: "Erro ao salvar fluxo", description: result.message, variant: "destructive" });
      return null;
    }
    toast({ title: "Salvo", description: `Fluxo salvo (versão ${result.flow.version})` });
    return result.flow;
  };

  // ─── Runs & Logs ───

  const listRuns = async (automationId?: string): Promise<AutomationRun[]> => {
    if (!orgId) return [];
    const result = await apiCall("list_runs", {
      organization_id: orgId,
      automation_id: automationId || undefined,
    });
    return result.ok ? result.runs : [];
  };

  const listLogs = async (runId?: string, automationId?: string): Promise<AutomationLog[]> => {
    if (!orgId) return [];
    const result = await apiCall("list_logs", {
      organization_id: orgId,
      run_id: runId || undefined,
      automation_id: automationId || undefined,
    });
    return result.ok ? result.logs : [];
  };

  const getRunStats = async (automationId?: string): Promise<RunStats> => {
    if (!orgId) return { total: 0, running: 0, completed: 0, failed: 0, waiting: 0 };
    const result = await apiCall("run_stats", {
      organization_id: orgId,
      automation_id: automationId || undefined,
    });
    return result.ok ? result.stats : { total: 0, running: 0, completed: 0, failed: 0, waiting: 0 };
  };

  const triggerWorker = async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/automation-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: "Worker executado", description: `${data.processed} job(s) processados, ${data.failed || 0} falha(s)` });
        return true;
      }
      toast({ title: "Erro no worker", description: data.message, variant: "destructive" });
      return false;
    } catch (err) {
      toast({ title: "Erro", description: String(err), variant: "destructive" });
      return false;
    }
  };

  const createFromTemplate = async (templateName?: string, extraParams?: Record<string, unknown>): Promise<Automation | null> => {
    const createdBy = profile?.id || user?.id;
    if (!orgId || !createdBy) {
      toast({ title: "Erro", description: "Usuário ou organização não encontrados", variant: "destructive" });
      return null;
    }
    const action = templateName === "keyword_lead" ? "create_template_keyword_lead" : "create_template";
    const result = await apiCall(action, {
      organization_id: orgId,
      created_by: createdBy,
      template_name: templateName,
      ...extraParams,
    });
    if (!result.ok) {
      toast({ title: "Erro ao criar template", description: result.message, variant: "destructive" });
      return null;
    }
    toast({ title: "Sucesso", description: "Automação template criada" });
    fetchAutomations();
    return result.automation;
  };

  return {
    automations, loading,
    createAutomation, updateAutomation, deleteAutomation, duplicateAutomation, toggleActive,
    getFlow, saveFlow, createFromTemplate,
    listRuns, listLogs, getRunStats, triggerWorker,
    refresh: fetchAutomations,
  };
}
