import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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

const GRAPH_PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-graph-proxy`;

export function useMetaIntegrations() {
  const [integrations, setIntegrations] = useState<MetaIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile, orgId } = useAuth();
  const { toast } = useToast();

  const organizationId = profile?.organization_id || orgId;

  const fetchIntegrations = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("meta_integrations")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setIntegrations((data || []) as MetaIntegration[]);
    } catch (err) {
      console.error("[useMetaIntegrations] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  async function fetchPages(orgId: string): Promise<MetaPage[]> {
    const res = await fetch(`${GRAPH_PROXY}?action=pages&org_id=${orgId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.pages || [];
  }

  async function fetchForms(orgId: string, pageId: string): Promise<MetaForm[]> {
    const res = await fetch(`${GRAPH_PROXY}?action=forms&org_id=${orgId}&page_id=${pageId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.forms || [];
  }

  async function fetchFormFields(orgId: string, formId: string): Promise<MetaFormField[]> {
    const res = await fetch(`${GRAPH_PROXY}?action=form_fields&org_id=${orgId}&form_id=${formId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.fields || [];
  }

  async function createIntegration(formData: CreateIntegrationData): Promise<void> {
    if (!organizationId) return;

    // Insert with provisioning status
    const { data: inserted, error: insertError } = await supabase
      .from("meta_integrations")
      .insert({
        organization_id: organizationId,
        meta_account_id: formData.metaAccountId,
        campaign_name: formData.campaignName,
        meta_page_id: formData.metaPageId,
        meta_page_name: formData.metaPageName,
        meta_form_id: formData.metaFormId,
        meta_form_name: formData.metaFormName,
        pipeline_id: formData.pipelineId,
        stage_id: formData.stageId,
        seller_id: formData.sellerId,
        field_mapping: formData.fieldMapping,
        status: "provisioning",
      })
      .select()
      .single();

    if (insertError || !inserted) {
      toast({ title: "Erro ao criar integração", variant: "destructive" });
      throw insertError;
    }

    await fetchIntegrations();

    // Get Meta access token
    const { data: account } = await supabase
      .from("meta_accounts")
      .select("access_token")
      .eq("id", formData.metaAccountId)
      .single();

    if (!account) {
      await supabase.from("meta_integrations").update({ status: "error", error_message: "Meta account not found" }).eq("id", inserted.id);
      toast({ title: "Conta Meta não encontrada", variant: "destructive" });
      return;
    }

    try {
      const result = await provisionMetaIntegration({
        orgId: organizationId,
        orgName: profile?.name || organizationId,
        campaignName: formData.campaignName,
        integrationId: inserted.id,
        metaFormId: formData.metaFormId,
        metaAccessToken: account.access_token,
        fieldMapping: formData.fieldMapping,
      });

      await supabase
        .from("meta_integrations")
        .update({
          status: "active",
          n8n_workflow_id: result.workflowId,
          n8n_folder_id: result.folderId,
          n8n_credential_id: result.credentialId,
          error_message: null,
        })
        .eq("id", inserted.id);

      toast({ title: "Integração ativada com sucesso!" });
    } catch (err: any) {
      await supabase
        .from("meta_integrations")
        .update({ status: "error", error_message: err.message })
        .eq("id", inserted.id);

      toast({ title: "Erro ao provisionar N8N", description: err.message, variant: "destructive" });
    }

    await fetchIntegrations();
  }

  async function toggleIntegration(id: string, active: boolean): Promise<void> {
    const integration = integrations.find((i) => i.id === id);
    if (!integration?.n8n_workflow_id || !organizationId) return;

    try {
      await setWorkflowActive(organizationId, integration.n8n_workflow_id, active);
      await supabase
        .from("meta_integrations")
        .update({ status: active ? "active" : "inactive" })
        .eq("id", id);
      await fetchIntegrations();
    } catch (err: any) {
      toast({ title: "Erro ao alterar status", description: err.message, variant: "destructive" });
    }
  }

  async function deleteIntegration(id: string): Promise<void> {
    const integration = integrations.find((i) => i.id === id);
    if (!organizationId) return;

    try {
      if (integration?.n8n_workflow_id && integration?.n8n_credential_id) {
        await deprovisionMetaIntegration(
          organizationId,
          integration.n8n_workflow_id,
          integration.n8n_credential_id
        );
      }
      await supabase.from("meta_integrations").delete().eq("id", id);
      await fetchIntegrations();
      toast({ title: "Integração removida" });
    } catch (err: any) {
      toast({ title: "Erro ao remover integração", description: err.message, variant: "destructive" });
    }
  }

  return {
    integrations,
    loading,
    fetchIntegrations,
    fetchPages,
    fetchForms,
    fetchFormFields,
    createIntegration,
    toggleIntegration,
    deleteIntegration,
  };
}
