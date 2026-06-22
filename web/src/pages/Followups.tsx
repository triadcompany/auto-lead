import { useState } from "react";
import { CRMLayout } from "@/components/layout/CRMLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Clock, 
  AlertCircle, 
  Calendar, 
  MessageCircle, 
  User, 
  Send, 
  SkipForward, 
  CalendarClock, 
  ExternalLink,
  Phone,
  CheckCircle2,
  XCircle,
  Loader2,
  Search
} from "lucide-react";
import { useFollowups } from "@/hooks/useFollowups";
import { useSupabaseProfiles } from "@/hooks/useSupabaseProfiles";
import { useAuth } from "@/contexts/AuthContext";
import { 
  FollowupFilter, 
  followupStatusColors, 
  followupStatusLabels,
  channelLabels 
} from "@/types/followup";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function Followups() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { profiles } = useSupabaseProfiles();
  const {
    followups,
    loading,
    filter,
    setFilter,
    sellerFilter,
    setSellerFilter,
    stats,
    sendNow,
    skipFollowup,
    rescheduleFollowup,
  } = useFollowups();

  const [searchTerm, setSearchTerm] = useState("");
  const [rescheduleModal, setRescheduleModal] = useState<{
    open: boolean;
    followupId: string | null;
    date: Date | undefined;
  }>({
    open: false,
    followupId: null,
    date: undefined,
  });

  const filterOptions: { value: FollowupFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'hoje', label: 'Hoje', icon: <Clock className="h-4 w-4" /> },
    { value: 'atrasados', label: 'Atrasados', icon: <AlertCircle className="h-4 w-4" /> },
    { value: 'proximos_7_dias', label: 'Próximos 7 dias', icon: <Calendar className="h-4 w-4" /> },
    { value: 'todos', label: 'Todos', icon: <MessageCircle className="h-4 w-4" /> },
  ];

  // Filtrar por busca
  const filteredFollowups = followups.filter(f => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      f.lead?.name?.toLowerCase().includes(term) ||
      f.lead?.phone?.includes(term) ||
      f.message_custom?.toLowerCase().includes(term)
    );
  });

  const handleReschedule = () => {
    if (rescheduleModal.followupId && rescheduleModal.date) {
      rescheduleFollowup(rescheduleModal.followupId, rescheduleModal.date);
      setRescheduleModal({ open: false, followupId: null, date: undefined });
    }
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanPhone}`, '_blank');
  };

  return (
    <CRMLayout>
      <div className="space-y-6">
        <PageHeader
          title="Central de Follow-ups"
          description="Gerencie todos os follow-ups agendados"
        />

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card 
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              filter === 'hoje' && "ring-2 ring-primary"
            )}
            onClick={() => setFilter('hoje')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.hoje}</p>
                  <p className="text-xs text-muted-foreground">Hoje</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              filter === 'atrasados' && "ring-2 ring-destructive"
            )}
            onClick={() => setFilter('atrasados')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{stats.atrasados}</p>
                  <p className="text-xs text-muted-foreground">Atrasados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent">
                  <CalendarClock className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pendentes}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.enviados}</p>
                  <p className="text-xs text-muted-foreground">Enviados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex gap-2 flex-wrap">
                {filterOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={filter === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(option.value)}
                    className="gap-2"
                  >
                    {option.icon}
                    {option.label}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2 flex-1 justify-end">
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar lead..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {isAdmin && (
                  <Select value={sellerFilter} onValueChange={setSellerFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos vendedores</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Follow-ups */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Follow-ups ({filteredFollowups.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredFollowups.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum follow-up encontrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFollowups.map((followup) => {
                  const isOverdue = isPast(new Date(followup.scheduled_for)) && followup.status === 'PENDENTE';
                  const isScheduledToday = isToday(new Date(followup.scheduled_for));

                  return (
                    <div
                      key={followup.id}
                      className={cn(
                        "p-4 rounded-lg border transition-all",
                        isOverdue && "border-destructive/50 bg-destructive/5",
                        isScheduledToday && !isOverdue && "border-primary/50 bg-primary/5"
                      )}
                    >
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        {/* Info do Lead */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold truncate">
                              {followup.lead?.name || 'Lead desconhecido'}
                            </span>
                            <Badge 
                              variant="outline" 
                              className={followupStatusColors[followup.status]}
                            >
                              {followupStatusLabels[followup.status]}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {followup.lead?.phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {channelLabels[followup.channel]}
                            </span>
                            {followup.assigned_user && (
                              <span className="hidden md:flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {followup.assigned_user.name}
                              </span>
                            )}
                          </div>

                          {followup.message_custom && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {followup.message_custom}
                            </p>
                          )}
                        </div>

                        {/* Data agendada */}
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarClock className={cn(
                            "h-4 w-4",
                            isOverdue ? "text-destructive" : "text-muted-foreground"
                          )} />
                          <span className={cn(
                            isOverdue && "text-destructive font-medium"
                          )}>
                            {format(new Date(followup.scheduled_for), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            ({formatDistanceToNow(new Date(followup.scheduled_for), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })})
                          </span>
                        </div>

                        {/* Ações */}
                        {followup.status === 'PENDENTE' && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1"
                              onClick={() => {
                                if (followup.lead?.phone) {
                                  openWhatsApp(followup.lead.phone);
                                  sendNow(followup.id);
                                }
                              }}
                            >
                              <Send className="h-3.5 w-3.5" />
                              Enviar
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRescheduleModal({
                                open: true,
                                followupId: followup.id,
                                date: new Date(followup.scheduled_for),
                              })}
                            >
                              <CalendarClock className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => skipFollowup(followup.id)}
                            >
                              <SkipForward className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/leads?lead=${followup.lead_id}`)}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Reagendamento */}
        <Dialog 
          open={rescheduleModal.open} 
          onOpenChange={(open) => setRescheduleModal({ ...rescheduleModal, open })}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reagendar Follow-up</DialogTitle>
            </DialogHeader>
            
            <div className="flex justify-center py-4">
              <CalendarComponent
                mode="single"
                selected={rescheduleModal.date}
                onSelect={(date) => setRescheduleModal({ ...rescheduleModal, date })}
                disabled={(date) => date < new Date()}
                locale={ptBR}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRescheduleModal({ open: false, followupId: null, date: undefined })}
              >
                Cancelar
              </Button>
              <Button onClick={handleReschedule} disabled={!rescheduleModal.date}>
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CRMLayout>
  );
}
