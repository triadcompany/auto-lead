import { CheckSquare, Clock, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TaskWithDetails } from '@/hooks/useTasks';

const priorityLabel: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

interface InboxTaskCardProps {
  task: TaskWithDetails;
}

export function InboxTaskCard({ task }: InboxTaskCardProps) {
  return (
    <div className="flex justify-center my-2 px-4">
      <div className="w-full max-w-[85%] rounded-lg border-l-4 border-violet-400 bg-violet-50 dark:bg-violet-950/30 px-3 py-2 shadow-sm">
        <div className="flex items-center gap-1.5 mb-1">
          <CheckSquare className="h-3 w-3 text-violet-600 dark:text-violet-400 shrink-0" />
          <span className="text-xs font-semibold text-violet-700 dark:text-violet-400">Tarefa criada</span>
          {task.prioridade && (
            <span className="ml-auto text-xs text-muted-foreground">
              {priorityLabel[task.prioridade] ?? task.prioridade}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground">{task.titulo}</p>
        {task.descricao && (
          <p className="text-xs text-muted-foreground mt-0.5">{task.descricao}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {format(parseISO(task.data_hora), "dd/MM 'às' HH:mm", { locale: ptBR })}
          </div>
          {task.responsavel && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {task.responsavel.name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
