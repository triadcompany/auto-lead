import { useState } from "react";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";
import { TaskCard } from "@/components/tasks/TaskCard";
import { useTasks, useTaskStats, TaskStatus, TaskPriority } from "@/hooks/useTasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { 
  ListTodo, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  Target
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { format, isToday, isTomorrow, isPast, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Tasks() {
  const [filter, setFilter] = useState<{
    status: TaskStatus | "all";
    prioridade: TaskPriority | "all";
  }>({
    status: "all",
    prioridade: "all",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const { tasks, isLoading, completeTask, postponeTask, deleteTask } = useTasks({
    status: filter.status === "all" ? undefined : filter.status,
    prioridade: filter.prioridade === "all" ? undefined : filter.prioridade,
  });

  const { data: stats } = useTaskStats();

  const filteredTasks = tasks?.filter((task) =>
    task.titulo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Tarefas do dia selecionado
  const tasksForSelectedDate = selectedDate 
    ? filteredTasks?.filter((task) => {
        const taskDate = new Date(task.data_hora);
        return taskDate >= startOfDay(selectedDate) && taskDate <= endOfDay(selectedDate);
      })
    : [];

  // Tarefas de hoje
  const todayTasks = filteredTasks?.filter((task) => 
    isToday(new Date(task.data_hora))
  ) || [];

  // Tarefas atrasadas
  const overdueTasks = filteredTasks?.filter((task) => 
    task.status === "atrasada" || (isPast(new Date(task.data_hora)) && task.status !== "concluida")
  ) || [];

  // Próximas tarefas
  const upcomingTasks = filteredTasks?.filter((task) => {
    const taskDate = new Date(task.data_hora);
    return !isPast(taskDate) && task.status !== "concluida";
  }).slice(0, 5) || [];

  const groupedByStatus = {
    pendente: filteredTasks?.filter((t) => t.status === "pendente") || [],
    em_andamento: filteredTasks?.filter((t) => t.status === "em_andamento") || [],
    atrasada: filteredTasks?.filter((t) => t.status === "atrasada") || [],
    concluida: filteredTasks?.filter((t) => t.status === "concluida") || [],
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pendente": return "bg-yellow-500/10 text-yellow-600 border-yellow-200";
      case "em_andamento": return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "atrasada": return "bg-red-500/10 text-red-600 border-red-200";
      case "concluida": return "bg-green-500/10 text-green-600 border-green-200";
      default: return "bg-muted";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader 
        title="Tarefas" 
        description="Gerencie suas tarefas e compromissos"
      >
        <AddTaskModal />
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Hoje</p>
                <p className="text-3xl font-bold text-blue-600">{stats?.todayCount || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <CalendarIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Atrasadas</p>
                <p className="text-3xl font-bold text-red-600">{stats?.overdueCount || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-200/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
                <p className="text-3xl font-bold text-yellow-600">{stats?.pendingCount || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Concluídas</p>
                <p className="text-3xl font-bold text-green-600">
                  {filteredTasks?.filter(t => t.status === "concluida").length || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar tarefas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select 
          value={filter.prioridade} 
          onValueChange={(v) => setFilter({ ...filter, prioridade: v as TaskPriority | "all" })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
          </SelectContent>
        </Select>
        <Select 
          value={filter.status} 
          onValueChange={(v) => setFilter({ ...filter, status: v as TaskStatus | "all" })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="atrasada">Atrasada</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="agenda" className="w-full">
        <TabsList>
          <TabsTrigger value="agenda">
            <CalendarIcon className="mr-2 h-4 w-4" />
            Agenda
          </TabsTrigger>
          <TabsTrigger value="list">
            <ListTodo className="mr-2 h-4 w-4" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="board">
            <Target className="mr-2 h-4 w-4" />
            Quadro
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Calendário</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={ptBR}
                  className="rounded-md border w-full"
                  modifiers={{
                    hasTasks: (date) => {
                      return filteredTasks?.some((task) => {
                        const taskDate = new Date(task.data_hora);
                        return (
                          taskDate.getDate() === date.getDate() &&
                          taskDate.getMonth() === date.getMonth() &&
                          taskDate.getFullYear() === date.getFullYear()
                        );
                      }) || false;
                    },
                  }}
                  modifiersStyles={{
                    hasTasks: {
                      fontWeight: "bold",
                      backgroundColor: "hsl(var(--primary) / 0.1)",
                      color: "hsl(var(--primary))",
                    },
                  }}
                />
              </CardContent>
            </Card>

            {/* Tasks for selected date */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>
                    {selectedDate
                      ? isToday(selectedDate)
                        ? "Tarefas de Hoje"
                        : isTomorrow(selectedDate)
                        ? "Tarefas de Amanhã"
                        : `Tarefas de ${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}`
                      : "Selecione uma data"}
                  </span>
                  <Badge variant="secondary">{tasksForSelectedDate?.length || 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </div>
                ) : tasksForSelectedDate && tasksForSelectedDate.length > 0 ? (
                  <div className="space-y-3">
                    {tasksForSelectedDate.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{task.titulo}</span>
                            <Badge className={getStatusColor(task.status)} variant="outline">
                              {task.status === "pendente" && "Pendente"}
                              {task.status === "em_andamento" && "Em Andamento"}
                              {task.status === "atrasada" && "Atrasada"}
                              {task.status === "concluida" && "Concluída"}
                            </Badge>
                            {task.prioridade === "alta" && (
                              <Badge variant="destructive" className="text-xs">Alta</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(task.data_hora), "HH:mm", { locale: ptBR })}
                            {task.lead && <span>• {task.lead.name}</span>}
                          </div>
                          {task.descricao && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                              {task.descricao}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {task.status !== "concluida" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => completeTask(task.id)}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Nenhuma tarefa para esta data.</p>
                    <AddTaskModal 
                      trigger={
                        <Button variant="outline" className="mt-4">
                          Criar tarefa
                        </Button>
                      } 
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick View: Overdue & Upcoming */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Overdue Tasks */}
            {overdueTasks.length > 0 && (
              <Card className="border-red-500/40 dark:border-red-500/40">
                <CardHeader className="bg-red-500/10 dark:bg-red-500/15">
                  <CardTitle className="text-base flex items-center gap-2 text-red-500 dark:text-red-400">
                    <AlertCircle className="h-5 w-5" />
                    Tarefas Atrasadas
                    <Badge variant="destructive">{overdueTasks.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    {overdueTasks.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 dark:bg-red-500/15 border border-red-500/30"
                      >
                        <div>
                          <span className="font-medium text-sm">{task.titulo}</span>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(task.data_hora), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => completeTask(task.id)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upcoming Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Próximas Tarefas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingTasks.length > 0 ? (
                  <div className="space-y-2">
                    {upcomingTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div>
                          <span className="font-medium text-sm">{task.titulo}</span>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(task.data_hora), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <Badge className={getStatusColor(task.status)} variant="outline">
                          {task.prioridade}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Nenhuma tarefa pendente!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="list" className="space-y-4 mt-6">
          {isLoading ? (
            <div className="text-center py-12">Carregando tarefas...</div>
          ) : filteredTasks && filteredTasks.length > 0 ? (
            <div className="grid gap-4">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={completeTask}
                  onPostpone={postponeTask}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Nenhuma tarefa encontrada.<br />
                  Crie sua primeira tarefa para começar!
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="board" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(groupedByStatus).map(([status, statusTasks]) => (
              <Card key={status}>
                <CardHeader className={`${getStatusColor(status)} rounded-t-lg`}>
                  <CardTitle className="text-base flex items-center justify-between">
                    {status === "pendente" && "Pendentes"}
                    {status === "em_andamento" && "Em Andamento"}
                    {status === "atrasada" && "Atrasadas"}
                    {status === "concluida" && "Concluídas"}
                    <Badge variant="secondary">
                      {statusTasks.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4 max-h-[500px] overflow-y-auto">
                  {statusTasks.length > 0 ? (
                    statusTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onComplete={completeTask}
                        onPostpone={postponeTask}
                        onDelete={deleteTask}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma tarefa
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
