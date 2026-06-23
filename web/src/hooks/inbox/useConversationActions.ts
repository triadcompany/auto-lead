import { useCallback, MutableRefObject, Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import { useApi } from '@/hooks/useApi';
import {
  InboxThread, OrgMember, ConversationStatus,
} from './inboxUtils';

interface Profile {
  id: string;
  organization_id: string;
  [key: string]: any;
}

interface Params {
  orgId: string | null;
  clerkUserId: string;
  myProfileId: string | undefined;
  profile: Profile | null;
  isAdmin: boolean;
  orgMembers: OrgMember[];
  threadsRef: MutableRefObject<InboxThread[]>;
  setThreads: Dispatch<SetStateAction<InboxThread[]>>;
  fetchThreads: () => Promise<void>;
}

export function useConversationActions({
  orgId, clerkUserId, myProfileId, profile, isAdmin,
  orgMembers, threadsRef, setThreads, fetchThreads,
}: Params) {
  const api = useApi();

  const clearUnread = useCallback(async (conversationId: string) => {
    if (!orgId) return;
    try {
      await api.conversations.markRead(conversationId);
      setThreads(prev => prev.map(t => t.id === conversationId ? { ...t, unread_count: 0 } : t));
    } catch {
      // non-critical
    }
  }, [orgId, api, setThreads]);

  const lockConversation = useCallback(async (conversationId: string) => {
    if (!orgId || !myProfileId) return;
    const thread = threadsRef.current.find(t => t.id === conversationId);
    if (!thread) return;
    if (thread.locked_by && thread.locked_by !== myProfileId) return;
    try {
      const now = new Date().toISOString();
      await api.conversations.update(conversationId, { locked_by: myProfileId, locked_at: now });
      setThreads(prev => prev.map(t => t.id === conversationId ? { ...t, locked_by: myProfileId!, locked_at: now } : t));
    } catch {
      // non-critical
    }
  }, [orgId, myProfileId, threadsRef, api, setThreads]);

  const updateStatus = useCallback(async (threadId: string, newStatus: ConversationStatus) => {
    if (!orgId || !myProfileId) return;
    const now = new Date().toISOString();
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, status: newStatus, last_status_change_at: now } : t));
    try {
      await api.conversations.update(threadId, { status: newStatus, last_status_change_at: now });
      const labels: Record<ConversationStatus, string> = {
        open: 'Conversa reaberta', in_progress: 'Em atendimento',
        waiting_customer: 'Aguardando cliente', closed: 'Conversa finalizada',
      };
      toast.success(labels[newStatus]);
    } catch {
      toast.error('Erro ao atualizar status');
      fetchThreads();
    }
  }, [orgId, myProfileId, api, setThreads, fetchThreads]);

  const assumeConversation = useCallback(async (threadId: string) => {
    if (!orgId || !myProfileId) return;
    const now = new Date().toISOString();
    setThreads(prev => prev.map(t => t.id === threadId ? {
      ...t, assigned_to: myProfileId, assigned_at: now,
      status: 'in_progress' as ConversationStatus,
      locked_by: myProfileId, locked_at: now, last_status_change_at: now,
    } : t));
    try {
      await api.conversations.update(threadId, {
        assigned_to: myProfileId, assigned_at: now,
        status: 'in_progress', locked_by: myProfileId, locked_at: now, last_status_change_at: now,
      });
      toast.success('Conversa assumida');
    } catch {
      toast.error('Erro ao assumir conversa');
      fetchThreads();
    }
  }, [orgId, myProfileId, api, setThreads, fetchThreads]);

  const releaseConversation = useCallback(async (threadId: string) => {
    if (!orgId || !myProfileId) return;
    const now = new Date().toISOString();
    setThreads(prev => prev.map(t => t.id === threadId ? {
      ...t, locked_by: null, locked_at: null,
      status: 'open' as ConversationStatus, last_status_change_at: now,
    } : t));
    try {
      await api.conversations.update(threadId, { locked_by: null, locked_at: null, status: 'open', last_status_change_at: now });
      toast.success('Conversa liberada');
    } catch {
      toast.error('Erro ao liberar conversa');
      fetchThreads();
    }
  }, [orgId, myProfileId, api, setThreads, fetchThreads]);

  const closeConversation = useCallback(async (threadId: string) => {
    if (!orgId || !myProfileId) return;
    await updateStatus(threadId, 'closed');
    try {
      await api.conversations.update(threadId, { locked_by: null, locked_at: null });
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, locked_by: null, locked_at: null } : t));
    } catch {
      // non-critical
    }
  }, [orgId, myProfileId, updateStatus, api, setThreads]);

  const assignThread = useCallback(async (threadId: string, profileId: string | null) => {
    if (!orgId) return;
    setThreads(prev => prev.map(t => t.id === threadId
      ? { ...t, assigned_to: profileId, assigned_at: profileId ? new Date().toISOString() : null }
      : t
    ));
    try {
      await api.conversations.update(threadId, {
        assigned_to: profileId,
        assigned_at: profileId ? new Date().toISOString() : null,
      });
      toast.success(profileId ? 'Conversa atribuída' : 'Atribuição removida');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atribuir conversa');
      await fetchThreads();
    }
  }, [orgId, api, setThreads, fetchThreads]);

  const createLeadFromConversation = useCallback(async (
    conversationId: string,
    leadData: {
      name: string; phone: string; email?: string; seller_id: string;
      source?: string; interest?: string; observations?: string;
      valor_negocio?: number; servico?: string; cidade?: string; estado?: string; stage_id: string;
    }
  ): Promise<string | null> => {
    if (!orgId || !profile) return null;
    try {
      const newLead = await api.leads.create({ ...leadData, created_by: profile.id }) as any;
      await api.conversations.update(conversationId, { lead_id: newLead.id });
      setThreads(prev => prev.map(t => t.id === conversationId ? { ...t, lead_id: newLead.id } : t));
      toast.success('Lead criado e vinculado à conversa');
      await fetchThreads();
      return newLead.id;
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar lead');
      return null;
    }
  }, [orgId, profile, api, setThreads, fetchThreads]);

  const canSendMessage = useCallback((thread: InboxThread | null): boolean => {
    if (!thread || !profile) return false;
    if (isAdmin) return true;
    if (thread.locked_by && thread.locked_by !== myProfileId) return false;
    return thread.assigned_to === myProfileId;
  }, [isAdmin, profile, myProfileId]);

  const getLockedByName = useCallback((thread: InboxThread | null): string | null => {
    if (!thread?.locked_by) return null;
    if (thread.locked_by === myProfileId) return null;
    const member = orgMembers.find(m => m.id === thread.locked_by);
    return member?.name || 'Outro usuário';
  }, [orgMembers, myProfileId]);

  return {
    clearUnread,
    lockConversation,
    updateStatus,
    assumeConversation,
    releaseConversation,
    closeConversation,
    assignThread,
    createLeadFromConversation,
    canSendMessage,
    getLockedByName,
  };
}
