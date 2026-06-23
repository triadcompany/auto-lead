/**
 * API client — substitui supabase-js para chamadas HTTP.
 * Use o hook useApi() para obter uma instância autenticada.
 */

function resolveBaseUrl(): string {
  const env = import.meta.env.VITE_API_URL as string
  if (env) return env
  // Runtime fallback: deriva a URL da API a partir do hostname do frontend
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:3000'
    return `${protocol}//${hostname.replace('-web.', '-api.')}`
  }
  return 'http://localhost:3000'
}

const BASE_URL = resolveBaseUrl()

export type ApiError = { status: number; message: string }

async function request<T>(
  getToken: () => Promise<string | null>,
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const token = await getToken()

  const url = new URL(`${BASE_URL}${path}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw { status: res.status, message: err.error || res.statusText } as ApiError
  }

  // 204 No Content
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function createApi(getToken: () => Promise<string | null>) {
  const get = <T>(path: string, query?: Record<string, string | number | boolean | undefined>) =>
    request<T>(getToken, "GET", path, undefined, query)

  const post = <T>(path: string, body?: unknown) =>
    request<T>(getToken, "POST", path, body)

  const patch = <T>(path: string, body?: unknown) =>
    request<T>(getToken, "PATCH", path, body)

  const del = <T>(path: string) =>
    request<T>(getToken, "DELETE", path)

  return {
    // ── Health ──────────────────────────────────────────────────────────────
    health: () => get<{ status: string }>("/health"),

    // ── Auth ────────────────────────────────────────────────────────────────
    auth: {
      sync: (data: { email: string; name: string; avatar_url?: string }) =>
        post<any>("/auth/sync", data),
    },

    // ── Users ───────────────────────────────────────────────────────────────
    users: {
      list: () => get<any[]>("/users"),
      me: () => get<any>("/users/me"),
      sync: (data: { clerk_user_id: string; email: string; name: string; avatar_url?: string; organization_id?: string }) =>
        post<any>("/users/sync", data),
      updateProfile: (id: string, data: { name?: string; whatsapp_e164?: string; avatar_url?: string }) =>
        patch(`/users/${id}/profile`, data),
      updateRole: (id: string, role: "admin" | "seller") =>
        patch(`/users/${id}/role`, { role }),
      delete: (id: string) => del(`/users/${id}`),
      invite: (data: { email: string; role: string; name?: string }) =>
        post<any>("/users/invite", data),
      validateInvitation: (token: string) =>
        get<any>(`/users/invitations/${token}/validate`),
      acceptInvitation: (token: string, clerk_user_id: string) =>
        post<any>(`/users/invitations/${token}/accept`, { clerk_user_id }),
    },

    // ── Organizations ────────────────────────────────────────────────────────
    organizations: {
      me: () => get<any>("/organizations/me"),
      bootstrap: (data: { clerk_org_id: string; clerk_user_id: string; org_name: string; user_name: string; email: string }) =>
        post<any>("/organizations/bootstrap", data),
      update: (id: string, data: Record<string, unknown>) =>
        patch(`/organizations/${id}`, data),
      updateSettings: (id: string, data: Record<string, unknown>) =>
        patch(`/organizations/${id}/settings`, data),
    },

    // ── Pipelines ────────────────────────────────────────────────────────────
    pipelines: {
      list: () => get<any[]>("/pipelines"),
      ensureDefault: () => post<any>("/pipelines/ensure-default"),
      get: (id: string) => get<any>(`/pipelines/${id}`),
      create: (data: Record<string, unknown>) => post<any>("/pipelines", data),
      update: (id: string, data: Record<string, unknown>) => patch(`/pipelines/${id}`, data),
      delete: (id: string) => del(`/pipelines/${id}`),
      stages: (id: string) => get<any[]>(`/pipelines/${id}/stages`),
      createStage: (id: string, data: Record<string, unknown>) => post<any>(`/pipelines/${id}/stages`, data),
      updateStage: (id: string, stageId: string, data: Record<string, unknown>) => patch(`/pipelines/${id}/stages/${stageId}`, data),
      deleteStage: (id: string, stageId: string) => del(`/pipelines/${id}/stages/${stageId}`),
      permissions: (id: string) => get<string[]>(`/pipelines/${id}/permissions`),
      setPermissions: (id: string, profile_ids: string[]) =>
        request<{ success: boolean }>(getToken, "PUT", `/pipelines/${id}/permissions`, { profile_ids }),
    },

    // ── Leads ────────────────────────────────────────────────────────────────
    leads: {
      list: (q?: { pipeline_id?: string; stage_id?: string; seller_id?: string; search?: string; limit?: number; offset?: number }) =>
        get<any[]>("/leads", q as any),
      get: (id: string) => get<any>(`/leads/${id}`),
      create: (data: Record<string, unknown>) => post<any>("/leads", data),
      update: (id: string, data: Record<string, unknown>) => patch(`/leads/${id}`, data),
      delete: (id: string) => del(`/leads/${id}`),
      moveStage: (id: string, stageId: string) =>
        patch<any>(`/leads/${id}/stage`, { stage_id: stageId }),
      updateStatus: (id: string, status: string) =>
        patch<any>(`/leads/${id}/status`, { status }),
      updateSaleValue: (id: string, value: number) =>
        patch<any>(`/leads/${id}/sale-value`, { valor_negocio: value }),
      resetFirstTouch: (id: string) =>
        post<any>(`/leads/${id}/reset-first-touch`),
    },

    // ── Tasks ────────────────────────────────────────────────────────────────
    tasks: {
      list: (q?: { lead_id?: string; assigned_to?: string; status?: string; priority?: string }) =>
        get<any[]>("/tasks", q as any),
      get: (id: string) => get<any>(`/tasks/${id}`),
      create: (data: Record<string, unknown>) => post<any>("/tasks", data),
      update: (id: string, data: Record<string, unknown>) => patch(`/tasks/${id}`, data),
      delete: (id: string) => del(`/tasks/${id}`),
    },

    // ── Conversations ────────────────────────────────────────────────────────
    conversations: {
      list: (q?: { status?: string; assigned_to?: string; channel?: string; search?: string; limit?: number }) =>
        get<any[]>("/conversations", q as any),
      get: (id: string) => get<any>(`/conversations/${id}`),
      update: (id: string, data: Record<string, unknown>) => patch(`/conversations/${id}`, data),
      messages: (id: string, q?: { limit?: number; before?: string }) =>
        get<any[]>(`/conversations/${id}/messages`, q as any),
      sendMessage: (id: string, body: string, message_type?: string) =>
        post<any>(`/conversations/${id}/messages`, { body, message_type }),
      audioProxyUrl: (convId: string, msgId: string) =>
        `${BASE_URL}/conversations/${convId}/messages/${msgId}/audio`,
      addNote: (id: string, content: string) =>
        post<any>(`/conversations/${id}/notes`, { content }),
      markRead: (id: string) => post<any>(`/conversations/${id}/read`),
      transfer: (id: string, to_user_id: string, reason?: string) =>
        post<any>(`/conversations/${id}/transfer`, { to_user_id, reason }),
    },

    // ── AI ───────────────────────────────────────────────────────────────────
    ai: {
      reply: (conversation_id: string, send?: boolean) =>
        post<any>("/ai/reply", { conversation_id, send }),
      analyze: (conversation_id: string) =>
        post<any>("/ai/analyze", { conversation_id }),
      setMode: (conversation_id: string, mode: "off" | "auto" | "supervised") =>
        post<any>("/ai/mode", { conversation_id, mode }),
    },

    // ── WhatsApp ─────────────────────────────────────────────────────────────
    whatsapp: {
      me: () => get<any>("/whatsapp/me"),
      meConnect: () => post<any>("/whatsapp/me/connect", {}),
      meDisconnect: () => del("/whatsapp/me/disconnect"),
      meUpdate: (data: { mirror_enabled?: boolean }) => patch<any>("/whatsapp/me", data),
      status: (instance: string) => get<any>(`/whatsapp/status/${instance}`),
      qr: (instance: string) => get<any>(`/whatsapp/qr/${instance}`),
      connect: (instance_name: string) => post<any>("/whatsapp/connect", { instance_name }),
      disconnect: (instance: string) => del(`/whatsapp/disconnect/${instance}`),
      send: (instance: string, phone: string, message: string) =>
        post<any>("/whatsapp/send", { instance, phone, message }),
      sendAudio: (conversation_id: string, audio_base64: string, mime_type: string) =>
        post<any>("/whatsapp/send-audio", { conversation_id, audio_base64, mime_type }),
    },

    // ── Meta ─────────────────────────────────────────────────────────────────
    meta: {
      graph: (action: string, params?: Record<string, string>) =>
        get<any>("/meta/graph", { action, ...params }),
      integrations: () => get<any[]>("/meta/integrations"),
      createIntegration: (data: Record<string, unknown>) =>
        post<any>("/meta/integrations", data),
      updateIntegration: (id: string, data: Record<string, unknown>) =>
        patch(`/meta/integrations/${id}`, data),
      deleteIntegration: (id: string) => del(`/meta/integrations/${id}`),
      sendEvent: (data: { lead_id: string; event_name: string; stage_name?: string }) =>
        post<any>("/meta/events", data),
    },

    // ── Automations ──────────────────────────────────────────────────────────
    automations: {
      list: () => get<any[]>("/automations"),
      get: (id: string) => get<any>(`/automations/${id}`),
      create: (data: { name: string; description?: string; channel?: string }) =>
        post<any>("/automations", data),
      update: (id: string, data: Record<string, unknown>) => patch(`/automations/${id}`, data),
      delete: (id: string) => del(`/automations/${id}`),
      duplicate: (id: string) => post<any>(`/automations/${id}/duplicate`),
      getFlow: (id: string) => get<any>(`/automations/${id}/flow`),
      saveFlow: (id: string, nodes: unknown[], edges: unknown[]) =>
        post<any>(`/automations/${id}/flow`, { nodes, edges }),
      runs: (id: string) => get<any[]>(`/automations/${id}/runs`),
      stats: (id: string) => get<any>(`/automations/${id}/stats`),
      createFromTemplate: (template: string, extra?: Record<string, unknown>) =>
        post<any>("/automations/templates", { template, ...extra }),
      trigger: (id: string, lead_id: string) =>
        post<any>(`/automations/${id}/trigger`, { lead_id }),
    },

    // ── Followups ────────────────────────────────────────────────────────────
    followups: {
      list: (q?: { lead_id?: string; status?: string }) => get<any[]>("/followups", q as any),
      create: (data: Record<string, unknown>) => post<any>("/followups", data),
      update: (id: string, data: Record<string, unknown>) => patch(`/followups/${id}`, data),
      delete: (id: string) => del(`/followups/${id}`),
    },

    // ── Broadcasts ───────────────────────────────────────────────────────────
    broadcasts: {
      list: (q?: { status?: string }) => get<any[]>("/broadcasts", q as any),
      get: (id: string) => get<any>(`/broadcasts/${id}`),
      create: (data: Record<string, unknown>) => post<any>("/broadcasts", data),
      update: (id: string, data: Record<string, unknown>) => patch(`/broadcasts/${id}`, data),
      delete: (id: string) => del(`/broadcasts/${id}`),
      addRecipients: (id: string, recipients: any[]) =>
        post<any>(`/broadcasts/${id}/recipients`, { recipients }),
      listRecipients: (id: string) => get<any[]>(`/broadcasts/${id}/recipients`),
      start: (id: string) => post<any>(`/broadcasts/${id}/start`),
      pause: (id: string) => post<any>(`/broadcasts/${id}/pause`),
    },

    // ── Billing ──────────────────────────────────────────────────────────────
    billing: {
      subscription: () => get<any>("/billing/subscription"),
      checkout: (data: { plan: string; billing_cycle: string; price_id: string }) =>
        post<any>("/billing/checkout", data),
      sync: (session_id: string) => post<any>("/billing/sync", { session_id }),
      portal: (return_url?: string) => post<any>("/billing/portal", { return_url }),
    },

    // ── Misc ─────────────────────────────────────────────────────────────────
    cnpj: (cnpj: string) => get<any>(`/cnpj/${cnpj}`),
    vehicles: {
      list: (q?: { status?: string }) => get<any[]>("/vehicles", q as any),
      create: (data: Record<string, unknown>) => post<any>("/vehicles", data),
      update: (id: string, data: Record<string, unknown>) => patch(`/vehicles/${id}`, data),
      delete: (id: string) => del(`/vehicles/${id}`),
    },
    leadSources: {
      list: () => get<any[]>("/lead-sources"),
      create: (data: { name: string; sort_order?: number }) => post<any>("/lead-sources", data),
      update: (id: string, data: { name?: string; is_active?: boolean; sort_order?: number }) =>
        patch(`/lead-sources/${id}`, data),
      delete: (id: string) => del(`/lead-sources/${id}`),
    },
    prospects: {
      list: (q?: { status?: string }) => get<any[]>("/prospects", q as any),
      create: (data: Record<string, unknown>) => post<any>("/prospects", data),
    },
  }
}

export type ApiClient = ReturnType<typeof createApi>
