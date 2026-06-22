import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, MessageCircle } from "lucide-react";
import { format, addHours, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface CreateFollowupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  sellerId: string;
}

export function CreateFollowupModal({ 
  open, 
  onOpenChange, 
  leadId, 
  leadName,
  sellerId 
}: CreateFollowupModalProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Date | undefined>(addHours(new Date(), 1));
  const [time, setTime] = useState("10:00");
  const [channel, setChannel] = useState<"whatsapp" | "email" | "sms">("whatsapp");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date || !profile?.organization_id) {
      toast({
        title: "Erro",
        description: "Selecione uma data para o follow-up",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Combine date and time
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledFor = setMinutes(setHours(date, hours), minutes);

      const { error } = await supabase
        .from('followups')
        .insert({
          organization_id: profile.organization_id,
          lead_id: leadId,
          assigned_to: sellerId,
          scheduled_for: scheduledFor.toISOString(),
          channel,
          message_custom: message || null,
          status: 'PENDENTE',
          created_by: profile.user_id,
        });

      if (error) throw error;

      toast({
        title: "Follow-up criado",
        description: `Agendado para ${format(scheduledFor, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      });

      queryClient.invalidateQueries({ queryKey: ['followups'] });
      onOpenChange(false);
      
      // Reset form
      setDate(addHours(new Date(), 1));
      setTime("10:00");
      setChannel("whatsapp");
      setMessage("");
    } catch (error) {
      console.error('Error creating followup:', error);
      toast({
        title: "Erro ao criar follow-up",
        description: "Tente novamente em alguns instantes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Criar Follow-up
          </DialogTitle>
          <DialogDescription>
            Agende um follow-up para <strong>{leadName}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Canal */}
          <div className="space-y-2">
            <Label>Canal</Label>
            <Select value={channel} onValueChange={(v: "whatsapp" | "email" | "sms") => setChannel(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label>Data</Label>
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
                  {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione uma data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Hora */}
          <div className="space-y-2">
            <Label>Horário</Label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 11 }, (_, i) => i + 9).map((hour) => (
                  <SelectItem key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                    {hour.toString().padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Horário comercial: 09:00 - 19:00
            </p>
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <Label>Mensagem (opcional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mensagem personalizada ou deixe em branco para usar template"
              className="min-h-[100px]"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="btn-gradient text-white">
              {loading ? "Criando..." : "Criar Follow-up"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
