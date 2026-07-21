import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { Lead, useSupabaseLeads } from "@/hooks/useSupabaseLeads";
import { LeadEditTabs } from "@/components/modals/LeadEditTabs";

interface InboxLeadPanelProps {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InboxLeadPanel({ leadId, open, onOpenChange }: InboxLeadPanelProps) {
  const api = useApi();
  const { updateLead, deleteLead } = useSupabaseLeads();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !leadId) return;
    let cancelled = false;
    setLoading(true);
    api.leads.get(leadId).then((data: any) => {
      if (!cancelled) setLead(data);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, leadId, api]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-poppins font-bold">Lead</SheetTitle>
          <SheetDescription className="font-poppins">
            Dados do cliente e informações de anúncio, se houver
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-4">
            <LeadEditTabs
              lead={lead}
              onSave={(id, data) => {
                updateLead(id, data);
                setLead((prev) => (prev ? { ...prev, ...data } as Lead : prev));
              }}
              onDelete={(id) => {
                deleteLead(id);
                onOpenChange(false);
              }}
              onClose={() => onOpenChange(false)}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
