import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTasks, useTaskStats } from "@/hooks/useTasks";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function TasksWidget() {
  const navigate = useNavigate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { tasks, completeTask } = useTasks({
    startDate: today,
    endDate: tomorrow,
  });

  const { data: stats } = useTaskStats();

  const pendingTasks = tasks?.filter((t) => t.status !== "concluida") || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Agenda do Dia</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/tarefas")}
          className="text-primary hover:text-primary"
        >
          Ver todas
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
              {stats?.todayCount || 0}
            </Badge>
            <span className="text-sm text-muted-foreground">Hoje</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-red-500/10 text-red-600">
              {stats?.overdueCount || 0}
            </Badge>
            <span className="text-sm text-muted-foreground">Atrasadas</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
              {stats?.pendingCount || 0}
            </Badge>
            <span className="text-sm text-muted-foreground">Pendentes</span>
          </div>
        </div>

        <div className="space-y-3">
          {pendingTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nenhuma tarefa para hoje! 🎉</p>
            </div>
          ) : (
            pendingTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{task.titulo}</span>
                    {task.status === "atrasada" && (
                      <Badge variant="secondary" className="bg-red-500/10 text-red-600">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Atrasada
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(task.data_hora), "HH:mm", { locale: ptBR })}
                    {task.lead && <span>• {task.lead.name}</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => completeTask(task.id)}
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
