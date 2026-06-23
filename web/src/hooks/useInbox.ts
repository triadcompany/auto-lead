import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';
import {
  InboxThread, InboxMessage, OrgMember,
  FilterMode, AssignmentFilter, StatusFilter, ConversationStatus,
  dedupeAndSort, sortThreadsByRecency,
} from './inbox/inboxUtils';
import { useInboxAI } from './inbox/useInboxAI';
import { useInboxSend } from './inbox/useInboxSend';
import { useConversationActions } from './inbox/useConversationActions';

export type { ConversationStatus, InboxThread, InboxMessage, OrgMember, AssignmentFilter, StatusFilter };

function normalizeMessage(row: any): InboxMessage {
  return {
    ...row,
    conversation_id: row.conversation_id || row.conversationId,
    organization_id: row.organization_id || row.organizationId,
    created_at: row.created_at || row.createdAt,
    external_message_id: row.external_message_id || row.externalMessageId || null,
    message_type: row.message_type || row.messageType || 'text',
    media_url: row.media_url || row.mediaUrl || null,
    mime_type: row.mime_type || row.mimeType || null,
    duration_ms: row.duration_ms ?? row.durationMs ?? null,
    sender_name: row.sender_name || row.senderName || null,
    sender_phone: row.sender_phone || row.senderPhone || null,
    sender_avatar_url: row.sender_avatar_url || row.senderAvatarUrl || null,
    ai_generated: row.ai_generated ?? row.aiGenerated ?? false,
    ai_interaction_id: row.ai_interaction_id || row.aiInteractionId || null,
  };
}

function normalizeThread(row: any): InboxThread {
  return {
    ...row,
    status: row.status || 'open',
    locked_by: row.locked_by || row.lockedBy || null,
    locked_at: row.locked_at || row.lockedAt || null,
    last_status_change_at: row.last_status_change_at || row.lastStatusChangeAt || null,
    unread_count: row.unread_count || row.unreadCount || 0,
    last_message_at: row.last_message_at || row.lastMessageAt || null,
    last_message_preview: row.last_message_preview || row.lastMessagePreview || null,
    assigned_to: row.assigned_to || row.assignedTo || null,
    assigned_at: row.assigned_at || row.assignedAt || null,
    contact_name: row.contact_name || row.contactName || null,
    lead_id: row.lead_id || row.leadId || null,
    ai_mode: row.ai_mode || row.aiMode || 'off',
    ai_state: row.ai_state ?? row.aiState ?? null,
    ai_pending: row.ai_pending ?? row.aiPending ?? false,
    ai_pending_started_at: row.ai_pending_started_at || row.aiPendingStartedAt || null,
  };
}

export function useInbox() {
  const { user, profile, isAdmin, orgId, role } = useAuth();
  const clerkUserId = user?.id || '';
  const myProfileId = profile?.id;
  const api = useApi();
  const { on } = useSocket();

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

  const fetchOrgMembers = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await api.users.list() as any[];
      setOrgMembers(data.map((u: any) => ({
        id: u.id,
        clerk_user_id: u.clerkUserId || u.clerk_user_id,
        name: u.name,
        email: u.email,
        role: u.role || 'seller',
        avatar_url: u.avatarUrl || u.avatar_url || null,
      })));
    } catch {
      // non-critical
    }
  }, [orgId, api]);

  useEffect(() => { fetchOrgMembers(); }, [fetchOrgMembers]);

  const fetchThreads = useCallback(async () => {
    if (!orgId || !clerkUserId) {
      setLoadingThreads(false);
      return;
    }
    setLoadingThreads(true);
    try {
      const data = await api.conversations.list({
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(!isAdmin && myProfileId && { assigned_to: myProfileId }),
        ...(search.trim() && { search: search.trim() }),
        limit: 100,
      }) as any[];
      setThreads(data.map(normalizeThread));
    } catch {
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoadingThreads(false);
    }
  }, [orgId, clerkUserId, filter, search, myProfileId, isAdmin, assignmentFilter, statusFilter, api]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!orgId || !clerkUserId) return;
    setLoadingMessages(true);
    try {
      const data = await api.conversations.messages(conversationId, { limit: 200 }) as any[];
      setMessages(dedupeAndSort(data.map(normalizeMessage)));
    } catch {
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoadingMessages(false);
    }
  }, [orgId, clerkUserId, api]);

  // Socket.io realtime
  useEffect(() => {
    if (!orgId) return;

    const unsubs = [
      on('message:created', (payload: any) => {
        // API emite { conversationId, message } ou diretamente o objeto msg
        const raw = payload?.message || payload;
        const newMsg = normalizeMessage(raw);
        const convId = newMsg.conversation_id;

        if (convId === selectedThreadIdRef.current) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
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
            if (t.id !== convId) return t;
            return {
              ...t,
              last_message_at: newMsg.created_at,
              last_message_preview: (newMsg.body || '').substring(0, 100),
              unread_count: convId === selectedThreadIdRef.current
                ? 0
                : t.unread_count + (newMsg.direction === 'inbound' ? 1 : 0),
            };
          });
          return sortThreadsByRecency(updated);
        });
      }),

      on('conversation:updated', (updated: any) => {
        setThreads(prev => sortThreadsByRecency(prev.map(t => {
          if (t.id !== updated.id) return t;
          return { ...t, ...normalizeThread(updated) };
        })));
      }),

      on('conversation:created', () => { fetchThreads(); }),
    ];

    return () => unsubs.forEach(u => u());
  }, [orgId, fetchThreads, on]);

  // Polling fallback for messages
  useEffect(() => {
    if (!orgId || !selectedThreadId || !clerkUserId) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.conversations.messages(selectedThreadId, { limit: 200 }) as any[];
        if (data.length === 0) return;
        setMessages(prev => {
          const newMsgs = dedupeAndSort(data);
          if (newMsgs.length === prev.length && newMsgs[newMsgs.length - 1]?.id === prev[prev.length - 1]?.id) return prev;
          return newMsgs;
        });
      } catch {
        // silent fallback
      }
    }, 7000);
    return () => clearInterval(interval);
  }, [orgId, selectedThreadId, clerkUserId, api]);

  const conversationActions = useConversationActions({
    orgId, clerkUserId, myProfileId, profile: profile as any,
    isAdmin, orgMembers, threadsRef, setThreads, fetchThreads,
  });

  const { toggleAiMode, resumeAi } = useInboxAI({ orgId, clerkUserId, setThreads });

  const { sendMessage, sendMedia } = useInboxSend({
    orgId, clerkUserId, selectedThreadId, threadsRef, setMessages, setThreads, setSending,
  });

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
    role,
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
