import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lead } from "@/hooks/useSupabaseLeads";

interface EditObservationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onSave: (leadId: string, observations: string) => void;
}

export function EditObservationsModal({ open, onOpenChange, lead, onSave }: EditObservationsModalProps) {
  const [observations, setObservations] = useState("");

  useEffect(() => {
    if (lead) {
      setObservations(lead.observations || "");
    }
  }, [lead]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lead) {
      onSave(lead.id, observations);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] card-gradient">
        <DialogHeader>
          <DialogTitle className="font-poppins font-bold text-xl text-foreground">
            Editar Observações
          </DialogTitle>
          <DialogDescription className="font-poppins text-muted-foreground">
            Atualize as observações do lead: {lead?.name}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Informações básicas do lead */}
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="font-poppins font-medium text-muted-foreground">Nome:</span>
                <span className="font-poppins">{lead?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-poppins font-medium text-muted-foreground">Telefone:</span>
                <span className="font-poppins">{lead?.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-poppins font-medium text-muted-foreground">Interesse:</span>
                <span className="font-poppins">{lead?.interest || "Não especificado"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-poppins font-medium text-muted-foreground">Etapa:</span>
                <span className="font-poppins capitalize">{lead?.stage_name}</span>
              </div>
            </div>
          </div>

          {/* Campo de observações */}
          <div className="space-y-2">
            <Label htmlFor="observations" className="font-poppins font-medium">
              Observações
            </Label>
            <Textarea 
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Adicione observações sobre este lead..."
              className="font-poppins min-h-[120px]"
              rows={6}
            />
            <p className="text-xs text-muted-foreground font-poppins">
              Use este campo para adicionar informações importantes sobre o cliente, histórico de contatos, preferências, etc.
            </p>
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="font-poppins font-medium"
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              className="btn-gradient text-white font-poppins font-medium"
            >
              Salvar Observações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}