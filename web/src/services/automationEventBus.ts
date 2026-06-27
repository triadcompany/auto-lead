/**
 * Automation Event Bus - Client-side event publishing utility
 * 
 * This module provides helpers to publish events to the automation_events table.
 * Events are consumed by the event-dispatcher edge function.
 * 
 * IMPORTANT: In Step 3, events are ONLY published when a human explicitly applies
 * an AI suggestion (click "Aplicar etapa"). No automatic publishing.
 */

const _API_URL = import.meta.env.VITE_API_URL as string;

// ── Official event names ──
export const AI_EVENTS = {
  // Active in Step 3 (human-confirmed)
  LEAD_STAGE_CHANGED_BY_AI: 'lead.stage_changed.by_ai',
  LEAD_QUALIFIED_BY_AI: 'lead.qualified.by_ai',
  LEAD_FOLLOWUP_NEEDED_BY_AI: 'lead.followup_needed.by_ai',
  HANDOFF_TO_HUMAN_BY_AI: 'handoff.to_human.by_ai',
  HANDOFF_TO_AI_BY_HUMAN: 'handoff.to_ai.by_human',

  // Inbound messaging events
  INBOUND_FIRST_MESSAGE: 'inbound.first_message',

  // Deal/Lead stage changed (for Meta CAPI etc.)
  DEAL_STAGE_CHANGED: 'deal.stage_changed',

  // Reserved for future steps
  CONVERSATION_AI_SUGGESTED_REPLY: 'conversation.ai_suggested_reply',
  CONVERSATION_AI_MESSAGE_SENT: 'conversation.ai_message_sent',
  LEAD_CREATED_BY_AI: 'lead.created.by_ai',
  LEAD_STAGE_CHANGE_SUGGESTED_BY_AI: 'lead.stage_change_suggested.by_ai',
} as const;

export type AiEventName = typeof AI_EVENTS[keyof typeof AI_EVENTS];

// Event names for UI dropdown
export const AI_EVENT_OPTIONS = [
  { value: AI_EVENTS.LEAD_STAGE_CHANGED_BY_AI, label: 'Lead mudou de etapa (por IA)' },
  { value: AI_EVENTS.LEAD_QUALIFIED_BY_AI, label: 'Lead qualificado (por IA)' },
  { value: AI_EVENTS.LEAD_FOLLOWUP_NEEDED_BY_AI, label: 'Lead precisa follow-up (por IA)' },
  { value: AI_EVENTS.HANDOFF_TO_HUMAN_BY_AI, label: 'Handoff para humano (por IA)' },
  { value: AI_EVENTS.HANDOFF_TO_AI_BY_HUMAN, label: 'Handoff para IA (por humano)' },
  { value: AI_EVENTS.INBOUND_FIRST_MESSAGE, label: 'Primeira mensagem recebida' },
  { value: AI_EVENTS.DEAL_STAGE_CHANGED, label: '📊 Lead mudou de etapa (Kanban)' },
  { value: AI_EVENTS.CONVERSATION_AI_SUGGESTED_REPLY, label: 'IA sugeriu resposta' },
  { value: AI_EVENTS.LEAD_CREATED_BY_AI, label: 'Lead criado (por IA)' },
];

interface PublishEventParams {
  organizationId: string;
  eventName: AiEventName;
  entityType: 'conversation' | 'lead' | 'opportunity';
  entityId?: string;
  conversationId?: string;
  leadId?: string;
  opportunityId?: string;
  payload: Record<string, unknown>;
  source: 'ai' | 'human' | 'system';
  sourceAiInteractionId?: string;
  /** Components for building the idempotency key. Will be joined with ":" */
  idempotencyParts?: string[];
  /** Bearer token for the API call */
  token?: string | null;
}

/**
 * Publish an event to the Event Bus.
 * Uses idempotency keys to prevent duplicate events.
 */
export async function publishAutomationEvent({
  organizationId,
  eventName,
  entityType,
  entityId,
  conversationId,
  leadId,
  opportunityId,
  payload,
  source,
  sourceAiInteractionId,
  idempotencyParts,
  token,
}: PublishEventParams): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  try {
    const dateBucket = new Date().toISOString().split('T')[0];
    const idempotencyKey = idempotencyParts
      ? [organizationId, eventName, ...idempotencyParts, dateBucket].join(':')
      : undefined;

    const res = await fetch(`${_API_URL}/automation-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        event_name: eventName,
        entity_type: entityType || null,
        entity_id: entityId || null,
        conversation_id: conversationId || null,
        lead_id: leadId || null,
        opportunity_id: opportunityId || null,
        payload,
        source,
        source_ai_interaction_id: sourceAiInteractionId || null,
        idempotency_key: idempotencyKey || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as any;
      console.warn('[event-bus] Publish failed:', err);
      return { ok: false, error: err?.message || 'unknown' };
    }

    const data = await res.json() as any;
    console.log(`[event-bus] Event published: ${eventName} (${data?.event_id})`);
    return { ok: true, eventId: data?.event_id };
  } catch (err: any) {
    console.error('[event-bus] Publish error:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Update conversation ai_state for human/AI lock management
 */
export async function setConversationAiState(
  conversationId: string,
  state: 'ai_active' | 'human_active',
  token?: string | null,
): Promise<void> {
  await fetch(`${_API_URL}/conversations/${conversationId}/ai-state`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ state }),
  }).catch(() => {});
}
