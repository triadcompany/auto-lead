import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';

export interface ConversationNote {
  id: string;
  conversation_id: string;
  organization_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
  author_name?: string;
}

function normalize(n: any): ConversationNote {
  return {
    id: n.id,
    conversation_id: n.conversationId || n.conversation_id,
    organization_id: n.organizationId || n.organization_id || '',
    content: n.content || '',
    created_by: n.createdBy || n.created_by || null,
    created_at: n.createdAt || n.created_at || new Date().toISOString(),
    author_name: n.authorName || n.author_name,
  };
}

export function useConversationNotes(conversationId: string | null) {
  const [notes, setNotes] = useState<ConversationNote[]>([]);
  const [loading, setLoading] = useState(false);
  const api = useApi();
  const { on } = useSocket();

  const fetchNotes = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const conv = await api.conversations.get(conversationId) as any;
      const raw: any[] = conv?.notes || [];
      setNotes(raw.map(normalize).sort((a, b) => a.created_at.localeCompare(b.created_at)));
    } catch (err: any) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, api]);

  const createNote = useCallback(async (content: string) => {
    if (!conversationId) return;
    try {
      await api.conversations.addNote(conversationId, content);
      await fetchNotes();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar nota', description: err.message, variant: 'destructive' });
    }
  }, [conversationId, api, fetchNotes]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  useEffect(() => {
    if (!conversationId) return;
    return on('conversation:note_added', (data: any) => {
      if (data?.conversationId === conversationId || data?.conversation_id === conversationId) {
        fetchNotes();
      }
    });
  }, [conversationId, on, fetchNotes]);

  return { notes, loading, createNote, refetch: fetchNotes };
}
