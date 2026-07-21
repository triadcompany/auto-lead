import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Lead } from "@/hooks/useSupabaseLeads";
import { LeadEditTabs } from "@/components/modals/LeadEditTabs";

interface EditLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onSave: (leadId: string, updatedLead: Partial<Lead>) => void;
  onDelete?: (leadId: string) => void;
}

export function EditLeadModal({ open, onOpenChange, lead, onSave, onDelete }: EditLeadModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto card-gradient">
        <DialogHeader>
          <DialogTitle className="font-poppins font-bold text-xl text-foreground">
            Editar Lead
          </DialogTitle>
          <DialogDescription className="font-poppins text-muted-foreground">
            Atualize as informações do cliente
          </DialogDescription>
        </DialogHeader>

        <LeadEditTabs lead={lead} onSave={onSave} onDelete={onDelete} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
