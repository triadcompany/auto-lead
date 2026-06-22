import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus } from "lucide-react";
import { useTasks, TaskInsert, TaskPriority } from "@/hooks/useTasks";
import { useSupabaseLeads } from "@/hooks/useSupabaseLeads";
import { useAuth } from "@/contexts/AuthContext";

interface AddTaskModalProps {
  leadId?: string;
  trigger?: React.ReactNode;
}

export function AddTaskModal({ leadId, trigger }: AddTaskModalProps) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leadId || "");
  const [prioridade, setPrioridade] = useState<TaskPriority>("media");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("09:00");

  const { createTask } = useTasks();
  const { profile } = useAuth();
  const { leads } = useSupabaseLeads();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!titulo || !date || !profile) return;

    const [hours, minutes] = time.split(":").map(Number);
    const taskDateTime = new Date(date);
    taskDateTime.setHours(hours, minutes);

    const newTask: TaskInsert = {
      titulo,
      descricao: descricao || null,
      lead_id: selectedLeadId || null,
      responsavel_id: profile.id,
      organization_id: profile.organization_id!,
      data_hora: taskDateTime.toISOString(),
      prioridade,
      status: "pendente",
    };

    createTask(newTask);
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setTitulo("");
    setDescricao("");
    setSelectedLeadId(leadId || "");
    setPrioridade("media");
    setDate(undefined);
    setTime("09:00");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova Tarefa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Criar Nova Tarefa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título*</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Ligar para cliente"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes da tarefa..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data*</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Horário*</Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select value={prioridade} onValueChange={(v: any) => setPrioridade(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead">Lead</Label>
              <Select value={selectedLeadId || "none"} onValueChange={(v) => setSelectedLeadId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {leads?.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Criar Tarefa</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
