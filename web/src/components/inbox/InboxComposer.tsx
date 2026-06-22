import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, MessageCircle, Lock, CheckSquare, CalendarDays } from 'lucide-react';
import { MessageComposer, MediaPayload } from './MessageComposer';
import { NoteComposer } from './NoteComposer';
import { TaskComposer } from './TaskComposer';
import { AppointmentComposer } from './AppointmentComposer';
import { cn } from '@/lib/utils';

type ComposerMode = 'chat' | 'note' | 'task' | 'appointment';

interface OrgMember {
  id: string;
  name: string;
}

interface InboxComposerProps {
  conversationId: string;
  organizationId: string;
  orgMembers: OrgMember[];
  // Chat props
  value: string;
  onChange: (v: string) => void;
  sending?: boolean;
  disabled?: boolean;
  onSendText: () => void | Promise<void>;
  onSendMedia: (payload: MediaPayload) => Promise<void>;
  // Note handler
  onSaveNote: (content: string) => Promise<void>;
  // Task handler
  onSaveTask: (task: {
    titulo: string;
    data_hora: string;
    descricao?: string;
    prioridade?: 'baixa' | 'media' | 'alta';
    responsavel_id?: string;
    organization_id: string;
  }) => Promise<void>;
  // Appointment handler
  onSaveAppointment: (appointment: {
    datetime: string;
    tipo: string;
    duration_minutes?: number;
    anotacoes?: string;
    organization_id: string;
  }) => Promise<void>;
}

const MODES: { value: ComposerMode; label: string; icon: React.ElementType }[] = [
  { value: 'chat', label: 'Bate-papo', icon: MessageCircle },
  { value: 'note', label: 'Nota', icon: Lock },
  { value: 'task', label: 'Tarefa', icon: CheckSquare },
  { value: 'appointment', label: 'Agendamento', icon: CalendarDays },
];

const modeAccent: Record<ComposerMode, string> = {
  chat: 'text-foreground',
  note: 'text-amber-600',
  task: 'text-violet-600',
  appointment: 'text-sky-600',
};

export function InboxComposer({
  conversationId,
  organizationId,
  orgMembers,
  value,
  onChange,
  sending,
  disabled,
  onSendText,
  onSendMedia,
  onSaveNote,
  onSaveTask,
  onSaveAppointment,
}: InboxComposerProps) {
  const [mode, setMode] = useState<ComposerMode>('chat');

  const currentMode = MODES.find((m) => m.value === mode)!;
  const Icon = currentMode.icon;

  const handleSaveNote = async (content: string) => {
    await onSaveNote(content);
    setMode('chat');
  };

  const handleSaveTask = async (task: Parameters<typeof onSaveTask>[0]) => {
    await onSaveTask(task);
    setMode('chat');
  };

  const handleSaveAppointment = async (appt: Parameters<typeof onSaveAppointment>[0]) => {
    await onSaveAppointment(appt);
    setMode('chat');
  };

  return (
    <div className="bg-card">
      {/* Mode selector bar */}
      <div className="flex items-center px-3 pt-1 pb-0 border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-7 gap-1.5 text-xs font-medium px-2', modeAccent[mode])}
            >
              <Icon className="h-3.5 w-3.5" />
              {currentMode.label}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {MODES.map(({ value: v, label, icon: ModeIcon }) => (
              <DropdownMenuItem
                key={v}
                className={cn('gap-2 text-sm', mode === v && 'font-semibold')}
                onSelect={() => setMode(v)}
              >
                <ModeIcon className="h-3.5 w-3.5" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Composer body */}
      {mode === 'chat' && (
        <MessageComposer
          value={value}
          onChange={onChange}
          sending={sending}
          disabled={disabled}
          onSendText={onSendText}
          onSendMedia={onSendMedia}
        />
      )}
      {mode === 'note' && (
        <NoteComposer onSave={handleSaveNote} />
      )}
      {mode === 'task' && (
        <TaskComposer
          orgMembers={orgMembers}
          organizationId={organizationId}
          onSave={handleSaveTask}
        />
      )}
      {mode === 'appointment' && (
        <AppointmentComposer
          organizationId={organizationId}
          onSave={handleSaveAppointment}
        />
      )}
    </div>
  );
}
