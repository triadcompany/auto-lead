import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Circle, Clock, CheckCircle, User } from 'lucide-react';
import { InstagramConversation } from '@/hooks/useInstagramChat';

interface ConversationListProps {
  conversations: InstagramConversation[];
  selectedId: string | null;
  onSelect: (conversation: InstagramConversation) => void;
  filter: 'all' | 'open' | 'pending' | 'closed' | 'mine';
  currentUserId?: string;
}

export function ConversationList({ 
  conversations, 
  selectedId, 
  onSelect, 
  filter,
  currentUserId 
}: ConversationListProps) {
  const filteredConversations = conversations.filter(conv => {
    if (filter === 'all') return true;
    if (filter === 'mine') return conv.assigned_to === currentUserId;
    return conv.status === filter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Circle className="h-2 w-2 fill-green-500 text-green-500" />;
      case 'pending':
        return <Clock className="h-2 w-2 text-yellow-500" />;
      case 'closed':
        return <CheckCircle className="h-2 w-2 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'normal':
        return 'bg-blue-500';
      case 'low':
        return 'bg-gray-400';
      default:
        return 'bg-blue-500';
    }
  };

  if (filteredConversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <User className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">Nenhuma conversa encontrada</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {filteredConversations.map((conversation) => (
        <div
          key={conversation.id}
          onClick={() => onSelect(conversation)}
          className={cn(
            "p-4 cursor-pointer transition-colors hover:bg-accent/50",
            selectedId === conversation.id && "bg-accent"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={conversation.participant_profile_picture || undefined} />
                <AvatarFallback>
                  {conversation.participant_name?.[0] || conversation.participant_username?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                getPriorityColor(conversation.priority)
              )} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-sm truncate">
                    {conversation.participant_name || conversation.participant_username || 'Usuário'}
                  </span>
                  {getStatusIcon(conversation.status)}
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  {conversation.unread_count > 0 && (
                    <Badge variant="default" className="h-5 min-w-5 flex items-center justify-center text-xs px-1.5">
                      {conversation.unread_count}
                    </Badge>
                  )}
                  {conversation.last_message_at && (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conversation.last_message_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                  )}
                </div>
              </div>

              {conversation.participant_username && conversation.participant_name && (
                <p className="text-xs text-muted-foreground">
                  @{conversation.participant_username}
                </p>
              )}

              <p className="text-sm text-muted-foreground truncate mt-1">
                {conversation.last_message_preview || 'Nova conversa'}
              </p>

              {/* Tags */}
              {conversation.tags && conversation.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {conversation.tags.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="text-xs px-1.5 py-0"
                      style={{ borderColor: tag.color, color: tag.color }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                  {conversation.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      +{conversation.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              {/* Assigned user */}
              {conversation.assigned_user && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{conversation.assigned_user.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
