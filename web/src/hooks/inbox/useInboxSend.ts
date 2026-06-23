import { useCallback, MutableRefObject, Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import { useApi } from '@/hooks/useApi';
import { InboxThread, InboxMessage, ConversationStatus, dedupeAndSort, sortThreadsByRecency } from './inboxUtils';

interface Params {
  orgId: string | null;
  clerkUserId: string;
  selectedThreadId: string | null;
  threadsRef: MutableRefObject<InboxThread[]>;
  setMessages: Dispatch<SetStateAction<InboxMessage[]>>;
  setThreads: Dispatch<SetStateAction<InboxThread[]>>;
  setSending: Dispatch<SetStateAction<boolean>>;
}

export function useInboxSend({
  orgId,
  clerkUserId,
  selectedThreadId,
  threadsRef,
  setMessages,
  setThreads,
  setSending,
}: Params) {
  const api = useApi();

  const sendMessage = useCallback(async (text: string) => {
    if (!orgId || !clerkUserId || !selectedThreadId || !text.trim()) return;
    setSending(true);

    const optimisticMsg: InboxMessage = {
      id: `temp-${Date.now()}`,
      organization_id: orgId,
      conversation_id: selectedThreadId,
      direction: 'outbound',
      body: text.trim(),
      external_message_id: null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => dedupeAndSort([...prev, optimisticMsg]));

    setThreads(prev => {
      const updated = prev.map(t => {
        if (t.id !== selectedThreadId) return t;
        return {
          ...t,
          last_message_at: optimisticMsg.created_at,
          last_message_preview: text.trim().substring(0, 100),
          status: 'waiting_customer' as ConversationStatus,
          last_status_change_at: new Date().toISOString(),
        };
      });
      return sortThreadsByRecency(updated);
    });

    try {
      await api.conversations.sendMessage(selectedThreadId, text.trim());
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      toast.error(err.message || 'Erro ao enviar mensagem');
      throw err;
    } finally {
      setSending(false);
    }
  }, [orgId, clerkUserId, selectedThreadId, threadsRef, setMessages, setThreads, setSending, api]);

  const sendMedia = useCallback(async (params: {
    file: File;
    kind: 'image' | 'video' | 'audio' | 'document';
    caption?: string;
  }) => {
    if (!orgId || !selectedThreadId) return;
    setSending(true);

    const previewBody =
      params.caption?.trim() ||
      (params.kind === 'image' ? '📷 Foto'
        : params.kind === 'video' ? '🎥 Vídeo'
        : params.kind === 'audio' ? '🎵 Áudio'
        : '📄 Documento');

    const blobUrl = URL.createObjectURL(params.file);
    const optimisticMsg: InboxMessage = {
      id: `temp-${Date.now()}`,
      organization_id: orgId,
      conversation_id: selectedThreadId,
      direction: 'outbound',
      body: previewBody,
      external_message_id: null,
      created_at: new Date().toISOString(),
      message_type: params.kind,
      media_url: blobUrl,
      mime_type: params.file.type || null,
    } as InboxMessage;
    setMessages(prev => dedupeAndSort([...prev, optimisticMsg]));

    try {
      if (params.kind === 'audio') {
        await api.whatsapp.sendAudio(selectedThreadId, params.file);
      } else {
        await api.conversations.sendMessage(selectedThreadId, previewBody, params.kind);
      }
      // Remove optimistic (o socket vai trazer a mensagem real)
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      URL.revokeObjectURL(blobUrl);
      toast.error(err.message || 'Erro ao enviar mídia');
    } finally {
      setSending(false);
    }
  }, [orgId, selectedThreadId, setMessages, setSending, api]);

  return { sendMessage, sendMedia };
}
