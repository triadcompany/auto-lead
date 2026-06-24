import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, Clock, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/hooks/useApi";
import { FollowupCadence } from "@/types/followup";

interface ApplyCadenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  sellerId: string;
}

export function ApplyCadenceModal({
  open,
  onOpenChange,
  leadId,
  leadName,
  sellerId
}: ApplyCadenceModalProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const api = useApi();

  const [cadences, setCadences] = useState<FollowupCadence[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (open) fetchCadences();
  }, [open]);

  const fetchCadences = async () => {
    setLoading(true);
    try {
      const data = await api.followupCadences.list() as any[];
      const parsed = (data || []).map((c: any) => ({
        ...c,
        steps: Array.isArray(c.steps) ? c.steps : (typeof c.steps === 'string' ? JSON.parse(c.steps) : []),
        is_default: c.isDefault ?? c.is_default ?? false,
        is_active: c.isActive ?? c.is_active ?? true,
      }));
      setCadences(parsed);
    } catch (error) {
      console.error('Error fetching cadences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCadence = async (cadence: FollowupCadence) => {
    if (!profile) return;
    setApplying(true);
    try {
      const result = await api.leads.applyCadence(leadId, cadence.id, sellerId) as any;
      toast({
        title: "Cadência aplicada",
        description: `${result.created} follow-up(s) agendado(s) para ${leadName}`,
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error applying cadence:', error);
      toast({
        title: "Erro ao aplicar cadência",
        description: error?.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const formatDelayHours = (hours: number) => {
    if (hours === 0) return "agora";
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days}d`;
    return `${days}d ${remainingHours}h`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-primary" />
            Aplicar Cadência
          </DialogTitle>
          <DialogDescription>
            Escolha uma cadência para aplicar automaticamente os follow-ups para <strong>{leadName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : cadences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma cadência configurada.</p>
              <p className="text-sm">Configure cadências em Configurações.</p>
            </div>
          ) : (
            cadences.map((cadence) => (
              <Card
                key={cadence.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => !applying && handleApplyCadence(cadence)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{cadence.name}</h4>
                        {cadence.is_default && (
                          <Badge variant="secondary" className="text-xs">Padrão</Badge>
                        )}
                      </div>
                      {cadence.description && (
                        <p className="text-sm text-muted-foreground">{cadence.description}</p>
                      )}
                      <div className="flex items-center gap-4 pt-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageCircle className="h-3 w-3" />
                          {cadence.steps.length} mensagens
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {cadence.steps.map((s, i) => (
                            <span key={i}>
                              {i > 0 && " → "}
                              {formatDelayHours(s.delay_hours)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button size="sm" disabled={applying} className="btn-gradient text-white">
                      Aplicar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
