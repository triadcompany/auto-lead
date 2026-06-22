import { supabase } from '@/integrations/supabase/client';

export type ConversationStatus = 'open' | 'in_progress' | 'waiting_customer' | 'closed';

export interface InboxThread {
  id: string;
  organization_id: string;
  instance_name: string;
  contact_phone: string;
  contact_name: string | null;
  contact_name_source: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  created_at: string;
  profile_picture_url: string | null;
  profile_picture_updated_at: string | null;
  lead_id: string | null;
  lead_stage_name?: string | null;
  ai_mode: string;
  ai_state: string | null;
  last_ai_reply_at: string | null;
  ai_reply_count_since_last_lead: number;
  ai_pending: boolean;
  ai_pending_started_at: string | null;
  status: ConversationStatus;
  locked_by: string | null;
  locked_at: string | null;
  last_status_change_at: string | null;
  is_group?: boolean;
  group_name?: string | null;
  group_participants_count?: number | null;
}

export interface InboxMessage {
  id: string;
  organization_id: string;
  conversation_id: string;
  direction: string;
  body: string;
  external_message_id: string | null;
  created_at: string;
  ai_generated?: boolean;
  ai_interaction_id?: string | null;
  message_type?: string;
  media_url?: string | null;
  mime_type?: string | null;
  duration_ms?: number | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  sender_avatar_url?: string | null;
}

export interface OrgMember {
  id: string;
  name: string;
}

export type FilterMode = 'all' | 'mine' | 'unassigned' | 'open' | 'in_progress' | 'waiting_customer' | 'closed' | 'meta_ads';
export type AssignmentFilter = 'all' | 'mine' | 'unassigned';
export type StatusFilter = 'all' | 'open' | 'in_progress' | 'waiting_customer' | 'closed';

export function dedupeAndSort(msgs: InboxMessage[]): InboxMessage[] {
  const map = new Map<string, InboxMessage>();
  for (const m of msgs) {
    const existing = map.get(m.id);
    if (!existing || (existing.id.startsWith('temp-') && !m.id.startsWith('temp-'))) {
      map.set(m.id, m);
    }
    if (m.external_message_id) {
      const byExt = [...map.values()].find(
        x => x.external_message_id === m.external_message_id && x.id !== m.id
      );
      if (byExt && byExt.id.startsWith('temp-')) {
        map.delete(byExt.id);
      }
    }
  }
  return [...map.values()].sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
}

export async function rpcUpdate(
  orgId: string,
  clerkUserId: string,
  conversationId: string,
  updates: Record<string, any>
): Promise<void> {
  await supabase.rpc('update_conversation' as any, {
    p_clerk_user_id: clerkUserId,
    p_org_id: orgId,
    p_conversation_id: conversationId,
    p_updates: updates,
  });
}

export async function rpcEvent(
  orgId: string,
  clerkUserId: string,
  conversationId: string,
  eventType: string,
  metadata?: any
): Promise<void> {
  await supabase.rpc('insert_conversation_event' as any, {
    p_clerk_user_id: clerkUserId,
    p_org_id: orgId,
    p_conversation_id: conversationId,
    p_event_type: eventType,
    p_metadata: metadata || null,
  });
}

export function sortThreadsByRecency(threads: InboxThread[]): InboxThread[] {
  return threads.slice().sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });
}
