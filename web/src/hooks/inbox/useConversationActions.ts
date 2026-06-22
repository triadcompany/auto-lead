import { useCallback, MutableRefObject, Dispatch, SetStateAction } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  InboxThread, OrgMember, ConversationStatus,
  rpcUpdate, rpcEvent,
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
  const clearUnread = useCallback(async (conversationId: string) => {
    if (!orgId || !clerkUserId) return;
    try {
      await rpcUpdate(orgId, clerkUserId, conversationId, { unread_count: 0 });
      setThreads(prev =>
        prev.map(t => t.id === conversationId ? { ...t, unread_count: 0 } : t)
      );
    } catch {
      // non-critical
    }
  }, [orgId, clerkUserId, setThreads]);

  const lockConversation = useCallback(async (conversationId: string) => {
    if (!orgId || !clerkUserId || !myProfileId) return;
    const thread = threadsRef.current.find(t => t.id === conversationId);
    if (!thread) return;
    if (thread.locked_by && thread.locked_by !== myProfileId) return;

    try {
      const now = new Date().toISOString();
      await rpcUpdate(orgId, clerkUserId, conversationId, { locked_by: myProfileId, locked_at: now });
      setThreads(prev =>
        prev.map(t => t.id === conversationId ? { ...t, locked_by: myProfileId!, locked_at: now } : t)
      );
    } catch {
      // non-critical
    }
  }, [orgId, clerkUserId, myProfileId, threadsRef, setThreads]);

  const updateStatus = useCallback(async (threadId: string, newStatus: ConversationStatus) => {
    if (!orgId || !clerkUserId || !myProfileId) return;

    const now = new Date().toISOString();
    setThreads(prev =>
      prev.map(t => t.id === threadId ? { ...t, status: newStatus, last_status_change_at: now } : t)
    );

    try {
      await rpcUpdate(orgId, clerkUserId, threadId, { status: newStatus, last_status_change_at: now });
      const eventMap: Record<ConversationStatus, string> = {
        open: 'reopened', in_progress: 'assumed', waiting_customer: 'waiting', closed: 'closed',
      };
      await rpcEvent(orgId, clerkUserId, threadId, eventMap[newStatus]);
      const labels: Record<ConversationStatus, string> = {
        open: 'Conversa reaberta', in_progress: 'Em atendimento',
        waiting_customer: 'Aguardando cliente', closed: 'Conversa finalizada',
      };
      toast.success(labels[newStatus]);
    } catch (err: any) {
      toast.error('Erro ao atualizar status');
      fetchThreads();
    }
  }, [orgId, clerkUserId, myProfileId, setThreads, fetchThreads]);

  const assumeConversation = useCallback(async (threadId: string) => {
    if (!orgId || !clerkUserId || !myProfileId) return;

    const now = new Date().toISOString();
    setThreads(prev =>
      prev.map(t => t.id === threadId ? {
        ...t, assigned_to: myProfileId, assigned_at: now,
        status: 'in_progress' as ConversationStatus,
        locked_by: myProfileId, locked_at: now, last_status_change_at: now,
      } : t)
    );

    try {
      await rpcUpdate(orgId, clerkUserId, threadId, {
        assigned_to: myProfileId, assigned_at: now,
        status: 'in_progress', locked_by: myProfileId, locked_at: now,
        last_status_change_at: now,
      });
      await rpcEvent(orgId, clerkUserId, threadId, 'assumed');
      toast.success('Conversa assumida');
    } catch (err: any) {
      toast.error('Erro ao assumir conversa');
      fetchThreads();
    }
  }, [orgId, clerkUserId, myProfileId, setThreads, fetchThreads]);

  const releaseConversation = useCallback(async (threadId: string) => {
    if (!orgId || !clerkUserId || !myProfileId) return;

    const now = new Date().toISOString();
    setThreads(prev =>
      prev.map(t => t.id === threadId ? {
        ...t, locked_by: null, locked_at: null,
        status: 'open' as ConversationStatus, last_status_change_at: now,
      } : t)
    );

    try {
      await rpcUpdate(orgId, clerkUserId, threadId, {
        locked_by: null, locked_at: null, status: 'open', last_status_change_at: now,
      });
      await rpcEvent(orgId, clerkUserId, threadId, 'released');
      toast.success('Conversa liberada');
    } catch (err: any) {
      toast.error('Erro ao liberar conversa');
      fetchThreads();
    }
  }, [orgId, clerkUserId, myProfileId, setThreads, fetchThreads]);

  const closeConversation = useCallback(async (threadId: string) => {
    if (!orgId || !clerkUserId || !myProfileId) return;
    await updateStatus(threadId, 'closed');
    await rpcUpdate(orgId, clerkUserId, threadId, { locked_by: null, locked_at: null });
    setThreads(prev =>
      prev.map(t => t.id === threadId ? { ...t, locked_by: null, locked_at: null } : t)
    );
  }, [orgId, clerkUserId, myProfileId, updateStatus, setThreads]);

  const assignThread = useCallback(async (threadId: string, profileId: string | null) => {
    if (!orgId || !clerkUserId) return;

    setThreads(prev =>
      prev.map(t => t.id === threadId
        ? { ...t, assigned_to: profileId, assigned_at: profileId ? new Date().toISOString() : null }
        : t
      )
    );

    try {
      await rpcUpdate(orgId, clerkUserId, threadId, {
        assigned_to: profileId,
        assigned_at: profileId ? new Date().toISOString() : null,
      });
      toast.success(profileId ? 'Conversa atribuída' : 'Atribuição removida');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atribuir conversa');
      await fetchThreads();
    }
  }, [orgId, clerkUserId, setThreads, fetchThreads]);

  const createLeadFromConversation = useCallback(async (
    conversationId: string,
    leadData: {
      name: string; phone: string; email?: string; seller_id: string;
      source?: string; interest?: string; observations?: string;
      valor_negocio?: number; servico?: string; cidade?: string; estado?: string; stage_id: string;
    }
  ): Promise<string | null> => {
    if (!orgId || !clerkUserId || !profile) return null;

    try {
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({ ...leadData, created_by: profile.id, organization_id: orgId })
        .select('id')
        .single();

      if (leadError) throw leadError;

      await rpcUpdate(orgId, clerkUserId, conversationId, { lead_id: newLead.id });
      setThreads(prev =>
        prev.map(t => t.id === conversationId ? { ...t, lead_id: newLead.id } : t)
      );

      (supabase.rpc as any)('distribute_lead', {
        p_lead_id: newLead.id, p_organization_id: orgId,
      }).then((res: any) => {
        if (res.error) console.error('Lead distribution error:', res.error);
      });

      supabase.functions.invoke('automation-trigger', {
        body: {
          organization_id: orgId, trigger_type: 'lead_created',
          entity_type: 'lead', entity_id: newLead.id,
          context: {
            lead_name: leadData.name, lead_phone: leadData.phone,
            lead_email: leadData.email || '', lead_source: leadData.source || '',
            stage_id: leadData.stage_id, seller_id: leadData.seller_id,
          },
        },
      }).then(({ error }) => {
        if (error) console.error('Automation trigger error:', error);
      });

      toast.success('Lead criado e vinculado à conversa');
      await fetchThreads();
      return newLead.id;
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar lead');
      return null;
    }
  }, [orgId, clerkUserId, profile, setThreads, fetchThreads]);

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
