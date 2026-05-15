import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  InboxThread, InboxMessage, OrgMember,
  FilterMode, AssignmentFilter, StatusFilter, ConversationStatus,
  dedupeAndSort, sortThreadsByRecency,
} from './inbox/inboxUtils';
import { useInboxAI } from './inbox/useInboxAI';
import { useInboxSend } from './inbox/useInboxSend';
import { useConversationActions } from './inbox/useConversationActions';

// Re-export types consumed by InboxPage and other components
export type { ConversationStatus, InboxThread, InboxMessage, OrgMember, AssignmentFilter, StatusFilter };

export function useInbox() {
  const { user, profile, isAdmin, orgId } = useAuth();
  const clerkUserId = user?.id || '';
  const myProfileId = profile?.id;

  // ── Shared state ─────────────────────────────────────────────────────────
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>(isAdmin ? 'all' : 'mine');
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>(isAdmin ? 'all' : 'mine');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [newMessageFlag, setNewMessageFlag] = useState(0);

  const selectedThreadIdRef = useRef(selectedThreadId);
  selectedThreadIdRef.current = selectedThreadId;
  const threadsRef = useRef(threads);
  threadsRef.current = threads;

  // ── Fetch org members ────────────────────────────────────────────────────
  const fetchOrgMembers = useCallback(async () => {
    if (!orgId) return;
    try {
      const { data, error } = await (supabase as any).rpc('get_org_profiles', {
        p_org_id: orgId,
      });
      if (error) throw error;
      setOrgMembers((data as OrgMember[]) || []);
    } catch {
      // non-critical
    }
  }, [orgId]);

  useEffect(() => { fetchOrgMembers(); }, [fetchOrgMembers]);

  // ── Fetch thread list ────────────────────────────────────────────────────
  const fetchThreads = useCallback(async () => {
    if (!orgId || !clerkUserId) {
      setLoadingThreads(false);
      return;
    }
    setLoadingThreads(true);
    try {
      const { data, error } = await supabase.rpc('get_org_conversations' as any, {
        p_clerk_user_id: clerkUserId,
        p_org_id: orgId,
        p_is_admin: isAdmin,
        p_seller_id: myProfileId || null,
        p_filter: filter,
        p_search: search.trim(),
        p_limit: 100,
        p_assignment_filter: assignmentFilter,
        p_status_filter: statusFilter,
      });
      if (error) throw error;
      const parsed = (typeof data === 'string' ? JSON.parse(data) : data) || [];
      setThreads(parsed.map((row: any) => ({
        ...row,
        status: row.status || 'open',
        locked_by: row.locked_by || null,
        locked_at: row.locked_at || null,
        last_status_change_at: row.last_status_change_at || null,
      })));
    } catch {
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoadingThreads(false);
    }
  }, [orgId, clerkUserId, filter, search, myProfileId, isAdmin, assignmentFilter, statusFilter]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // ── Fetch messages for selected conversation ──────────────────────────────
  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!orgId || !clerkUserId) return;
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase.rpc('get_conversation_messages' as any, {
        p_clerk_user_id: clerkUserId,
        p_org_id: orgId,
        p_conversation_id: conversationId,
        p_limit: 200,
      });
      if (error) throw error;
      const parsed = (typeof data === 'string' ? JSON.parse(data) : data) || [];
      setMessages(dedupeAndSort(parsed));
    } catch {
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoadingMessages(false);
    }
  }, [orgId, clerkUserId]);

  // ── Realtime subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`inbox-rt-${orgId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `organization_id=eq.${orgId}` },
        (payload) => {
          const newMsg = payload.new as InboxMessage;

          if (newMsg.conversation_id === selectedThreadIdRef.current) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              if (newMsg.external_message_id && prev.some(m => m.external_message_id === newMsg.external_message_id)) {
                return dedupeAndSort([...prev.filter(m => m.external_message_id !== newMsg.external_message_id), newMsg]);
              }
              const withoutOptimistic = prev.filter(m => {
                if (!m.id.startsWith('temp-')) return true;
                return !(m.body === newMsg.body && m.direction === newMsg.direction);
              });
              return dedupeAndSort([...withoutOptimistic, newMsg]);
            });
            if (newMsg.direction === 'inbound') setNewMessageFlag(f => f + 1);
          }

          setThreads(prev => {
            const updated = prev.map(t => {
              if (t.id !== newMsg.conversation_id) return t;
              return {
                ...t,
                last_message_at: newMsg.created_at,
                last_message_preview: (newMsg.body || '').substring(0, 100),
                unread_count: newMsg.conversation_id === selectedThreadIdRef.current
                  ? 0
                  : t.unread_count + (newMsg.direction === 'inbound' ? 1 : 0),
              };
            });
            return sortThreadsByRecency(updated);
          });
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `organization_id=eq.${orgId}` },
        (payload) => {
          const updated = payload.new as any;
          setThreads(prev => {
            const newList = prev.map(t => {
              if (t.id !== updated.id) return t;
              return {
                ...t,
                last_message_at: updated.last_message_at ?? t.last_message_at,
                last_message_preview: updated.last_message_preview ?? t.last_message_preview,
                unread_count: updated.unread_count ?? t.unread_count,
                assigned_to: updated.assigned_to ?? t.assigned_to,
                assigned_at: updated.assigned_at ?? t.assigned_at,
                contact_name: updated.contact_name ?? t.contact_name,
                lead_id: updated.lead_id ?? t.lead_id,
                ai_mode: updated.ai_mode ?? t.ai_mode,
                ai_state: updated.ai_state !== undefined ? updated.ai_state : t.ai_state,
                ai_pending: updated.ai_pending !== undefined ? updated.ai_pending : t.ai_pending,
                ai_pending_started_at: updated.ai_pending_started_at !== undefined ? updated.ai_pending_started_at : t.ai_pending_started_at,
                status: updated.status ?? t.status,
                locked_by: updated.locked_by !== undefined ? updated.locked_by : t.locked_by,
                locked_at: updated.locked_at !== undefined ? updated.locked_at : t.locked_at,
                last_status_change_at: updated.last_status_change_at !== undefined ? updated.last_status_change_at : t.last_status_change_at,
              };
            });
            return sortThreadsByRecency(newList);
          });
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations', filter: `organization_id=eq.${orgId}` },
        () => { fetchThreads(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, fetchThreads]);

  // ── Fallback polling ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId || !selectedThreadId || !clerkUserId) return;

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.rpc('get_conversation_messages' as any, {
          p_clerk_user_id: clerkUserId,
          p_org_id: orgId,
          p_conversation_id: selectedThreadId,
          p_limit: 200,
        });
        if (error || !data) return;
        const parsed = (typeof data === 'string' ? JSON.parse(data) : data) || [];
        if (parsed.length === 0) return;
        setMessages(prev => {
          const newMsgs = dedupeAndSort(parsed);
          if (newMsgs.length === prev.length && newMsgs[newMsgs.length - 1]?.id === prev[prev.length - 1]?.id) return prev;
          return newMsgs;
        });
      } catch {
        // silent fallback
      }
    }, 7000);

    return () => clearInterval(interval);
  }, [orgId, selectedThreadId, clerkUserId]);

  // ── Sub-hooks ─────────────────────────────────────────────────────────────
  const conversationActions = useConversationActions({
    orgId, clerkUserId, myProfileId, profile: profile as any,
    isAdmin, orgMembers, threadsRef, setThreads, fetchThreads,
  });

  const { toggleAiMode, resumeAi } = useInboxAI({ orgId, clerkUserId, setThreads });

  const { sendMessage, sendMedia } = useInboxSend({
    orgId, clerkUserId, selectedThreadId, threadsRef, setMessages, setThreads, setSending,
  });

  // ── Select thread ────────────────────────────────────────────────────────
  const selectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
    if (threadId) {
      fetchMessages(threadId);
      conversationActions.clearUnread(threadId);
      conversationActions.lockConversation(threadId);
    }
  }, [fetchMessages, conversationActions]);

  const selectedThread = threads.find(t => t.id === selectedThreadId) || null;

  return {
    threads,
    messages,
    selectedThread,
    selectedThreadId,
    filter,
    assignmentFilter,
    statusFilter,
    search,
    loadingThreads,
    loadingMessages,
    sending,
    isAdmin,
    orgMembers,
    profile,
    myProfileId,
    newMessageFlag,
    setFilter,
    setAssignmentFilter,
    setStatusFilter,
    setSearch,
    selectThread,
    sendMessage,
    sendMedia,
    refreshThreads: fetchThreads,
    toggleAiMode,
    resumeAi,
    ...conversationActions,
  };
}
