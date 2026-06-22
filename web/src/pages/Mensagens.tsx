import React, { useState, useEffect } from 'react';
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Instagram, 
  Search, 
  Inbox, 
  Clock, 
  CheckCircle, 
  User,
  MessageSquare,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { useInstagramChat } from '@/hooks/useInstagramChat';
import { ConversationList } from '@/components/instagram/ConversationList';
import { ChatWindow } from '@/components/instagram/ChatWindow';
import { AddLeadModal } from '@/components/modals/AddLeadModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseLeads } from '@/hooks/useSupabaseLeads';

type FilterType = 'all' | 'open' | 'pending' | 'closed' | 'mine';

export default function Mensagens() {
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const { addLead } = useSupabaseLeads();
  const {
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
    addTagToConversation,
    removeTagFromConversation,
    updateConversationLead,
    fetchConnections,
  } = useInstagramChat();

  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [showCreateLeadModal, setShowCreateLeadModal] = useState(false);

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && state) {
      handleOAuthCallback(code);
    }
  }, []);

  const handleConnect = async () => {
    if (!isAdmin) {
      toast({
        title: "Acesso restrito",
        description: "Apenas administradores podem conectar contas do Instagram",
        variant: "destructive",
      });
      return;
    }

    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('instagram-connect', {
        body: {
          action: 'get_oauth_url',
          redirectUri: `${window.location.origin}/mensagens`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({
        title: "Erro ao conectar",
        description: error.message || "Não foi possível iniciar a conexão com o Instagram",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    setConnecting(true);
    try {
      // Exchange code for token
      const { data: exchangeData, error: exchangeError } = await supabase.functions.invoke('instagram-connect', {
        body: {
          action: 'exchange_code',
          code,
          redirectUri: `${window.location.origin}/mensagens`,
        },
      });

      if (exchangeError) throw exchangeError;

      if (exchangeData?.pages?.length > 0) {
        // Save the first page with Instagram
        const page = exchangeData.pages[0];
        const { error: saveError } = await supabase.functions.invoke('instagram-connect', {
          body: {
            action: 'save_connection',
            page,
          },
        });

        if (saveError) throw saveError;

        toast({
          title: "Instagram conectado!",
          description: `Conta @${page.instagram_business_account?.username} conectada com sucesso`,
        });

        // Refresh connections
        fetchConnections();
      }

      // Clean URL
      window.history.replaceState({}, document.title, '/mensagens');
    } catch (error: any) {
      console.error('OAuth callback error:', error);
      toast({
        title: "Erro na conexão",
        description: error.message || "Não foi possível completar a conexão com o Instagram",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.participant_name?.toLowerCase().includes(query) ||
      conv.participant_username?.toLowerCase().includes(query) ||
      conv.last_message_preview?.toLowerCase().includes(query)
    );
  });

  const getFilterCount = (filterType: FilterType) => {
    switch (filterType) {
      case 'open':
        return conversations.filter(c => c.status === 'open').length;
      case 'pending':
        return conversations.filter(c => c.status === 'pending').length;
      case 'closed':
        return conversations.filter(c => c.status === 'closed').length;
      case 'mine':
        return conversations.filter(c => c.assigned_to === profile?.id).length;
      default:
        return conversations.length;
    }
  };

  // Check if Instagram is connected
  const hasConnection = connections.length > 0;

  return (
    <div className="h-[calc(100vh-64px)] md:p-6 pb-16 md:pb-6">
      <MobileHeader title="Mensagens" />
      
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-poppins font-bold text-foreground mb-2">
            Mensagens
          </h1>
          <p className="text-muted-foreground font-poppins">
            Central de atendimento do Instagram
          </p>
        </div>
        {connections[0] && (
          <Badge variant="outline" className="gap-2 py-1.5 px-3">
            <Instagram className="h-3 w-3" />
            @{connections[0].instagram_username}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !hasConnection ? (
        <Card className="max-w-lg mx-auto mt-8">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center mx-auto mb-6">
              <Instagram className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-semibold mb-3">Conecte seu Instagram</h2>
            <p className="text-muted-foreground max-w-sm mx-auto mb-8">
              Conecte sua conta comercial do Instagram para atender seus clientes diretamente por aqui.
            </p>
            <Button 
              size="lg" 
              onClick={handleConnect} 
              disabled={connecting}
              className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:from-purple-600 hover:via-pink-600 hover:to-orange-500"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <Instagram className="h-5 w-5 mr-2" />
                  Conectar com Facebook
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Você será redirecionado para fazer login no Facebook
            </p>
            {!isAdmin && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                Apenas administradores podem conectar novas contas
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-200px)]">
          {/* Conversation List */}
          <Card className="lg:col-span-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar conversas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Filters */}
              <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
                <TabsList className="w-full grid grid-cols-5">
                  <TabsTrigger value="all" className="text-xs px-1">
                    Todas
                  </TabsTrigger>
                  <TabsTrigger value="open" className="text-xs px-1">
                    <span className="flex items-center gap-1">
                      <Inbox className="h-3 w-3" />
                      {getFilterCount('open')}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs px-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getFilterCount('pending')}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="closed" className="text-xs px-1">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {getFilterCount('closed')}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="mine" className="text-xs px-1">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {getFilterCount('mine')}
                    </span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea className="flex-1">
              <ConversationList
                conversations={filteredConversations}
                selectedId={selectedConversation?.id || null}
                onSelect={selectConversation}
                filter={filter}
                currentUserId={profile?.id}
              />
            </ScrollArea>
          </Card>

          {/* Chat Window */}
          <Card className="lg:col-span-2 flex flex-col overflow-hidden">
            {selectedConversation ? (
              <ChatWindow
                conversation={selectedConversation}
                messages={messages}
                quickReplies={quickReplies}
                tags={tags}
                sending={sending}
                currentUserId={profile?.id}
                onSendMessage={sendMessage}
                onUpdateStatus={(status) => updateConversationStatus(selectedConversation.id, status)}
                onAddTag={(tagId) => addTagToConversation(selectedConversation.id, tagId)}
                onRemoveTag={(tagId) => removeTagFromConversation(selectedConversation.id, tagId)}
                onCreateLead={() => setShowCreateLeadModal(true)}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Selecione uma conversa</p>
                  <p className="text-sm">Escolha uma conversa na lista para começar</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modal para criar lead a partir do Instagram */}
      <AddLeadModal
        open={showCreateLeadModal}
        onOpenChange={setShowCreateLeadModal}
        onSave={async (leadData) => {
          // Pre-fill with Instagram data
          const dataWithInstagram = {
            ...leadData,
            name: leadData.name || selectedConversation?.participant_name || '',
            source: 'Instagram',
          };
          
          await addLead(dataWithInstagram);
          
          toast({
            title: "Lead criado",
            description: "O lead foi criado a partir da conversa do Instagram",
          });
        }}
      />
    </div>
  );
}
