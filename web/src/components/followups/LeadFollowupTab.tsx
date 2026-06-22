import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  MessageCircle, 
  Calendar, 
  Clock, 
  Plus, 
  PlayCircle, 
  PauseCircle,
  Send,
  CheckCircle,
  XCircle,
  ArrowRight,
  Phone,
  Mail
} from "lucide-react";
import { useFollowups } from "@/hooks/useFollowups";
import { followupStatusColors, followupStatusLabels, channelLabels } from "@/types/followup";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateFollowupModal } from "./CreateFollowupModal";
import { ApplyCadenceModal } from "./ApplyCadenceModal";

interface LeadFollowupTabProps {
  leadId: string;
  leadName: string;
  leadPhone: string;
  sellerId: string;
}

export function LeadFollowupTab({ leadId, leadName, leadPhone, sellerId }: LeadFollowupTabProps) {
  const { followups, loading, sendNow, skipFollowup, rescheduleFollowup } = useFollowups();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [cadenceModalOpen, setCadenceModalOpen] = useState(false);

  // Filter followups for this lead
  const leadFollowups = followups.filter(f => f.lead_id === leadId);
  const pendingFollowups = leadFollowups.filter(f => f.status === 'PENDENTE');
  const completedFollowups = leadFollowups.filter(f => f.status !== 'PENDENTE');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ENVIADO':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'FALHOU':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'PULADO':
        return <ArrowRight className="h-4 w-4 text-gray-500" />;
      case 'CANCELADO':
        return <XCircle className="h-4 w-4 text-gray-400" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageCircle className="h-4 w-4 text-emerald-500" />;
      case 'email':
        return <Mail className="h-4 w-4 text-blue-500" />;
      case 'sms':
        return <Phone className="h-4 w-4 text-violet-500" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ações Rápidas */}
      <div className="flex flex-wrap gap-2">
        <Button 
          size="sm" 
          onClick={() => setCreateModalOpen(true)}
          className="btn-gradient text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Criar Follow-up
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setCadenceModalOpen(true)}
        >
          <PlayCircle className="h-4 w-4 mr-1" />
          Aplicar Cadência
        </Button>
      </div>

      {/* Próximos Follow-ups */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          Próximos Follow-ups ({pendingFollowups.length})
        </h4>

        {pendingFollowups.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-4 text-center text-muted-foreground text-sm">
              Nenhum follow-up agendado
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {pendingFollowups.map((followup) => {
              const isOverdue = isPast(new Date(followup.scheduled_for));
              return (
                <Card key={followup.id} className={`${isOverdue ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20' : ''}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        {getChannelIcon(followup.channel)}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {channelLabels[followup.channel]}
                            </span>
                            {isOverdue && (
                              <Badge variant="destructive" className="text-xs">
                                Atrasado
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(followup.scheduled_for), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            {' · '}
                            {formatDistanceToNow(new Date(followup.scheduled_for), { addSuffix: true, locale: ptBR })}
                          </p>
                          {followup.message_custom && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {followup.message_custom}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-emerald-600 hover:text-emerald-700"
                          onClick={() => sendNow(followup.id)}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Enviar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => skipFollowup(followup.id)}
                        >
                          Pular
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* Histórico / Timeline */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          Histórico de Comunicação
        </h4>

        {completedFollowups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma comunicação registrada ainda
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
            
            <div className="space-y-4">
              {completedFollowups.map((followup) => (
                <div key={followup.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-background border-2 border-primary" />
                  
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(followup.status)}
                        <span className="text-sm font-medium">
                          {channelLabels[followup.channel]}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${followupStatusColors[followup.status]}`}
                        >
                          {followupStatusLabels[followup.status]}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(followup.sent_at || followup.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    
                    {followup.message_custom && (
                      <p className="text-sm text-muted-foreground">
                        {followup.message_custom}
                      </p>
                    )}

                    {followup.notes && (
                      <p className="text-xs text-muted-foreground italic">
                        Obs: {followup.notes}
                      </p>
                    )}

                    {followup.sent_by && (
                      <p className="text-xs text-muted-foreground">
                        Enviado: {followup.sent_by === 'AUTO' ? 'Automático' : 'Manual'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateFollowupModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        leadId={leadId}
        leadName={leadName}
        sellerId={sellerId}
      />
      
      <ApplyCadenceModal
        open={cadenceModalOpen}
        onOpenChange={setCadenceModalOpen}
        leadId={leadId}
        leadName={leadName}
        sellerId={sellerId}
      />
    </div>
  );
}
