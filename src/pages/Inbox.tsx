import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useInbox, InboxThread, InboxMessage, ConversationStatus } from '@/hooks/useInbox';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrgSettings } from '@/hooks/useOrgSettings';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isYesterday, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  MessageSquare,
  Search,
  User,
  Users,
  CheckCheck,
  ArrowLeft,
  Loader2,
  Inbox as InboxIcon,
  UserMinus,
  ChevronDown,
  ExternalLink,
  Plus,
  Sparkles,
  Bot,
  Pause,
  Play,
  AlertCircle,
  RotateCcw,
  Trash2,
  Lock,
  Unlock,
  CheckCircle,
  Clock,
  Circle,
  XCircle,
  HandMetal,
  MoreHorizontal,
  FileText,
  Download,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CreateLeadFromInboxModal } from '@/components/inbox/CreateLeadFromInboxModal';
import { AiSuggestionPanel } from '@/components/inbox/AiSuggestionPanel';
import { ConversationIntelligenceBadge } from '@/components/inbox/ConversationIntelligenceBadge';
import { AudioPlayer } from '@/components/inbox/AudioPlayer';
import { ImageLightbox } from '@/components/inbox/ImageLightbox';
import { InboxComposer } from '@/components/inbox/InboxComposer';
import { NoteCard } from '@/components/inbox/NoteCard';
import { InboxTaskCard } from '@/components/inbox/InboxTaskCard';
import { AppointmentCard } from '@/components/inbox/AppointmentCard';
import { useConversationNotes } from '@/hooks/useConversationNotes';
import { useConversationTimeline, TimelineItem } from '@/hooks/useConversationTimeline';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

const BLOCK_REASON_LABELS: Record<string, string> = {
  throttle_active: 'Throttle ativo',
  max_ai_replies_without_lead_response: 'Máx. respostas sem retorno do lead',
  ai_state_human_active: 'Humano assumiu',
  idempotency_duplicate: 'Mensagem já processada',
  debounce_waiting: 'Debounce (msg mais recente chegou)',
  sensitive_stage: 'Etapa sensível',
  ai_mode_not_auto: 'Modo IA não é AUTO',
  missing_context: 'Contexto insuficiente',
};

// ── Helpers ──

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.substring(2, 4);
    const num = digits.substring(4);
    return `(${ddd}) ${num.substring(0, 5)}-${num.substring(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.substring(2, 4);
    const num = digits.substring(4);
    return `(${ddd}) ${num.substring(0, 4)}-${num.substring(4)}`;
  }
  if (digits.length === 11) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}`;
  }
  return phone;
}

function getContactDisplay(thread: InboxThread): { name: string; subtitle: string } {
  const formattedPhone = formatPhone(thread.contact_phone);
  if (thread.is_group) {
    const fallback = `Grupo (${(thread.contact_phone || '').slice(-4) || '?'})`;
    const groupLabel = thread.group_name || thread.contact_name || fallback;
    return { name: groupLabel, subtitle: 'Grupo do WhatsApp' };
  }
  if (thread.contact_name) {
    return { name: thread.contact_name, subtitle: formattedPhone };
  }
  return { name: formattedPhone, subtitle: '' };
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Deterministic HSL color from a string (group participant identification)
function colorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

function formatMessageTime(dateStr: string) {
  const date = parseISO(dateStr);
  return format(date, 'HH:mm');
}

function formatThreadTime(dateStr: string | null) {
  if (!dateStr) return '';
  const date = parseISO(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Ontem';
  return format(date, 'dd/MM', { locale: ptBR });
}

function formatDateSeparator(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, "dd 'de' MMMM", { locale: ptBR });
}

// ── Status helpers ──

const STATUS_CONFIG: Record<ConversationStatus, { label: string; icon: React.ReactNode; color: string }> = {
  open: { label: 'Aberta', icon: <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />, color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
  in_progress: { label: 'Em atendimento', icon: <HandMetal className="h-2.5 w-2.5 text-blue-500" />, color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' },
  waiting_customer: { label: 'Aguardando', icon: <Clock className="h-2.5 w-2.5 text-amber-500" />, color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  closed: { label: 'Finalizada', icon: <CheckCircle className="h-2.5 w-2.5 text-muted-foreground" />, color: 'bg-muted text-muted-foreground border-border' },
};

function StatusBadge({ status }: { status: ConversationStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border', config.color)}>
      {config.icon}
      {config.label}
    </span>
  );
}

// ── Thread List Item ──

function ThreadItem({
  thread,
  selected,
  onClick,
  assignedName,
}: {
  thread: InboxThread;
  selected: boolean;
  onClick: () => void;
  assignedName?: string;
}) {
  const { name, subtitle } = getContactDisplay(thread);
  const initials = getInitials(name);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-3 border-b border-border/50 transition-all duration-150',
        'hover:bg-accent/40',
        selected && 'bg-accent/60 border-l-2 border-l-primary'
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 flex-shrink-0">
          {thread.profile_picture_url && (
            <AvatarImage src={thread.profile_picture_url} alt={name} />
          )}
          <AvatarFallback className={cn(
            'text-xs font-semibold',
            thread.is_group ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-primary/10 text-primary'
          )}>
            {initials || (thread.is_group ? <Users className="h-4 w-4" /> : '?')}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              'text-sm truncate block',
              thread.unread_count > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'
            )}>
              {name}
            </span>
            <span className={cn(
              'text-[10px] whitespace-nowrap flex-shrink-0',
              thread.unread_count > 0 ? 'text-primary font-semibold' : 'text-muted-foreground'
            )}>
              {formatThreadTime(thread.last_message_at)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className={cn(
              'text-xs truncate',
              thread.unread_count > 0 ? 'text-foreground/80 font-medium' : 'text-muted-foreground'
            )}>
              {thread.last_message_preview || (subtitle || 'Sem mensagens')}
            </p>
            {thread.unread_count > 0 && (
              <Badge className="h-[18px] min-w-[18px] px-1 text-[10px] font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center flex-shrink-0">
                {thread.unread_count}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <StatusBadge status={thread.status} />
            {thread.locked_by && (
              <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-600 dark:text-amber-400">
                <Lock className="h-2.5 w-2.5" />
              </span>
            )}
            {thread.lead_id ? (
              <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold">
                Lead {thread.lead_stage_name ? `• ${thread.lead_stage_name}` : ''}
              </Badge>
            ) : (
              <>
                <User className="h-2.5 w-2.5 text-muted-foreground/60" />
                <span className={cn(
                  'text-[10px]',
                  assignedName ? 'text-muted-foreground/60' : 'text-destructive/70'
                )}>
                  {assignedName || 'Não atribuída'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Date Separator ──

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <div className="bg-muted/80 text-muted-foreground text-[11px] font-medium px-3 py-1 rounded-full">
        {formatDateSeparator(date)}
      </div>
    </div>
  );
}

// ── Mention formatter (replace @<digits> with @Name or @(formatted phone)) ──

function renderWithMentions(
  text: string,
  participants?: Map<string, string>,
): React.ReactNode {
  if (!text) return text;
  const parts: React.ReactNode[] = [];
  const regex = /@(\d{6,})/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const digits = match[1];
    const name =
      participants?.get(digits) ||
      participants?.get(digits.slice(-11)) ||
      participants?.get(digits.slice(-10)) ||
      null;
    const display = name ? `@${name}` : `@${formatPhone(digits)}`;
    parts.push(
      <span key={`m-${key++}`} className="text-primary font-semibold">
        {display}
      </span>,
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

// ── Message Bubble ──

function MessageBubble({
  message,
  showSender,
  isGroup,
  participants,
}: {
  message: InboxMessage;
  showSender?: boolean;
  isGroup?: boolean;
  participants: Map<string, string>;
}) {
  const isOutbound = message.direction === 'outbound';
  const isOptimistic = message.id.startsWith('temp-');
  const isAiGenerated = message.ai_generated === true;
  const senderLabel = message.sender_name || (message.sender_phone ? formatPhone(message.sender_phone) : '');
  const senderColor = senderLabel ? colorFromString(senderLabel) : undefined;
  const senderInitials = senderLabel ? getInitials(senderLabel) : '';
  const mediaUrl = message.media_url || null;
  const type = message.message_type || 'text';
  const isImage = type === 'image' && mediaUrl;
  const isVideo = type === 'video' && mediaUrl;
  const isAudio = type === 'audio' && mediaUrl;
  const isDocument = type === 'document' && mediaUrl;
  const showGroupSenderHeader = !!isGroup && !isOutbound && !!showSender && !!senderLabel;
  const indentForAvatar = !!isGroup && !isOutbound;

  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Caption: body text minus the auto-prefix label (e.g. "📷 Foto ")
  const stripped = (message.body || '').replace(/^(📷 Foto|🎥 Vídeo|🎵 Áudio|📄 Documento)\s*/u, '');
  const captionText = stripped && stripped !== (message.body || '') ? stripped : '';
  const fileName = (message.body || '').replace(/^📄 Documento\s*/u, '') || 'Arquivo';

  return (
    <div className={cn('flex mb-1.5', isOutbound ? 'justify-end' : 'justify-start')}>
      {indentForAvatar && (
        <div className="w-8 mr-2 flex-shrink-0 flex items-end">
          {showGroupSenderHeader ? (
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
              style={{ backgroundColor: senderColor }}
              aria-label={senderLabel}
            >
              {senderInitials || '?'}
            </div>
          ) : (
            <div className="h-7 w-7" aria-hidden />
          )}
        </div>
      )}

      <div className="flex flex-col max-w-[75%] min-w-0">
        {showGroupSenderHeader && (
          <div
            className="text-[11px] font-semibold mb-0.5 truncate px-1"
            style={{ color: senderColor }}
          >
            {senderLabel}
          </div>
        )}

        <div
          className={cn(
            'rounded-2xl text-sm shadow-sm overflow-hidden',
            (isImage || isVideo) ? 'p-1' : 'px-3.5 py-2',
            isOutbound
              ? isAiGenerated
                ? 'bg-primary/80 text-primary-foreground rounded-br-md border border-primary/30'
                : 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-card border border-border/50 rounded-bl-md',
            isOptimistic && 'opacity-70'
          )}
        >
          {isAiGenerated && (
            <div className={cn(
              'flex items-center gap-1 mb-1 text-[10px] font-medium px-2 pt-1',
              isOutbound ? 'text-primary-foreground/60' : 'text-muted-foreground'
            )}>
              <Bot className="h-3 w-3" />
              <span>IA</span>
            </div>
          )}

          {isImage && (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="block rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Abrir imagem"
            >
              <img
                src={mediaUrl!}
                alt={captionText || 'Imagem'}
                loading="lazy"
                className="block max-w-[280px] max-h-[200px] w-auto h-auto object-cover"
              />
            </button>
          )}

          {isVideo && (
            <video
              src={mediaUrl!}
              controls
              preload="metadata"
              className="rounded-xl max-h-80 w-full"
            />
          )}

          {isAudio && (
            <AudioPlayer
              src={mediaUrl!}
              durationMs={message.duration_ms}
              isOutbound={isOutbound}
            />
          )}

          {isDocument && (
            <a
              href={mediaUrl!}
              target="_blank"
              rel="noopener noreferrer"
              download
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors',
                isOutbound
                  ? 'bg-primary-foreground/10 hover:bg-primary-foreground/15'
                  : 'bg-muted/60 hover:bg-muted'
              )}
            >
              <div className={cn(
                'h-9 w-9 rounded-md flex items-center justify-center shrink-0',
                isOutbound ? 'bg-primary-foreground/15' : 'bg-background'
              )}>
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{fileName}</p>
                <p className={cn(
                  'text-[10px]',
                  isOutbound ? 'text-primary-foreground/60' : 'text-muted-foreground'
                )}>
                  Toque para abrir
                </p>
              </div>
              <Download className="h-3.5 w-3.5 opacity-70 shrink-0" />
            </a>
          )}

          {type === 'text' && (
            <p className="whitespace-pre-wrap break-words leading-relaxed">
              {renderWithMentions(message.body, participants)}
            </p>
          )}

          {(isImage || isVideo) && captionText && (
            <p className="whitespace-pre-wrap break-words leading-relaxed px-2.5 pt-1.5 pb-0.5 text-sm">
              {renderWithMentions(captionText, participants)}
            </p>
          )}

          <div
            className={cn(
              'flex items-center justify-end gap-1',
              (isImage || isVideo) ? 'px-2.5 pb-1.5 pt-0.5' : 'mt-0.5',
              isOutbound ? 'text-primary-foreground/50' : 'text-muted-foreground/60'
            )}
          >
            <span className="text-[10px]">{formatMessageTime(message.created_at)}</span>
            {isOutbound && (
              isOptimistic
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <CheckCheck className="h-3 w-3" />
            )}
          </div>
        </div>
      </div>

      {isImage && lightboxOpen && (
        <ImageLightbox
          src={mediaUrl!}
          alt={captionText || 'Imagem'}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

// ── Empty States ──

function EmptyThreadList() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <InboxIcon className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Nenhuma conversa</p>
      <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">
        As conversas aparecerão quando mensagens forem recebidas via WhatsApp
      </p>
    </div>
  );
}

function EmptyChat() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-5">
        <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
      </div>
      <h3 className="font-semibold text-foreground/80 text-lg">Selecione uma conversa</h3>
      <p className="text-sm text-muted-foreground/60 mt-2 max-w-[280px]">
        Escolha uma conversa na lista para visualizar e responder mensagens
      </p>
    </div>
  );
}

// ── Messages with date groups + timeline items ──

function MessagesList({
  messages,
  isGroup,
  timelineItems = [],
}: {
  messages: InboxMessage[];
  isGroup?: boolean;
  timelineItems?: TimelineItem[];
}) {
  // Build participants map (phone digits -> display name) from message history
  const participants = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of messages) {
      if (m.sender_phone && m.sender_name) {
        const digits = m.sender_phone.replace(/\D/g, '');
        if (digits && !map.has(digits)) map.set(digits, m.sender_name);
      }
    }
    return map;
  }, [messages]);

  const grouped = useMemo(() => {
    type Entry =
      | { type: 'date'; date: string }
      | { type: 'message'; message: InboxMessage; showSender?: boolean }
      | { type: 'timeline'; item: TimelineItem };

    // Merge messages and timeline items sorted by created_at
    const allEntries: { ts: string; entry: Entry }[] = [
      ...messages.map((m) => ({ ts: m.created_at, entry: { type: 'message' as const, message: m } })),
      ...timelineItems.map((t) => ({ ts: t.created_at, entry: { type: 'timeline' as const, item: t } })),
    ].sort((a, b) => a.ts.localeCompare(b.ts));

    const result: Entry[] = [];
    let lastDate: string | null = null;
    let lastSenderKey: string | null = null;

    for (const { ts, entry } of allEntries) {
      const isNewDay = !lastDate || !isSameDay(parseISO(lastDate), parseISO(ts));
      if (isNewDay) {
        result.push({ type: 'date', date: ts });
        lastDate = ts;
        lastSenderKey = null;
      }

      if (entry.type === 'message') {
        const senderKey =
          entry.message.direction === 'outbound'
            ? '__me__'
            : entry.message.sender_phone || entry.message.sender_name || '__unknown__';

        const showSender =
          !!isGroup && entry.message.direction !== 'outbound' && senderKey !== lastSenderKey;

        result.push({ type: 'message', message: entry.message, showSender });
        lastSenderKey = senderKey;
      } else {
        result.push(entry);
        lastSenderKey = null;
      }
    }

    return result;
  }, [messages, isGroup, timelineItems]);

  return (
    <>
      {grouped.map((item, i) => {
        if (item.type === 'date') {
          return <DateSeparator key={`date-${i}`} date={item.date} />;
        }
        if (item.type === 'timeline') {
          const t = item.item;
          if (t._type === 'note') return <NoteCard key={t.id} note={t.data} />;
          if (t._type === 'task') return <InboxTaskCard key={t.id} task={t.data} />;
          if (t._type === 'appointment') return <AppointmentCard key={t.id} appointment={t.data} />;
          return null;
        }
        return (
          <MessageBubble
            key={item.message.id}
            message={item.message}
            showSender={item.showSender}
            isGroup={isGroup}
            participants={participants}
          />
        );
      })}
    </>
  );
}

// ── AI Thinking Indicator ──

function AiThinkingIndicator({ startedAt }: { startedAt: string | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const isDelayed = elapsed > 40;

  return (
    <div className="flex justify-start mb-1.5">
      <div className={cn(
        'max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm rounded-bl-md border',
        isDelayed
          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
          : 'bg-muted/60 border-border/50'
      )}>
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          <span className={cn(
            'text-xs font-medium',
            isDelayed ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
          )}>
            {isDelayed ? 'IA está pensando mais que o esperado…' : 'IA está pensando…'}
          </span>
          <span className="flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Inbox Page ──

export default function InboxPage() {
  const {
    threads,
    messages,
    selectedThread,
    selectedThreadId,
    assignmentFilter,
    statusFilter,
    search,
    loadingThreads,
    loadingMessages,
    sending,
    isAdmin,
    orgMembers,
    profile,
    myProfileId,
    setAssignmentFilter,
    setStatusFilter,
    setSearch,
    selectThread,
    sendMessage,
    sendMedia,
    assignThread,
    canSendMessage,
    getLockedByName,
    createLeadFromConversation,
    toggleAiMode,
    resumeAi,
    refreshThreads,
    newMessageFlag,
    assumeConversation,
    releaseConversation,
    closeConversation,
  } = useInbox();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messageText, setMessageText] = useState('');
  const { settings: orgSettings, loading: orgSettingsLoading } = useOrgSettings();

  // Redirect if inbox is disabled
  useEffect(() => {
    if (!orgSettingsLoading && !orgSettings.inbox_enabled) {
      navigate('/dashboard', { replace: true });
    }
  }, [orgSettings.inbox_enabled, orgSettingsLoading, navigate]);

  // Auto-select thread by phone query param (e.g. from Kanban)
  useEffect(() => {
    const phoneParam = searchParams.get('phone');
    if (phoneParam && threads.length > 0 && !loadingThreads) {
      const match = threads.find(t => t.contact_phone.replace(/\D/g, '').includes(phoneParam));
      if (match) {
        selectThread(match.id);
      }
      // Clean up the param so it doesn't re-trigger
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, threads, loadingThreads, selectThread, setSearchParams]);
  const [assignPopoverOpen, setAssignPopoverOpen] = useState(false);
  const [createLeadModalOpen, setCreateLeadModalOpen] = useState(false);
  const [resetFirstTouchOpen, setResetFirstTouchOpen] = useState(false);
  const [resetAlsoDeleteLead, setResetAlsoDeleteLead] = useState(false);
  const [resettingFirstTouch, setResettingFirstTouch] = useState(false);
  const [firstTouchResetDone, setFirstTouchResetDone] = useState(false);
  const [ftStatusOpen, setFtStatusOpen] = useState(false);
  const [ftStatusData, setFtStatusData] = useState<any>(null);
  const [ftStatusLoading, setFtStatusLoading] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const canSend = canSendMessage(selectedThread);

  // ── Conversation timeline: notes, tasks, appointments ──
  const { notes, createNote } = useConversationNotes(selectedThreadId ?? null);

  const { data: conversationTasks = [] } = useQuery({
    queryKey: ['conversation-tasks', selectedThreadId],
    queryFn: async () => {
      if (!selectedThreadId) return [];
      const { data, error } = await (supabase as any).rpc('get_conversation_tasks', {
        p_conversation_id: selectedThreadId,
      });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!selectedThreadId,
  });

  const { data: conversationAppointments = [] } = useQuery({
    queryKey: ['conversation-appointments', selectedThreadId],
    queryFn: async () => {
      if (!selectedThreadId) return [];
      const { data, error } = await (supabase as any).rpc('get_conversation_appointments', {
        p_conversation_id: selectedThreadId,
      });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!selectedThreadId,
  });

  const timelineItems = useConversationTimeline(notes, conversationTasks, conversationAppointments);

  const queryClient = useQueryClient();

  const handleSaveNote = useCallback(async (content: string) => {
    await createNote(content);
    toast.success('Nota salva');
  }, [createNote]);

  const handleSaveTask = useCallback(async (taskData: {
    titulo: string;
    data_hora: string;
    descricao?: string;
    prioridade?: 'baixa' | 'media' | 'alta';
    responsavel_id?: string;
    organization_id: string;
  }) => {
    if (!selectedThreadId) return;
    try {
      const { error } = await (supabase as any).rpc('create_conversation_task', {
        p_conversation_id: selectedThreadId,
        p_titulo: taskData.titulo,
        p_data_hora: taskData.data_hora,
        p_descricao: taskData.descricao ?? null,
        p_prioridade: taskData.prioridade ?? null,
        p_responsavel_id: taskData.responsavel_id ?? null,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['conversation-tasks', selectedThreadId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa criada');
    } catch (err: any) {
      toast.error('Erro ao criar tarefa', { description: err.message });
      throw err;
    }
  }, [selectedThreadId, queryClient]);

  const handleSaveAppointment = useCallback(async (apptData: {
    datetime: string;
    tipo: string;
    duration_minutes?: number;
    anotacoes?: string;
    organization_id: string;
  }) => {
    if (!selectedThreadId) return;
    try {
      const { error } = await (supabase as any).rpc('create_conversation_appointment', {
        p_conversation_id: selectedThreadId,
        p_datetime: apptData.datetime,
        p_tipo: apptData.tipo,
        p_duration_minutes: apptData.duration_minutes ?? null,
        p_anotacoes: apptData.anotacoes ?? null,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['conversation-appointments', selectedThreadId] });
      toast.success('Agendamento criado');
    } catch (err: any) {
      toast.error('Erro ao criar agendamento', { description: err.message });
      throw err;
    }
  }, [selectedThreadId, queryClient]);

  // Query latest AI block reason for the selected conversation
  const { data: lastBlockedJob } = useQuery({
    queryKey: ['ai-block-reason', selectedThreadId],
    queryFn: async () => {
      if (!selectedThreadId) return null;
      const { data } = await (supabase as any)
        .from('ai_auto_reply_jobs')
        .select('id, status, error, result, processed_at')
        .eq('conversation_id', selectedThreadId)
        .eq('status', 'blocked')
        .order('processed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedThreadId && selectedThread?.ai_mode === 'auto',
    refetchInterval: 15000,
  });

  // Map profile.id -> name for assignment display
  const memberNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    orgMembers.forEach((m) => { map[m.id] = m.name; });
    return map;
  }, [orgMembers]);

  // Track scroll position to decide auto-scroll
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!el) return;
    const threshold = 80;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (isAtBottomRef.current) {
      setNewMsgCount(0);
    }
  }, []);

  // Auto-scroll only when at bottom, otherwise show indicator
  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewMsgCount(0);
    } else if (newMessageFlag > 0) {
      setNewMsgCount(c => c + 1);
    }
  }, [messages, newMessageFlag]);

  // Reset scroll state when switching conversations
  useEffect(() => {
    isAtBottomRef.current = true;
    setNewMsgCount(0);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' as any });
    }, 100);
  }, [selectedThreadId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    isAtBottomRef.current = true;
    setNewMsgCount(0);
  }, []);

  const handleSend = async () => {
    if (!messageText.trim() || sending || !canSend) return;
    const text = messageText;
    setMessageText('');
    try {
      await sendMessage(text);
    } catch {
      setMessageText(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAssign = async (profileId: string | null) => {
    if (!selectedThread) return;
    setAssignPopoverOpen(false);
    await assignThread(selectedThread.id, profileId);
  };

  const handleResetFirstTouch = async () => {
    if (!selectedThread || !profile?.organization_id) return;
    setResettingFirstTouch(true);
    try {
      const res = await supabase.functions.invoke('reset-first-touch', {
        body: {
          organization_id: profile.organization_id,
          phone: selectedThread.contact_phone,
          channel: 'whatsapp',
        },
      });

      if (res.error) throw new Error(res.error.message || 'Erro ao resetar');
      const data = res.data as any;
      if (!data?.ok) throw new Error(data?.error || 'Erro desconhecido');

      if (resetAlsoDeleteLead && selectedThread.lead_id) {
        await supabase
          .from('conversations')
          .update({ lead_id: null } as any)
          .eq('id', selectedThread.id)
          .eq('organization_id', profile.organization_id);

        await supabase
          .from('leads')
          .delete()
          .eq('id', selectedThread.lead_id)
          .eq('organization_id', profile.organization_id);
      }

      if (data.deleted_count > 0) {
        toast.success(`Reset feito. ${data.deleted_count} registro(s) removido(s). A próxima mensagem pode disparar a automação.`);
        setFirstTouchResetDone(true);
        setTimeout(() => setFirstTouchResetDone(false), 15000);
      } else {
        toast.warning('Nada para resetar. O first-touch já foi removido ou o telefone não corresponde.');
      }
      refreshThreads();
    } catch (err: any) {
      console.error('Error resetting first touch:', err);
      toast.error(err.message || 'Erro ao resetar primeira interação');
    } finally {
      setResettingFirstTouch(false);
      setResetFirstTouchOpen(false);
      setResetAlsoDeleteLead(false);
    }
  };

  const handleCheckFirstTouchStatus = async () => {
    if (!selectedThread || !profile?.organization_id) return;
    setFtStatusLoading(true);
    setFtStatusData(null);
    setFtStatusOpen(true);
    try {
      const res = await supabase.functions.invoke('reset-first-touch', {
        body: {
          organization_id: profile.organization_id,
          phone: selectedThread.contact_phone,
          status_only: true,
        },
      });
      setFtStatusData(res.data ?? { ok: false, error: res.error?.message });
    } catch (err: any) {
      setFtStatusData({ ok: false, error: err.message });
    } finally {
      setFtStatusLoading(false);
    }
  };

  const assignmentOptions: { key: 'all' | 'mine' | 'unassigned'; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'mine', label: 'Minhas' },
    { key: 'unassigned', label: 'Não atribuídas' },
  ];

  const statusOptions: { key: 'all' | 'open' | 'in_progress' | 'waiting_customer' | 'closed'; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'open', label: 'Abertas' },
    { key: 'in_progress', label: 'Em atendimento' },
    { key: 'waiting_customer', label: 'Aguardando' },
    { key: 'closed', label: 'Finalizadas' },
  ];

  const selectedContact = selectedThread ? getContactDisplay(selectedThread) : null;
  const assignedMemberName = selectedThread?.assigned_to
    ? memberNameMap[selectedThread.assigned_to]
    : null;

  const totalUnread = threads.reduce((sum, t) => sum + (t.unread_count || 0), 0);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* ── Left Panel: Conversation List ── */}
      <div
        className={cn(
          'w-full md:w-80 lg:w-96 border-r border-border flex flex-col bg-card/50',
          selectedThreadId && 'hidden md:flex'
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Inbox</h2>
            <div className="flex items-center gap-2">
              {totalUnread > 0 && (
                <Badge className="bg-primary text-primary-foreground text-xs">
                  {totalUnread}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {threads.length} conversas
              </Badge>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm bg-background"
            />
          </div>

          {/* Filters — Group 1: Assignment (chips) */}
          <div className="flex flex-wrap gap-1.5">
            {assignmentOptions.map((f) => {
              const active = assignmentFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setAssignmentFilter(f.key)}
                  className={cn(
                    'h-7 px-3 text-xs font-medium rounded-full border transition-colors whitespace-nowrap',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted'
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Filters — Group 2: Status (tabs with underline) */}
          <div className="flex items-center gap-0 border-b border-border -mb-px overflow-x-auto">
            {statusOptions.map((f) => {
              const active = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    'px-2.5 py-1.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
                    active
                      ? 'text-primary border-primary'
                      : 'text-muted-foreground border-transparent hover:text-foreground'
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Thread List */}
        <ScrollArea className="flex-1">
          {loadingThreads ? (
            <div className="p-3 space-y-1">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <EmptyThreadList />
          ) : (
            threads.map((thread) => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                selected={thread.id === selectedThreadId}
                onClick={() => selectThread(thread.id)}
                assignedName={thread.assigned_to ? memberNameMap[thread.assigned_to] : undefined}
              />
            ))
          )}
        </ScrollArea>
      </div>

      {/* ── Right Panel: Chat ── */}
      <div
        className={cn(
          'flex-1 flex flex-col',
          !selectedThreadId && 'hidden md:flex'
        )}
      >
        {!selectedThread ? (
          <EmptyChat />
        ) : (
          <>
            {/* Chat Header — 3-column layout */}
            <div className="px-3 py-2.5 border-b border-border flex items-center gap-4 bg-card/50">
              {/* Mobile back button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8 flex-shrink-0"
                onClick={() => selectThread('')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              {/* ── LEFT: Identification ── */}
              <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
                <Avatar className="h-8 w-8">
                  {selectedThread.profile_picture_url && (
                    <AvatarImage src={selectedThread.profile_picture_url} alt={selectedContact?.name || ''} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                    {getInitials(selectedContact?.name || '?')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-sm truncate leading-tight">{selectedContact?.name}</h3>
                    {selectedThread.is_group && (
                      <Badge
                        variant="secondary"
                        className="h-4 px-1.5 text-[9px] font-medium gap-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                      >
                        <Users className="h-2.5 w-2.5" />
                        Grupo
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {selectedThread.is_group && selectedThread.group_participants_count ? (
                      <span className="text-[11px] text-muted-foreground truncate">
                        {selectedThread.group_participants_count} participantes
                      </span>
                    ) : selectedContact?.subtitle ? (
                      <span className="text-[11px] text-muted-foreground truncate">{selectedContact.subtitle}</span>
                    ) : null}
                    {assignedMemberName ? (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-medium">
                        {assignedMemberName}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-medium border-primary/40 text-primary">
                        Não atribuída
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* ── CENTER: Status + Responsible ── */}
              <div className="hidden md:flex items-center gap-2 flex-1 justify-center">
                <StatusBadge status={selectedThread.status} />
                {(() => {
                  const lockedName = getLockedByName(selectedThread);
                  if (!lockedName) return null;
                  return (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <Lock className="h-2.5 w-2.5" />
                            {lockedName}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Esta conversa está sendo atendida por {lockedName}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })()}
                {isAdmin && (
                  <Popover open={assignPopoverOpen} onOpenChange={setAssignPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1 px-2">
                        <User className="h-3 w-3" />
                        Responsável
                        <ChevronDown className="h-2.5 w-2.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-52 p-1" align="center">
                      <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">Atribuir para</div>
                      {orgMembers.map((member) => (
                        <button
                          key={member.id}
                          className={cn(
                            'w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent transition-colors flex items-center gap-2',
                            selectedThread.assigned_to === member.id && 'bg-accent font-medium'
                          )}
                          onClick={() => handleAssign(member.id)}
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[9px] bg-muted">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          {member.name}
                          {member.id === myProfileId && (
                            <span className="text-[10px] text-muted-foreground ml-auto">(você)</span>
                          )}
                        </button>
                      ))}
                      {selectedThread.assigned_to && (
                        <>
                          <div className="border-t border-border my-1" />
                          <button
                            className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-2"
                            onClick={() => handleAssign(null)}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                            Remover atribuição
                          </button>
                        </>
                      )}
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {/* ── RIGHT: Actions ── */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Primary CTA */}
                {selectedThread.assigned_to !== myProfileId ? (
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => assumeConversation(selectedThread.id)}
                  >
                    <HandMetal className="h-3 w-3" />
                    Assumir
                  </Button>
                ) : null}

                {/* Secondary: Finalizar */}
                {selectedThread.status !== 'closed' && (selectedThread.assigned_to === myProfileId || isAdmin) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => closeConversation(selectedThread.id)}
                  >
                    <XCircle className="h-3 w-3" />
                    Finalizar
                  </Button>
                )}

                {/* Secondary: Liberar (admin) */}
                {isAdmin && selectedThread.locked_by && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => releaseConversation(selectedThread.id)}
                  >
                    <Unlock className="h-3 w-3" />
                    Liberar
                  </Button>
                )}

                {/* Tertiary: More actions dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {/* Lead action */}
                    {selectedThread.lead_id ? (
                      <DropdownMenuItem onClick={() => navigate(`/oportunidades?leadId=${selectedThread.lead_id}`)}>
                        <ExternalLink className="h-3.5 w-3.5 mr-2" />
                        Ver Lead
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => setCreateLeadModalOpen(true)}>
                        <Plus className="h-3.5 w-3.5 mr-2" />
                        Criar Lead
                      </DropdownMenuItem>
                    )}

                    {/* AI mode */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Sparkles className="h-3.5 w-3.5 mr-2" />
                        IA: {selectedThread.ai_mode === 'auto' ? 'Autônoma' : selectedThread.ai_mode === 'assisted' ? 'Assistente' : 'Desligada'}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {[
                          { mode: 'off', label: 'Desligada', icon: '⏸' },
                          { mode: 'assisted', label: 'Assistente', icon: '💡' },
                          { mode: 'auto', label: 'Autônoma', icon: '🤖' },
                        ].map(opt => (
                          <DropdownMenuItem
                            key={opt.mode}
                            onClick={() => toggleAiMode(selectedThread.id, opt.mode)}
                            className={cn(selectedThread.ai_mode === opt.mode && 'bg-accent font-medium')}
                          >
                            <span className="mr-2">{opt.icon}</span>
                            {opt.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={refreshThreads}>
                      <RotateCcw className="h-3.5 w-3.5 mr-2" />
                      Atualizar
                    </DropdownMenuItem>

                    {/* Admin: Reset first touch */}
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleCheckFirstTouchStatus}>
                          <Search className="h-3.5 w-3.5 mr-2" />
                          Status first-touch
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setResetFirstTouchOpen(true)}
                          className="text-destructive focus:text-destructive"
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-2" />
                          Resetar first-touch
                        </DropdownMenuItem>
                        {firstTouchResetDone && (
                          <div className="px-2 py-1">
                            <Badge variant="outline" className="h-5 text-[9px] font-medium border-emerald-500 text-emerald-600 dark:text-emerald-400">
                              First-touch resetado ✓
                            </Badge>
                          </div>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* AI Auto Banner */}
            {selectedThread.ai_mode === 'auto' && (
              <div className={cn(
                'px-4 py-2 flex items-center justify-between text-xs border-b',
                selectedThread.ai_state === 'human_active'
                  ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              )}>
                <div className="flex items-center gap-1.5">
                  {selectedThread.ai_state === 'human_active' ? (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      <span className="font-medium">Humano assumiu — IA pausada</span>
                    </>
                  ) : (
                    <>
                      <Bot className="h-3.5 w-3.5" />
                      <span className="font-medium">IA Autônoma ativa</span>
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold">SLA 10-40s</span>
                      {lastBlockedJob && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] cursor-help">
                                <AlertCircle className="h-3 w-3" />
                                {BLOCK_REASON_LABELS[(lastBlockedJob.result as any)?.block_reason] || lastBlockedJob.error || 'Bloqueada'}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs text-xs">
                              <p className="font-medium mb-1">Último bloqueio da IA:</p>
                              <p>{lastBlockedJob.error}</p>
                              {(lastBlockedJob.result as any)?.seconds_remaining && (
                                <p className="mt-1 text-muted-foreground">Aguardando {(lastBlockedJob.result as any).seconds_remaining}s</p>
                              )}
                              {(lastBlockedJob.result as any)?.ai_reply_count_since_last_lead !== undefined && (
                                <p className="mt-1 text-muted-foreground">Respostas sem retorno: {(lastBlockedJob.result as any).ai_reply_count_since_last_lead}</p>
                              )}
                              <p className="mt-1 text-muted-foreground/60">{lastBlockedJob.processed_at ? format(parseISO(lastBlockedJob.processed_at), 'HH:mm:ss') : ''}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </>
                  )}
                </div>
                {selectedThread.ai_state === 'human_active' ? (
                  <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => resumeAi(selectedThread.id)}>
                    <Play className="h-3 w-3" /> Retomar IA
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => toggleAiMode(selectedThread.id, 'off')}>
                    <Pause className="h-3 w-3" /> Pausar
                  </Button>
                )}
              </div>
            )}

            {/* Conversation Intelligence Badge */}
            {profile?.organization_id && (
              <ConversationIntelligenceBadge
                conversationId={selectedThread.id}
                organizationId={profile.organization_id}
              />
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-2 relative" ref={scrollAreaRef} onScrollCapture={handleScroll}>
              {loadingMessages ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 && timelineItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma mensagem nesta conversa</p>
                </div>
              ) : (
                <MessagesList messages={messages} isGroup={selectedThread.is_group} timelineItems={timelineItems} />
              )}

              {/* AI Thinking Indicator */}
              {selectedThread.ai_mode === 'auto' && selectedThread.ai_pending && (
                <AiThinkingIndicator startedAt={selectedThread.ai_pending_started_at} />
              )}

              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* New messages indicator */}
            {newMsgCount > 0 && (
              <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-10">
                <Button
                  size="sm"
                  className="rounded-full shadow-lg gap-1.5 text-xs"
                  onClick={scrollToBottom}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  {newMsgCount} nova{newMsgCount > 1 ? 's' : ''} mensage{newMsgCount > 1 ? 'ns' : 'm'}
                </Button>
              </div>
            )}

            {/* AI Suggestion Panel */}
            {selectedThread.ai_mode === 'assisted' && profile?.organization_id && (
              <AiSuggestionPanel
                conversationId={selectedThread.id}
                organizationId={profile.organization_id}
                aiMode={selectedThread.ai_mode}
                onUseSuggestion={(text) => setMessageText(text)}
                onStageApplied={() => refreshThreads()}
              />
            )}

            {/* Send Bar */}
            {canSend ? (
              <InboxComposer
                conversationId={selectedThread.id}
                organizationId={profile?.organization_id ?? ''}
                orgMembers={orgMembers}
                value={messageText}
                onChange={setMessageText}
                sending={sending}
                onSendText={handleSend}
                onSendMedia={async (payload) => {
                  await sendMedia(payload);
                }}
                onSaveNote={handleSaveNote}
                onSaveTask={handleSaveTask}
                onSaveAppointment={handleSaveAppointment}
              />
            ) : (
              <div className="p-3 border-t border-border bg-card/30">
                <div className="text-center py-2">
                  {(() => {
                    const lockedName = getLockedByName(selectedThread);
                    if (lockedName) {
                      return (
                        <div className="flex items-center justify-center gap-2">
                          <Lock className="h-4 w-4 text-amber-500" />
                          <p className="text-xs text-muted-foreground">
                            Esta conversa está sendo atendida por <strong>{lockedName}</strong>
                          </p>
                        </div>
                      );
                    }
                    return (
                      <p className="text-xs text-muted-foreground">
                        Esta conversa não está atribuída a você. Clique em <strong>Assumir</strong> para responder.
                      </p>
                    );
                  })()}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Lead from Inbox Modal */}
      {selectedThread && (
        <CreateLeadFromInboxModal
          open={createLeadModalOpen}
          onOpenChange={setCreateLeadModalOpen}
          contactName={selectedThread.contact_name}
          contactPhone={selectedThread.contact_phone}
          onSave={(data) => createLeadFromConversation(selectedThread.id, data)}
        />
      )}

      {/* Reset First Touch Dialog */}
      <AlertDialog open={resetFirstTouchOpen} onOpenChange={setResetFirstTouchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar Primeira Interação</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai permitir que a automação de primeira mensagem dispare novamente para este contato. O histórico de mensagens será mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedThread?.lead_id && (
            <div className="flex items-center space-x-2 py-2">
              <Checkbox
                id="delete-lead"
                checked={resetAlsoDeleteLead}
                onCheckedChange={(checked) => setResetAlsoDeleteLead(checked === true)}
              />
              <label htmlFor="delete-lead" className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                Também deletar o lead vinculado
              </label>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={resettingFirstTouch}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetFirstTouch}
              disabled={resettingFirstTouch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resettingFirstTouch ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Resetar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* First Touch Status Dialog */}
      <AlertDialog open={ftStatusOpen} onOpenChange={setFtStatusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Status First-Touch</AlertDialogTitle>
            <AlertDialogDescription>
              Telefone: <code className="bg-muted px-1 py-0.5 rounded text-xs">{selectedThread?.contact_phone}</code>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2">
            {ftStatusLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Consultando...
              </div>
            ) : ftStatusData ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Existe first-touch?</span>
                  <Badge variant={ftStatusData.exists ? 'default' : 'secondary'}>
                    {ftStatusData.exists ? 'SIM' : 'NÃO'}
                  </Badge>
                </div>
                {ftStatusData.rows && ftStatusData.rows.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Registros encontrados:</p>
                    <div className="bg-muted/50 rounded p-2 space-y-1 max-h-32 overflow-auto">
                      {ftStatusData.rows.map((row: any, i: number) => (
                        <div key={i} className="text-[11px] font-mono text-foreground/80">
                          <span className="text-muted-foreground">ID:</span> {row.id?.substring(0, 8)}… | 
                          <span className="text-muted-foreground"> Criado:</span> {row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '—'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {ftStatusData.error && (
                  <p className="text-xs text-destructive">Erro: {ftStatusData.error}</p>
                )}
              </div>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setFtStatusOpen(false);
                setResetFirstTouchOpen(true);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!ftStatusData?.exists}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Resetar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
