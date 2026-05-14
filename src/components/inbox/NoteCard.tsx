import { Lock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConversationNote } from '@/hooks/useConversationNotes';

interface NoteCardProps {
  note: ConversationNote;
}

export function NoteCard({ note }: NoteCardProps) {
  return (
    <div className="flex justify-center my-2 px-4">
      <div className="w-full max-w-[85%] rounded-lg border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 shadow-sm">
        <div className="flex items-center gap-1.5 mb-1">
          <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Nota interna</span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">{note.content}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          {note.author_name && (
            <span className="text-xs text-muted-foreground">{note.author_name}</span>
          )}
          <span className="text-xs text-muted-foreground/60">
            {format(parseISO(note.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
      </div>
    </div>
  );
}
