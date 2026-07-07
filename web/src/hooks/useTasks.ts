import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";

export type TaskStatus = "pendente" | "em_andamento" | "concluida" | "atrasada";
export type TaskPriority = "baixa" | "media" | "alta";

export interface Task {
  id: string;
  titulo: string;
  data_hora: string;
  descricao: string | null;
  prioridade: TaskPriority;
  status: TaskStatus;
  responsavel_id: string | null;
  lead_id: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  notificado: boolean;
}

export type TaskWithDetails = Task & {
  lead?: { id: string; name: string; phone: string };
  responsavel?: { id: string; name: string; email: string };
};

export const useTasks = (filters?: {
  status?: TaskStatus | "";
  prioridade?: TaskPriority | "";
  responsavelId?: string;
  leadId?: string;
  startDate?: Date;
  endDate?: Date;
}) => {
  const queryClient = useQueryClient();
  const api = useApi();
  const { orgId } = useAuth();
  const { toast } = useToast();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", filters, orgId],
    queryFn: async () => {
      const data = await api.tasks.list({
        ...(filters?.status && { status: filters.status }),
        ...(filters?.responsavelId && { assigned_to: filters.responsavelId }),
        ...(filters?.leadId && { lead_id: filters.leadId }),
      }) as any[];

      return data.map((row: any): TaskWithDetails => ({
        id: row.id,
        titulo: row.titulo || row.title || '',
        data_hora: row.dueDate || row.dataHora || row.data_hora || row.dueAt || '',
        descricao: row.descricao || row.description || null,
        prioridade: row.prioridade || row.priority || 'media',
        status: row.status || 'pendente',
        responsavel_id: row.responsavelId || row.responsavel_id || row.assignedTo || null,
        lead_id: row.leadId || row.lead_id || null,
        organization_id: row.organizationId || row.organization_id || '',
        created_at: row.createdAt || row.created_at || '',
        updated_at: row.updatedAt || row.updated_at || '',
        completed_at: row.completedAt || row.completed_at || null,
        notificado: row.notificado || false,
        lead: row.lead ? { id: row.lead.id, name: row.lead.name, phone: row.lead.phone } : undefined,
      }));
    },
    enabled: !!orgId,
  });

  const createTask = useMutation({
    mutationFn: async (newTask: Partial<Task>) => {
      return api.tasks.create({
        titulo: newTask.titulo,
        due_date: newTask.data_hora || null,
        descricao: newTask.descricao || null,
        priority: newTask.prioridade || 'media',
        status: newTask.status || 'pendente',
        assigned_to: newTask.responsavel_id || null,
        lead_id: newTask.lead_id || null,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Tarefa criada", description: "A tarefa foi criada com sucesso." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar tarefa", description: error.message, variant: "destructive" });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const mapped: Record<string, unknown> = {};
      if (updates.titulo !== undefined) mapped.titulo = updates.titulo;
      if (updates.descricao !== undefined) mapped.descricao = updates.descricao;
      if (updates.prioridade !== undefined) mapped.priority = updates.prioridade;
      if (updates.status !== undefined) mapped.status = updates.status;
      if (updates.data_hora !== undefined) mapped.due_date = updates.data_hora;
      if (updates.responsavel_id !== undefined) mapped.assigned_to = updates.responsavel_id;
      return api.tasks.update(id, mapped);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Tarefa atualizada", description: "A tarefa foi atualizada com sucesso." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar tarefa", description: error.message, variant: "destructive" });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      return api.tasks.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Tarefa excluída", description: "A tarefa foi excluída com sucesso." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir tarefa", description: error.message, variant: "destructive" });
    },
  });

  const completeTask = useMutation({
    mutationFn: async (id: string) => {
      return api.tasks.update(id, { status: 'concluida' } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Tarefa concluída", description: "A tarefa foi marcada como concluída." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao concluir tarefa", description: error.message, variant: "destructive" });
    },
  });

  const postponeTask = useMutation({
    mutationFn: async ({ id, minutes }: { id: string; minutes: number }) => {
      const task = tasks?.find(t => t.id === id);
      if (!task) throw new Error("Tarefa não encontrada");
      const newDateTime = new Date(task.data_hora);
      newDateTime.setMinutes(newDateTime.getMinutes() + minutes);
      return api.tasks.update(id, { data_hora: newDateTime.toISOString() } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Tarefa adiada", description: "A tarefa foi adiada com sucesso." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao adiar tarefa", description: error.message, variant: "destructive" });
    },
  });

  return {
    tasks,
    isLoading,
    createTask: createTask.mutate,
    updateTask: updateTask.mutate,
    deleteTask: deleteTask.mutate,
    completeTask: completeTask.mutate,
    postponeTask: (id: string, minutes: number) => postponeTask.mutate({ id, minutes }),
  };
};

export const useTaskStats = () => {
  const api = useApi();
  const { orgId } = useAuth();

  return useQuery({
    queryKey: ["task-stats", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const data = await api.tasks.list() as any[];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const now = new Date();
      const isOpen = (t: any) => ['pendente', 'em_andamento'].includes(t.status);
      const dueOf = (t: any) => t.dueDate || t.data_hora || t.dataHora;

      return {
        todayCount: data.filter(t => {
          const raw = dueOf(t);
          if (!raw) return false;
          const d = new Date(raw);
          return d >= today && d < tomorrow;
        }).length,
        // Atrasada = tem prazo no passado e ainda está aberta (status 'atrasada' nunca é setado pelo backend)
        overdueCount: data.filter(t => {
          const raw = dueOf(t);
          if (!raw || !isOpen(t)) return false;
          return new Date(raw) < now;
        }).length,
        pendingCount: data.filter(t => isOpen(t)).length,
      };
    },
  });
};
