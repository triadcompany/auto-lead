import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  const { profile } = useAuth();

  const fetchNotes = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversation_notes')
        .select('*, profiles(name)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const mapped = (data || []).map((n: any) => ({
        ...n,
        author_name: n.profiles?.name ?? null,
      }));
      setNotes(mapped);
    } catch (err: any) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const createNote = useCallback(async (content: string) => {
    if (!conversationId || !profile?.organization_id) return;
    try {
      const { error } = await supabase.from('conversation_notes').insert({
        conversation_id: conversationId,
        organization_id: profile.organization_id,
        content,
        created_by: profile.id ?? null,
      });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: 'Erro ao salvar nota', description: err.message, variant: 'destructive' });
    }
  }, [conversationId, profile]);

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
