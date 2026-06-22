import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Send, 
  Zap, 
  Tag, 
  MoreVertical, 
  CheckCircle, 
  Clock, 
  XCircle,
  UserPlus,
  Link2,
  Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  InstagramConversation, 
  InstagramMessage, 
  QuickReply,
  ConversationTag 
} from '@/hooks/useInstagramChat';

interface ChatWindowProps {
  conversation: InstagramConversation;
  messages: InstagramMessage[];
  quickReplies: QuickReply[];
  tags: ConversationTag[];
  sending: boolean;
  currentUserId?: string;
  onSendMessage: (content: string, quickReplyId?: string) => void;
  onUpdateStatus: (status: 'open' | 'pending' | 'closed') => void;
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onTransfer?: (userId: string) => void;
  onCreateLead?: (conversation: InstagramConversation) => void;
}

export function ChatWindow({
  conversation,
  messages,
  quickReplies,
  tags,
  sending,
  currentUserId,
  onSendMessage,
  onUpdateStatus,
  onAddTag,
  onRemoveTag,
  onTransfer,
  onCreateLead,
}: ChatWindowProps) {
  const [message, setMessage] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!message.trim() || sending) return;
    onSendMessage(message);
    setMessage('');
    setShowQuickReplies(false);
  };

  const handleQuickReply = (qr: QuickReply) => {
    onSendMessage(qr.content, qr.id);
    setShowQuickReplies(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const availableTags = tags.filter(
    tag => !conversation.tags?.some(t => t.id === tag.id)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={conversation.participant_profile_picture || undefined} />
            <AvatarFallback>
              {conversation.participant_name?.[0] || conversation.participant_username?.[0] || '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">
              {conversation.participant_name || conversation.participant_username || 'Usuário'}
            </h3>
            {conversation.participant_username && (
              <p className="text-sm text-muted-foreground">
                @{conversation.participant_username}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tags dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Tag className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {conversation.tags?.map(tag => (
                <DropdownMenuItem
                  key={tag.id}
                  onClick={() => onRemoveTag(tag.id)}
                  className="flex items-center justify-between"
                >
                  <span style={{ color: tag.color }}>{tag.name}</span>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuItem>
              ))}
              {conversation.tags && conversation.tags.length > 0 && availableTags.length > 0 && (
                <DropdownMenuSeparator />
              )}
              {availableTags.map(tag => (
                <DropdownMenuItem
                  key={tag.id}
                  onClick={() => onAddTag(tag.id)}
                >
                  <span style={{ color: tag.color }}>{tag.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onUpdateStatus('open')}>
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                Marcar como aberta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onUpdateStatus('pending')}>
                <Clock className="h-4 w-4 mr-2 text-yellow-500" />
                Marcar como pendente
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onUpdateStatus('closed')}>
                <XCircle className="h-4 w-4 mr-2 text-muted-foreground" />
                Encerrar conversa
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <UserPlus className="h-4 w-4 mr-2" />
                Transferir
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {conversation.lead_id ? (
                <DropdownMenuItem>
                  <Link2 className="h-4 w-4 mr-2" />
                  Ver lead vinculado
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onCreateLead?.(conversation)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar como Lead
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg, index) => {
            const isOutgoing = msg.direction === 'outgoing';
            const showDate = index === 0 || 
              format(new Date(messages[index - 1].sent_at), 'yyyy-MM-dd') !== 
              format(new Date(msg.sent_at), 'yyyy-MM-dd');

            return (
              <React.Fragment key={msg.id}>
                {showDate && (
                  <div className="flex justify-center">
                    <Badge variant="secondary" className="text-xs">
                      {format(new Date(msg.sent_at), "d 'de' MMMM", { locale: ptBR })}
                    </Badge>
                  </div>
                )}
                <div className={cn(
                  "flex gap-2",
                  isOutgoing ? "justify-end" : "justify-start"
                )}>
                  {!isOutgoing && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={conversation.participant_profile_picture || undefined} />
                      <AvatarFallback className="text-xs">
                        {conversation.participant_name?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className={cn(
                    "max-w-[70%] rounded-2xl px-4 py-2",
                    isOutgoing 
                      ? "bg-primary text-primary-foreground rounded-br-md" 
                      : "bg-muted rounded-bl-md"
                  )}>
                    {msg.message_type === 'image' && msg.media_url && (
                      <img 
                        src={msg.media_url} 
                        alt="Imagem" 
                        className="max-w-full rounded-lg mb-2"
                      />
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={cn(
                      "text-xs mt-1",
                      isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {format(new Date(msg.sent_at), 'HH:mm')}
                      {isOutgoing && msg.sender?.name && (
                        <span className="ml-2">• {msg.sender.name}</span>
                      )}
                    </p>
                  </div>
                  {isOutgoing && msg.sender && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={msg.sender.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {msg.sender.name?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Quick replies panel */}
      {showQuickReplies && quickReplies.length > 0 && (
        <div className="border-t bg-muted/50 p-3 max-h-40 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((qr) => (
              <Button
                key={qr.id}
                variant="outline"
                size="sm"
                onClick={() => handleQuickReply(qr)}
                className="text-xs"
              >
                {qr.shortcut && <span className="font-mono mr-1">/{qr.shortcut}</span>}
                {qr.title}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t bg-card">
        <div className="flex items-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowQuickReplies(!showQuickReplies)}
            className={cn(showQuickReplies && "bg-accent")}
          >
            <Zap className="h-4 w-4" />
          </Button>

          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
            />
          </div>

          <Button 
            onClick={handleSend} 
            disabled={!message.trim() || sending}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
