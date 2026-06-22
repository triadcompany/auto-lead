import { Calendar, Clock, CheckCircle2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface Task {
  id: string;
  titulo: string;
  descricao?: string;
  data_hora: string;
  prioridade: 'baixa' | 'media' | 'alta';
  status: 'pendente' | 'concluida';
}

interface MobileTaskCardProps {
  task: Task;
  onComplete: (id: string) => void;
  onPostpone: (id: string, minutes: number) => void;
  onEdit: (task: Task) => void;
}

export function MobileTaskCard({ task, onComplete, onPostpone, onEdit }: MobileTaskCardProps) {
  const priorityColors = {
    baixa: 'bg-blue-500',
    media: 'bg-yellow-500',
    alta: 'bg-red-500',
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', { 
      day: '2-digit',
      month: 'short'
    });
  };

  return (
    <div className={cn(
      "bg-card border border-border rounded-lg p-4 space-y-3",
      task.status === 'concluida' && "opacity-60"
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn("w-1 h-4 rounded", priorityColors[task.prioridade])} />
            <span className="text-xs text-muted-foreground">
              {formatDate(task.data_hora)}
            </span>
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium">
              {formatTime(task.data_hora)}
            </span>
          </div>
          <h3 className="font-medium text-sm line-clamp-2">
            {task.titulo}
          </h3>
          {task.descricao && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
              {task.descricao}
            </p>
          )}
        </div>
        
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Ações da Tarefa</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-2">
              {task.status === 'pendente' && (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-12"
                    onClick={() => onComplete(task.id)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Marcar como Concluída
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-12"
                    onClick={() => onPostpone(task.id, 30)}
                  >
                    Adiar 30 minutos
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-12"
                    onClick={() => onPostpone(task.id, 60)}
                  >
                    Adiar 1 hora
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-12"
                    onClick={() => onPostpone(task.id, 1440)}
                  >
                    Adiar 1 dia
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                className="w-full justify-start h-12"
                onClick={() => onEdit(task)}
              >
                Editar
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {task.status === 'pendente' && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-9"
            onClick={() => onComplete(task.id)}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Concluir
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-9"
            onClick={() => onPostpone(task.id, 30)}
          >
            <Clock className="h-3 w-3 mr-1" />
            +30m
          </Button>
        </div>
      )}
    </div>
  );
}
