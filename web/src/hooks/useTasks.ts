import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Task = Tables<"tasks">;
export type TaskInsert = TablesInsert<"tasks">;
export type TaskUpdate = TablesUpdate<"tasks">;

export type TaskWithDetails = Task & {
  lead?: {
    id: string;
    name: string;
    phone: string;
  };
  responsavel?: {
    id: string;
    name: string;
    email: string;
  };
};

export type TaskStatus = "pendente" | "em_andamento" | "concluida" | "atrasada";
export type TaskPriority = "baixa" | "media" | "alta";

export const useTasks = (filters?: {
  status?: TaskStatus | "";
  prioridade?: TaskPriority | "";
  responsavelId?: string;
  leadId?: string;
  startDate?: Date;
  endDate?: Date;
}) => {
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", filters],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_org_tasks", {
        p_status: filters?.status || null,
        p_prioridade: filters?.prioridade || null,
        p_responsavel_id: filters?.responsavelId || null,
        p_lead_id: filters?.leadId || null,
        p_start_date: filters?.startDate?.toISOString() || null,
        p_end_date: filters?.endDate?.toISOString() || null,
      });

      if (error) throw error;

      // Map RPC flat response to TaskWithDetails shape
      return ((data ?? []) as any[]).map((row: any): TaskWithDetails => ({
        id: row.id,
        titulo: row.titulo,
        data_hora: row.data_hora,
        descricao: row.descricao,
        prioridade: row.prioridade,
        status: row.status,
        responsavel_id: row.responsavel_id,
        lead_id: row.lead_id,
        organization_id: row.organization_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        completed_at: row.completed_at,
        notificado: row.notificado,
        lead: row.lead_name ? { id: row.lead_id, name: row.lead_name, phone: row.lead_phone } : undefined,
      }));
    },
  });

  const createTask = useMutation({
    mutationFn: async (newTask: TaskInsert) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert(newTask)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Tarefa criada",
        description: "A tarefa foi criada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar tarefa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TaskUpdate }) => {
      const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Tarefa atualizada",
        description: "A tarefa foi atualizada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar tarefa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Tarefa excluída",
        description: "A tarefa foi excluída com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir tarefa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completeTask = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("tasks")
        .update({
          status: "concluida",
          completed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Tarefa concluída",
        description: "A tarefa foi marcada como concluída.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao concluir tarefa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const postponeTask = useMutation({
    mutationFn: async ({ id, minutes }: { id: string; minutes: number }) => {
      const task = tasks?.find((t) => t.id === id);
      if (!task) throw new Error("Tarefa não encontrada");

      const newDateTime = new Date(task.data_hora);
      newDateTime.setMinutes(newDateTime.getMinutes() + minutes);

      const { data, error } = await supabase
        .from("tasks")
        .update({ data_hora: newDateTime.toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Tarefa adiada",
        description: "A tarefa foi adiada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao adiar tarefa",
        description: error.message,
        variant: "destructive",
      });
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
  return useQuery({
    queryKey: ["task-stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: todayTasks, error: todayError } = await supabase
        .from("tasks")
        .select("*")
        .gte("data_hora", today.toISOString())
        .lt("data_hora", tomorrow.toISOString());

      const { data: overdueTasks, error: overdueError } = await supabase
        .from("tasks")
        .select("*")
        .eq("status", "atrasada");

      const { data: pendingTasks, error: pendingError } = await supabase
        .from("tasks")
        .select("*")
        .in("status", ["pendente", "em_andamento"]);

      if (todayError) throw todayError;
      if (overdueError) throw overdueError;
      if (pendingError) throw pendingError;

      return {
        todayCount: todayTasks?.length || 0,
        overdueCount: overdueTasks?.length || 0,
        pendingCount: pendingTasks?.length || 0,
      };
    },
  });
};
