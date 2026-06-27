import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';

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
  const { isAdmin, orgId: authOrgId } = useAuth();
  const { toast } = useToast();
  const api = useApi();
  const igOrgId = authOrgId;

  const [connections, setConnections] = useState<InstagramConnection[]>([]);
  const [conversations] = useState<InstagramConversation[]>([]);
  const [messages] = useState<InstagramMessage[]>([]);
  const [quickReplies] = useState<QuickReply[]>([]);
  const [tags] = useState<ConversationTag[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<InstagramConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchConnections = useCallback(async () => {
    if (!igOrgId) return;
    const data = await api.instagramConnections.list().catch(() => []);
    setConnections((data || []).map((c: any) => ({
      id: c.id,
      organization_id: c.organizationId || igOrgId,
      instagram_business_account_id: c.instagramBusinessAccountId || '',
      page_id: c.pageId || '',
      page_name: c.pageName || null,
      instagram_username: c.instagramUsername || null,
      profile_picture_url: c.profilePictureUrl || null,
      is_active: c.isActive ?? true,
      created_at: c.createdAt || '',
    })) as InstagramConnection[]);
  }, [igOrgId]);

  const fetchConversations = useCallback(async () => {
    // instagram_conversations not in current API — return empty
  }, []);

  const fetchMessages = useCallback(async (_conversationId: string) => {
    // instagram_messages not in current API
  }, []);

  const fetchQuickReplies = useCallback(async () => {
    // instagram_quick_replies not in current API
  }, []);

  const fetchTags = useCallback(async () => {
    // instagram_conversation_tags not in current API
  }, []);

  const sendMessage = async (_content: string, _quickReplyId?: string) => {
    setSending(true);
    toast({ title: "Não disponível", description: "Instagram DM não disponível no momento", variant: "destructive" });
    setSending(false);
  };

  const updateConversationStatus = async (_conversationId: string, _status: 'open' | 'pending' | 'closed') => {
    toast({ title: "Não disponível", description: "Atualização de status Instagram não disponível", variant: "destructive" });
  };

  const transferConversation = async (_conversationId: string, _newUserId: string) => {
    toast({ title: "Não disponível", description: "Transferência Instagram não disponível", variant: "destructive" });
  };

  const addTagToConversation = async (_conversationId: string, _tagId: string) => { /* no-op */ };
  const removeTagFromConversation = async (_conversationId: string, _tagId: string) => { /* no-op */ };

  const updateConversationLead = async (_conversationId: string, _leadId: string) => {
    toast({ title: "Não disponível", description: "Vinculação de lead Instagram não disponível", variant: "destructive" });
    return false;
  };

  const createQuickReply = async (_title: string, _content: string, _shortcut?: string, _category?: string) => {
    toast({ title: "Não disponível", description: "Respostas rápidas Instagram não disponíveis", variant: "destructive" });
  };

  const createTag = async (_name: string, _color: string) => {
    toast({ title: "Não disponível", description: "Tags Instagram não disponíveis", variant: "destructive" });
  };

  const selectConversation = (conversation: InstagramConversation | null) => {
    setSelectedConversation(conversation);
    if (conversation) fetchMessages(conversation.id);
  };

  useEffect(() => {
    if (igOrgId) {
      fetchConnections().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [igOrgId, fetchConnections]);

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
