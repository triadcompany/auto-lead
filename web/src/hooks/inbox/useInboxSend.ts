import { useCallback, MutableRefObject, Dispatch, SetStateAction } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { InboxThread, InboxMessage, ConversationStatus, dedupeAndSort, rpcUpdate, sortThreadsByRecency } from './inboxUtils';

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
      const selectedConv = threadsRef.current?.find(t => t.id === selectedThreadId);

      if (selectedConv?.ai_mode === 'auto') {
        await rpcUpdate(orgId, clerkUserId, selectedThreadId, { ai_state: 'human_active' });
        setThreads(prev =>
          prev.map(t => t.id === selectedThreadId ? { ...t, ai_state: 'human_active' } : t)
        );
      }

      await rpcUpdate(orgId, clerkUserId, selectedThreadId, {
        status: 'waiting_customer',
        last_status_change_at: new Date().toISOString(),
      });

      const res = await supabase.functions.invoke('whatsapp-send', {
        body: {
          organization_id: orgId,
          thread_id: selectedThreadId,
          text: text.trim(),
          instance_name: selectedConv?.instance_name,
          phone: selectedConv?.contact_phone,
        },
      });

      if (res.error) throw new Error(res.error.message || 'Erro ao enviar');
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      toast.error(err.message || 'Erro ao enviar mensagem');
      throw err;
    } finally {
      setSending(false);
    }
  }, [orgId, clerkUserId, selectedThreadId, threadsRef, setMessages, setThreads, setSending]);

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

    const optimisticMsg: InboxMessage = {
      id: `temp-${Date.now()}`,
      organization_id: orgId,
      conversation_id: selectedThreadId,
      direction: 'outbound',
      body: previewBody,
      external_message_id: null,
      created_at: new Date().toISOString(),
      message_type: params.kind,
      media_url: URL.createObjectURL(params.file),
      mime_type: params.file.type || null,
    } as InboxMessage;
    setMessages(prev => dedupeAndSort([...prev, optimisticMsg]));

    try {
      const ext = (params.file.name.split('.').pop() || '').toLowerCase() || 'bin';
      const path = `${orgId}/${selectedThreadId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('chat-media')
        .upload(path, params.file, {
          contentType: params.file.type || undefined,
          upsert: false,
        });
      if (upErr) throw new Error(upErr.message || 'Falha no upload');

      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error('URL pública indisponível');

      const res = await supabase.functions.invoke('whatsapp-send', {
        body: {
          organization_id: orgId,
          thread_id: selectedThreadId,
          message_type: params.kind,
          media_url: publicUrl,
          mime_type: params.file.type || null,
          filename: params.file.name,
          caption: params.caption?.trim() || undefined,
        },
      });
      if (res.error) throw new Error(res.error.message || 'Erro ao enviar');
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      toast.error(err.message || 'Erro ao enviar mídia');
    } finally {
      setSending(false);
    }
  }, [orgId, selectedThreadId, setMessages, setSending]);

  return { sendMessage, sendMedia };
}
