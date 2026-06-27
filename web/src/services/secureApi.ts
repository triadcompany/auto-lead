const API_URL = (import.meta.env.VITE_API_URL as string) || '';

async function callApi<T = any>(
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  return callApi("/leads/sale-value", { lead_id: leadId, new_value: newValue });
}

export async function changeLeadStatus(leadId: string, newStageId: string) {
  return callApi("/leads/change-stage", { lead_id: leadId, new_stage_id: newStageId });
}

export async function saveAutomationFlow(
  automationId: string,
  nodes: unknown[],
  edges: unknown[]
) {
  return callApi(`/automations/${automationId}/flow`, {
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
  return callApi("/settings/sensitive", {
    table,
    updates,
    record_id: recordId || null,
  });
}
