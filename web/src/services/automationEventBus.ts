/**
 * Automation Event Bus - Client-side event publishing utility
 * 
 * This module provides helpers to publish events to the automation_events table.
 * Events are consumed by the event-dispatcher edge function.
 * 
 * IMPORTANT: In Step 3, events are ONLY published when a human explicitly applies
 * an AI suggestion (click "Aplicar etapa"). No automatic publishing.
 */

import { supabase } from '@/integrations/supabase/client';

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
}: PublishEventParams): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  try {
    // Build idempotency key
    const dateBucket = new Date().toISOString().split('T')[0]; // daily bucket
    const idempotencyKey = idempotencyParts
      ? [organizationId, eventName, ...idempotencyParts, dateBucket].join(':')
      : undefined;

    const { data, error } = await (supabase as any)
      .from('automation_events')
      .insert({
        organization_id: organizationId,
        event_name: eventName,
        entity_type: entityType,
        entity_id: entityId || null,
        conversation_id: conversationId || null,
        lead_id: leadId || null,
        opportunity_id: opportunityId || null,
        payload,
        source,
        source_ai_interaction_id: sourceAiInteractionId || null,
        idempotency_key: idempotencyKey || null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      // Idempotency conflict = already published, not an error
      if (error.code === '23505') {
        console.log(`[event-bus] Event already published (idempotent): ${eventName}`);
        return { ok: true, error: 'duplicate' };
      }
      throw error;
    }

    const eventId = data?.id;
    console.log(`[event-bus] Event published: ${eventName} (${eventId})`);

    // Fire-and-forget: invoke the dispatcher
    supabase.functions.invoke('event-dispatcher', { body: {} }).catch(() => {});

    return { ok: true, eventId };
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
  state: 'ai_active' | 'human_active'
): Promise<void> {
  await supabase
    .from('conversations')
    .update({ ai_state: state } as any)
    .eq('id', conversationId);
}
