import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ConversationNote {
  id: string;
  conversation_id: string;
  organization_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
  author_name?: string;
}

export function useConversationNotes(conversationId: string | null) {
  const [notes, setNotes] = useState<ConversationNote[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('get_conversation_notes', {
        p_conversation_id: conversationId,
      });
      if (error) throw error;
      setNotes((data ?? []) as unknown as ConversationNote[]);
    } catch (err: any) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const createNote = useCallback(async (content: string) => {
    if (!conversationId) return;
    try {
      const { error } = await (supabase as any).rpc('create_conversation_note', {
        p_conversation_id: conversationId,
        p_content: content,
      });
      if (error) throw error;
      await fetchNotes();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar nota', description: err.message, variant: 'destructive' });
    }
  }, [conversationId, fetchNotes]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`conversation_notes:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_notes',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => { fetchNotes(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, fetchNotes]);

  return { notes, loading, createNote, refetch: fetchNotes };
}
