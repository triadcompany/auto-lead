import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/hooks/useApi";
import {
  provisionMetaIntegration,
  deprovisionMetaIntegration,
  setWorkflowActive,
} from "@/services/n8nMetaProvisioning";

export interface MetaIntegration {
  id: string;
  campaign_name: string;
  meta_page_id: string;
  meta_page_name: string | null;
  meta_form_id: string;
  meta_form_name: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  seller_id: string | null;
  field_mapping: Record<string, string>;
  status: "inactive" | "active" | "error" | "provisioning";
  last_lead_at: string | null;
  error_message: string | null;
  n8n_workflow_id: string | null;
  n8n_credential_id: string | null;
}

export interface CreateIntegrationData {
  metaAccountId: string;
  campaignName: string;
  metaPageId: string;
  metaPageName: string;
  metaFormId: string;
  metaFormName: string;
  pipelineId: string;
  stageId: string;
  sellerId: string | null;
  fieldMapping: Record<string, string>;
}

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
}

export interface MetaForm {
  id: string;
  name: string;
  status: string;
}

export interface MetaFormField {
  key: string;
  label: string;
  type: string;
}

function normalize(i: any): MetaIntegration {
  return {
    id: i.id,
    campaign_name: i.campaignName || i.campaign_name || '',
    meta_page_id: i.metaPageId || i.meta_page_id || '',
    meta_page_name: i.metaPageName || i.meta_page_name || null,
    meta_form_id: i.metaFormId || i.meta_form_id || '',
    meta_form_name: i.metaFormName || i.meta_form_name || null,
    pipeline_id: i.pipelineId || i.pipeline_id || null,
    stage_id: i.stageId || i.stage_id || null,
    seller_id: i.sellerId || i.seller_id || null,
    field_mapping: i.fieldMapping || i.field_mapping || {},
    status: i.status || 'inactive',
    last_lead_at: i.lastLeadAt || i.last_lead_at || null,
    error_message: i.errorMessage || i.error_message || null,
    n8n_workflow_id: i.n8nWorkflowId || i.n8n_workflow_id || null,
    n8n_credential_id: i.n8nCredentialId || i.n8n_credential_id || null,
  };
}

export function useMetaIntegrations() {
  const { orgId } = useAuth();
  const { toast } = useToast();
  const api = useApi();
  const [integrations, setIntegrations] = useState<MetaIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    try {
      const data = await api.meta.integrations() as any[];
      setIntegrations(data.map(normalize));
    } catch (err) {
      console.error('Error fetching meta integrations:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId, api]);

  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  const fetchPages = useCallback(async (): Promise<MetaPage[]> => {
    try {
      const data = await api.meta.graph('pages') as any;
      return (data?.data || data || []) as MetaPage[];
    } catch {
      return [];
    }
  }, [api]);

  const fetchForms = useCallback(async (pageId: string): Promise<MetaForm[]> => {
    try {
      const data = await api.meta.graph('forms', { page_id: pageId }) as any;
      return (data?.data || data || []) as MetaForm[];
    } catch {
      return [];
    }
  }, [api]);

  const fetchFormFields = useCallback(async (formId: string): Promise<MetaFormField[]> => {
    try {
      const data = await api.meta.graph('form_fields', { form_id: formId }) as any;
      return (data?.data || data || []) as MetaFormField[];
    } catch {
      return [];
    }
  }, [api]);

  const createIntegration = useCallback(async (data: CreateIntegrationData): Promise<boolean> => {
    if (!orgId) return false;
    try {
      const created = await api.meta.createIntegration({
        campaign_name: data.campaignName,
        meta_page_id: data.metaPageId,
        meta_page_name: data.metaPageName,
        meta_form_id: data.metaFormId,
        meta_form_name: data.metaFormName,
        pipeline_id: data.pipelineId,
        stage_id: data.stageId,
        seller_id: data.sellerId,
        field_mapping: data.fieldMapping,
        status: 'provisioning',
      }) as any;

      try {
        const result = await provisionMetaIntegration({
          integrationId: created.id,
          organizationId: orgId,
          metaAccountId: data.metaAccountId,
          metaPageId: data.metaPageId,
          metaFormId: data.metaFormId,
          fieldMapping: data.fieldMapping,
          pipelineId: data.pipelineId,
          stageId: data.stageId,
          sellerId: data.sellerId,
        });

        await api.meta.updateIntegration(created.id, {
          status: 'active',
          n8n_workflow_id: result.workflowId,
          n8n_credential_id: result.credentialId,
        });
      } catch (provisionErr: any) {
        await api.meta.updateIntegration(created.id, {
          status: 'error',
          error_message: provisionErr.message || 'Erro ao provisionar',
        });
        toast({ title: 'Aviso', description: 'Integração criada mas falhou ao ativar n8n. Verifique os logs.', variant: 'destructive' });
      }

      await fetchIntegrations();
      toast({ title: 'Sucesso', description: 'Integração Meta criada com sucesso' });
      return true;
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Erro ao criar integração', variant: 'destructive' });
      return false;
    }
  }, [orgId, api, fetchIntegrations, toast]);

  const toggleIntegration = useCallback(async (id: string, active: boolean): Promise<boolean> => {
    const integration = integrations.find(i => i.id === id);
    if (!integration?.n8n_workflow_id) return false;
    try {
      await setWorkflowActive(integration.n8n_workflow_id, active);
      await api.meta.updateIntegration(id, { status: active ? 'active' : 'inactive' });
      await fetchIntegrations();
      toast({ title: 'Sucesso', description: active ? 'Integração ativada' : 'Integração desativada' });
      return true;
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Erro ao alterar status', variant: 'destructive' });
      return false;
    }
  }, [integrations, api, fetchIntegrations, toast]);

  const deleteIntegration = useCallback(async (id: string): Promise<boolean> => {
    const integration = integrations.find(i => i.id === id);
    try {
      if (integration?.n8n_workflow_id) {
        await deprovisionMetaIntegration(integration.n8n_workflow_id, integration.n8n_credential_id || '');
      }
      await api.meta.deleteIntegration(id);
      await fetchIntegrations();
      toast({ title: 'Sucesso', description: 'Integração removida' });
      return true;
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Erro ao remover integração', variant: 'destructive' });
      return false;
    }
  }, [integrations, api, fetchIntegrations, toast]);

  return { integrations, loading, fetchIntegrations, fetchPages, fetchForms, fetchFormFields, createIntegration, toggleIntegration, deleteIntegration };
}
