import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Note: These tables will be created via SQL migration.
// Using 'any' casting since types aren't generated yet.

export interface InstagramConnection {
  id: string;
  organization_id: string;
  instagram_business_account_id: string;
  page_id: string;
  page_name: string | null;
  instagram_username: string | null;
  profile_picture_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface InstagramConversation {
  id: string;
  organization_id: string;
  connection_id: string;
  instagram_conversation_id: string;
  participant_id: string;
  participant_username: string | null;
  participant_name: string | null;
  participant_profile_picture: string | null;
  assigned_to: string | null;
  status: 'open' | 'pending' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  lead_id: string | null;
  created_at: string;
  // Joined data
  assigned_user?: {
    name: string;
    avatar_url: string | null;
  };
  tags?: ConversationTag[];
}

export interface InstagramMessage {
  id: string;
  conversation_id: string;
  instagram_message_id: string | null;
  direction: 'incoming' | 'outgoing';
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'sticker';
  media_url: string | null;
  sent_by: string | null;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  is_quick_reply: boolean;
  created_at: string;
  // Joined data
  sender?: {
    name: string;
    avatar_url: string | null;
  };
}

export interface QuickReply {
  id: string;
  organization_id: string;
  title: string;
  shortcut: string | null;
  content: string;
  category: string | null;
  usage_count: number;
}

export interface ConversationTag {
  id: string;
  name: string;
  color: string;
}

export interface InstagramUserPermission {
  id: string;
  connection_id: string;
  user_id: string;
  can_view: boolean;
  can_respond: boolean;
  can_transfer: boolean;
  user?: {
    name: string;
    email: string;
    avatar_url: string | null;
  };
}

export function useInstagramChat() {
  const { profile, isAdmin, orgId: authOrgId } = useAuth();
  const { toast } = useToast();
  const igOrgId = profile?.organization_id || authOrgId;
  
  const [connections, setConnections] = useState<InstagramConnection[]>([]);
  const [conversations, setConversations] = useState<InstagramConversation[]>([]);
  const [messages, setMessages] = useState<InstagramMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [tags, setTags] = useState<ConversationTag[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<InstagramConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Fetch connections
  const fetchConnections = useCallback(async () => {
    if (!igOrgId) return;

    const { data, error } = await (supabase as any)
      .from('instagram_connections')
      .select('*')
      .eq('organization_id', igOrgId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching connections:', error);
    } else {
      setConnections((data || []) as InstagramConnection[]);
    }
  }, [igOrgId]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!igOrgId) return;

    // First fetch conversations without the join
    const { data, error } = await (supabase as any)
      .from('instagram_conversations')
      .select('*')
      .eq('organization_id', igOrgId)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return;
    }

    // Fetch assigned user info separately if needed
    const conversationsWithData = await Promise.all(
      (data || []).map(async (conv: any) => {
        let assigned_user = null;
        
        // Fetch assigned user if exists
        if (conv.assigned_to) {
          const { data: userData } = await supabase
            .from('profiles')
            .select('name, avatar_url')
            .eq('user_id', conv.assigned_to)
            .maybeSingle();
          assigned_user = userData;
        }

        // Fetch tags
        const { data: tagAssignments } = await (supabase as any)
          .from('instagram_conversation_tag_assignments')
          .select('tag_id, instagram_conversation_tags(id, name, color)')
          .eq('conversation_id', conv.id);

        return {
          ...conv,
          assigned_user,
          tags: tagAssignments?.map((ta: any) => ta.instagram_conversation_tags) || [],
        };
      })
    );

    setConversations(conversationsWithData as InstagramConversation[]);
  }, [igOrgId]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    // Fetch messages without the problematic join
    const { data, error } = await (supabase as any)
      .from('instagram_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    // Fetch sender info separately for outgoing messages
    const messagesWithSender = await Promise.all(
      (data || []).map(async (msg: any) => {
        let sender = null;
        if (msg.sent_by) {
          const { data: userData } = await supabase
            .from('profiles')
            .select('name, avatar_url')
            .eq('user_id', msg.sent_by)
            .maybeSingle();
          sender = userData;
        }
        return { ...msg, sender };
      })
    );

    setMessages(messagesWithSender as InstagramMessage[]);

    // Mark as read
    await (supabase as any)
      .from('instagram_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);
  }, []);

  // Fetch quick replies
  const fetchQuickReplies = useCallback(async () => {
    if (!igOrgId) return;

    const { data, error } = await (supabase as any)
      .from('instagram_quick_replies')
      .select('*')
      .eq('organization_id', igOrgId)
      .order('usage_count', { ascending: false });

    if (error) {
      console.error('Error fetching quick replies:', error);
    } else {
      setQuickReplies((data || []) as QuickReply[]);
    }
  }, [igOrgId]);

  // Fetch tags
  const fetchTags = useCallback(async () => {
    if (!igOrgId) return;

    const { data, error } = await (supabase as any)
      .from('instagram_conversation_tags')
      .select('*')
      .eq('organization_id', igOrgId);

    if (error) {
      console.error('Error fetching tags:', error);
    } else {
      setTags((data || []) as ConversationTag[]);
    }
  }, [igOrgId]);

  // Send message
  const sendMessage = async (content: string, quickReplyId?: string) => {
    if (!selectedConversation) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('instagram-send-message', {
        body: {
          conversationId: selectedConversation.id,
          message: content,
          quickReplyId,
        },
      });

      if (error) throw error;

      // Refresh messages
      await fetchMessages(selectedConversation.id);
      
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso",
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Não foi possível enviar a mensagem",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // Update conversation status
  const updateConversationStatus = async (conversationId: string, status: 'open' | 'pending' | 'closed') => {
    const { error } = await (supabase as any)
      .from('instagram_conversations')
      .update({ 
        status, 
        closed_at: status === 'closed' ? new Date().toISOString() : null,
        closed_by: status === 'closed' ? profile?.id : null,
      })
      .eq('id', conversationId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    } else {
      await fetchConversations();
    }
  };

  // Transfer conversation
  const transferConversation = async (conversationId: string, newUserId: string) => {
    const { error } = await (supabase as any)
      .from('instagram_conversations')
      .update({ assigned_to: newUserId })
      .eq('id', conversationId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível transferir a conversa",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Conversa transferida",
        description: "A conversa foi transferida com sucesso",
      });
      await fetchConversations();
    }
  };

  // Add tag to conversation
  const addTagToConversation = async (conversationId: string, tagId: string) => {
    const { error } = await (supabase as any)
      .from('instagram_conversation_tag_assignments')
      .insert({
        conversation_id: conversationId,
        tag_id: tagId,
        assigned_by: profile?.id,
      });

    if (error && error.code !== '23505') { // Ignore duplicate key error
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a tag",
        variant: "destructive",
      });
    } else {
      await fetchConversations();
    }
  };

  // Remove tag from conversation
  const removeTagFromConversation = async (conversationId: string, tagId: string) => {
    const { error } = await (supabase as any)
      .from('instagram_conversation_tag_assignments')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('tag_id', tagId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover a tag",
        variant: "destructive",
      });
    } else {
      await fetchConversations();
    }
  };

  // Update conversation lead
  const updateConversationLead = async (conversationId: string, leadId: string) => {
    const { error } = await (supabase as any)
      .from('instagram_conversations')
      .update({ lead_id: leadId })
      .eq('id', conversationId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível vincular o lead à conversa",
        variant: "destructive",
      });
      return false;
    } else {
      toast({
        title: "Lead vinculado",
        description: "O lead foi vinculado à conversa com sucesso",
      });
      await fetchConversations();
      return true;
    }
  };

  // Create quick reply
  const createQuickReply = async (title: string, content: string, shortcut?: string, category?: string) => {
    const { error } = await (supabase as any)
      .from('instagram_quick_replies')
      .insert({
        organization_id: igOrgId,
        title,
        content,
        shortcut,
        category,
        created_by: profile?.id,
      });

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar a resposta rápida",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Resposta rápida criada",
        description: "A resposta rápida foi criada com sucesso",
      });
      await fetchQuickReplies();
    }
  };

  // Create tag
  const createTag = async (name: string, color: string) => {
    const { error } = await (supabase as any)
      .from('instagram_conversation_tags')
      .insert({
        organization_id: igOrgId,
        name,
        color,
        created_by: profile?.id,
      });

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar a tag",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Tag criada",
        description: "A tag foi criada com sucesso",
      });
      await fetchTags();
    }
  };

  // Select conversation
  const selectConversation = (conversation: InstagramConversation | null) => {
    setSelectedConversation(conversation);
    if (conversation) {
      fetchMessages(conversation.id);
    } else {
      setMessages([]);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchConnections(),
        fetchConversations(),
        fetchQuickReplies(),
        fetchTags(),
      ]);
      setLoading(false);
    };

    if (igOrgId) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [igOrgId, fetchConnections, fetchConversations, fetchQuickReplies, fetchTags]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!igOrgId) return;

    const channel = supabase
      .channel('instagram_messages_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'instagram_messages',
        },
        (payload) => {
          if (selectedConversation && payload.new.conversation_id === selectedConversation.id) {
            fetchMessages(selectedConversation.id);
          }
          fetchConversations(); // Update conversation list
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [igOrgId, selectedConversation, fetchMessages, fetchConversations]);

  return {
    connections,
    conversations,
    messages,
    quickReplies,
    tags,
    selectedConversation,
    loading,
    sending,
    selectConversation,
    sendMessage,
    updateConversationStatus,
    transferConversation,
    addTagToConversation,
    removeTagFromConversation,
    updateConversationLead,
    createQuickReply,
    createTag,
    fetchConnections,
    fetchConversations,
    fetchQuickReplies,
    fetchTags,
    isAdmin,
  };
}
