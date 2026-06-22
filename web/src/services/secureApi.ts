import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function callEdgeFunction<T = any>(
  fnName: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: json.error || `HTTP ${res.status}` };
    }
    return { ok: true, data: json };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function updateSaleValue(leadId: string, newValue: number) {
  return callEdgeFunction("update-sale-value", { lead_id: leadId, new_value: newValue });
}

export async function changeLeadStatus(leadId: string, newStageId: string) {
  return callEdgeFunction("change-lead-status", { lead_id: leadId, new_stage_id: newStageId });
}

export async function saveAutomationFlow(
  automationId: string,
  nodes: unknown[],
  edges: unknown[]
) {
  return callEdgeFunction("save-automation", {
    automation_id: automationId,
    nodes,
    edges,
  });
}

export async function updateSensitiveSettings(
  table: string,
  updates: Record<string, unknown>,
  recordId?: string
) {
  return callEdgeFunction("update-sensitive-settings", {
    table,
    updates,
    record_id: recordId || null,
  });
}
