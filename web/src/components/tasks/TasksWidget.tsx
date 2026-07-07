import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTasks, useTaskStats, type TaskPriority } from "@/hooks/useTasks";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  X,
  Flame,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

const PRIORITY_STYLE: Record<TaskPriority, { border: string; badge: string; label: string }> = {
  alta:  { border: "border-l-red-500",   badge: "bg-red-500/10 text-red-500",     label: "Alta"  },
  media: { border: "border-l-amber-400", badge: "bg-amber-400/10 text-amber-500", label: "Média" },
  baixa: { border: "border-l-border",    badge: "",                                label: "Baixa" },
};

const PRIORITY_ORDER: Record<TaskPriority, number> = { alta: 0, media: 1, baixa: 2 };

function defaultDateTime() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toISOString().slice(0, 16);
}

function isToday(dateStr: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

export function TasksWidget() {
  const navigate = useNavigate();
  const { tasks, completeTask, createTask } = useTasks();
  const { data: stats } = useTaskStats();

  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDateTime, setNewDateTime] = useState(defaultDateTime);
  const [newPriority, setNewPriority] = useState<TaskPriority>("media");
  const [submitting, setSubmitting] = useState(false);

  const { overdue, today } = useMemo(() => {
    const all = tasks ?? [];

    const overdue = all
      .filter(t => t.status === "atrasada")
      .sort((a, b) => PRIORITY_ORDER[a.prioridade] - PRIORITY_ORDER[b.prioridade]);

    const today = all
      .filter(
        t =>
          t.status !== "concluida" &&
          t.status !== "atrasada" &&
          isToday(t.data_hora)
      )
      .sort((a, b) => {
        const byPriority = PRIORITY_ORDER[a.prioridade] - PRIORITY_ORDER[b.prioridade];
        if (byPriority !== 0) return byPriority;
        return new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime();
      });

    return { overdue, today };
  }, [tasks]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      await createTask({
        titulo: newTitle.trim(),
        data_hora: new Date(newDateTime).toISOString(),
        prioridade: newPriority,
        status: "pendente",
      });
      setNewTitle("");
      setNewDateTime(defaultDateTime());
      setNewPriority("media");
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="font-poppins font-semibold text-lg">Agenda do Dia</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(v => !v)}
            className="text-primary hover:text-primary font-poppins"
          >
            {showForm ? (
              <X className="h-4 w-4" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Nova tarefa
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/tarefas")}
            className="text-muted-foreground hover:text-foreground font-poppins"
          >
            Ver todas
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Contadores */}
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 font-poppins">
              {stats?.todayCount ?? 0}
            </Badge>
            <span className="text-xs text-muted-foreground font-poppins">Hoje</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="bg-red-500/10 text-red-500 font-poppins">
              {stats?.overdueCount ?? 0}
            </Badge>
            <span className="text-xs text-muted-foreground font-poppins">Atrasadas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="bg-muted text-muted-foreground font-poppins">
              {stats?.pendingCount ?? 0}
            </Badge>
            <span className="text-xs text-muted-foreground font-poppins">Pendentes</span>
          </div>
        </div>

        {/* Formulário de criação rápida */}
        {showForm && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <Input
              placeholder="Título da tarefa..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              className="font-poppins text-sm bg-background"
              autoFocus
            />
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={newDateTime}
                onChange={e => setNewDateTime(e.target.value)}
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm font-poppins text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as TaskPriority)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm font-poppins text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="alta">🔴 Alta</option>
                <option value="media">🟡 Média</option>
                <option value="baixa">⚪ Baixa</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
                className="font-poppins"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newTitle.trim() || submitting}
                className="btn-gradient text-white font-poppins"
              >
                {submitting ? "Criando…" : "Criar"}
              </Button>
            </div>
          </div>
        )}

        {/* Alerta de tarefas atrasadas */}
        {overdue.length > 0 && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-poppins font-semibold">
                {overdue.length === 1
                  ? "1 tarefa atrasada"
                  : `${overdue.length} tarefas atrasadas`}
              </span>
            </div>
            {overdue.slice(0, 3).map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onComplete={() => completeTask(task.id)}
                showDate
              />
            ))}
            {overdue.length > 3 && (
              <button
                onClick={() => navigate("/tarefas")}
                className="text-xs text-red-400 hover:text-red-300 font-poppins underline underline-offset-2 w-full text-left pl-1 mt-1"
              >
                +{overdue.length - 3} atrasadas — ver todas
              </button>
            )}
          </div>
        )}

        {/* Tarefas de hoje */}
        {today.length > 0 ? (
          <div className="space-y-2">
            {overdue.length > 0 && (
              <p className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider pt-1">
                Hoje
              </p>
            )}
            {today.slice(0, 5).map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onComplete={() => completeTask(task.id)}
              />
            ))}
            {today.length > 5 && (
              <button
                onClick={() => navigate("/tarefas")}
                className="text-xs text-muted-foreground hover:text-foreground font-poppins underline underline-offset-2 w-full text-left pl-2"
              >
                +{today.length - 5} mais para hoje
              </button>
            )}
          </div>
        ) : overdue.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="font-poppins text-sm">Nenhuma tarefa para hoje 🎉</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 text-xs text-primary hover:underline font-poppins"
            >
              Criar uma tarefa
            </button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TaskRow({
  task,
  onComplete,
  showDate = false,
}: {
  task: any;
  onComplete: () => void;
  showDate?: boolean;
}) {
  const style = PRIORITY_STYLE[task.prioridade as TaskPriority] ?? PRIORITY_STYLE.media;

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow border-l-4 ${style.border}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {task.prioridade === "alta" && (
            <Flame className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
          )}
          <span className="font-poppins font-medium text-sm truncate">{task.titulo}</span>
          {task.prioridade !== "baixa" && (
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 font-poppins ${style.badge}`}
            >
              {style.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-poppins flex-wrap">
          <Clock className="h-3 w-3 flex-shrink-0" />
          <span>
            {task.data_hora
              ? format(
                  new Date(task.data_hora),
                  showDate ? "dd/MM HH:mm" : "HH:mm",
                  { locale: ptBR }
                )
              : "—"}
          </span>
          {task.lead && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <Link
                to="/leads"
                className="text-primary hover:underline underline-offset-2 truncate max-w-[140px]"
              >
                {task.lead.name}
              </Link>
            </>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={onComplete}
        title="Marcar como concluída"
        className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/10 flex-shrink-0 ml-2"
      >
        <CheckCircle2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
