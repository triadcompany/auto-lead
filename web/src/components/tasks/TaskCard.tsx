import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, CheckCircle2, Edit, Trash2, AlertCircle, User, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskWithDetails } from "@/hooks/useTasks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TaskCardProps {
  task: TaskWithDetails;
  onComplete: (id: string) => void;
  onPostpone: (id: string, minutes: number) => void;
  onDelete: (id: string) => void;
}

export function TaskCard({ task, onComplete, onPostpone, onDelete }: TaskCardProps) {
  const priorityColors = {
    baixa: "bg-green-500/10 text-green-600 border-green-500/20",
    media: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    alta: "bg-red-500/10 text-red-600 border-red-500/20",
  };

  const statusColors = {
    pendente: "bg-blue-500/10 text-blue-600",
    em_andamento: "bg-purple-500/10 text-purple-600",
    concluida: "bg-green-500/10 text-green-600",
    atrasada: "bg-red-500/10 text-red-600",
  };

  const statusLabels = {
    pendente: "Pendente",
    em_andamento: "Em Andamento",
    concluida: "Concluída",
    atrasada: "Atrasada",
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-lg">{task.titulo}</h3>
            <Badge className={priorityColors[task.prioridade]}>
              {task.prioridade}
            </Badge>
            <Badge className={statusColors[task.status]}>
              {statusLabels[task.status]}
            </Badge>
          </div>
          
          {task.descricao && (
            <p className="text-sm text-muted-foreground mb-2">{task.descricao}</p>
          )}

          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {format(new Date(task.data_hora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
            
            {task.lead && (
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {task.lead.name}
              </div>
            )}

            {task.responsavel && (
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {task.responsavel.name}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-1">
          {task.status !== "concluida" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onComplete(task.id)}
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <Clock className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => onPostpone(task.id, 30)}>
                    +30 minutos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPostpone(task.id, 60)}>
                    +1 hora
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPostpone(task.id, 1440)}>
                    +1 dia
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(task.id)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {task.lead?.phone && (
        <div className="mt-3 pt-3 border-t">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => window.open(`https://wa.me/55${task.lead?.phone.replace(/\D/g, "")}`, "_blank")}
          >
            <Phone className="mr-2 h-4 w-4" />
            Abrir WhatsApp
          </Button>
        </div>
      )}
    </Card>
  );
}
