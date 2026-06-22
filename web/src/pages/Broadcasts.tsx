import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBroadcasts, BroadcastCampaign } from '@/hooks/useBroadcasts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Radio, Loader2, Eye, Pause, Play, XCircle, Copy, Pencil, Trash2,
  MoreVertical, Search, FileSpreadsheet, Users, MessageSquare, Calendar,
  CheckCircle, MessageSquareReply, AlertTriangle, Clock,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NewCampaignWizard } from '@/components/broadcasts/NewCampaignWizard';
import { EditCampaignModal } from '@/components/broadcasts/EditCampaignModal';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  running:   { label: 'Em andamento', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  paused:    { label: 'Pausada',      className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  completed: { label: 'Concluída',    className: 'bg-blue-100 text-blue-700 border-blue-200' },
  canceled:  { label: 'Cancelada',    className: 'bg-red-100 text-red-700 border-red-200' },
  scheduled: { label: 'Agendada',     className: 'bg-purple-100 text-purple-700 border-purple-200' },
};

const SOURCE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  spreadsheet: { label: 'Planilha',  icon: <FileSpreadsheet className="h-3 w-3" /> },
  crm_leads:   { label: 'Leads CRM', icon: <Users className="h-3 w-3" /> },
  inbox:       { label: 'Inbox',     icon: <MessageSquare className="h-3 w-3" /> },
};

export default function Broadcasts() {
  const { campaigns, loading, updateCampaignStatus, duplicateCampaign, deleteCampaign } = useBroadcasts();
  const [showWizard, setShowWizard] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<BroadcastCampaign | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<BroadcastCampaign | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();

  const filtered = campaigns.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleStatusAction = (e: React.MouseEvent, id: string, status: string) => {
    e.stopPropagation();
    updateCampaignStatus.mutate({ id, status });
  };

  const handleDuplicate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    duplicateCampaign.mutate(id);
  };

  const handleEdit = (e: React.MouseEvent, campaign: BroadcastCampaign) => {
    e.stopPropagation();
    setEditingCampaign(campaign);
  };

  const handleDelete = (e: React.MouseEvent, campaign: BroadcastCampaign) => {
    e.stopPropagation();
    setDeletingCampaign(campaign);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader
          title="Disparos"
          description="Envie mensagens em massa via WhatsApp"
        />
        <Button onClick={() => setShowWizard(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campanha..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="running">Em andamento</SelectItem>
            <SelectItem value="scheduled">Agendadas</SelectItem>
            <SelectItem value="paused">Pausadas</SelectItem>
            <SelectItem value="completed">Concluídas</SelectItem>
            <SelectItem value="canceled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Radio className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium">
            {campaigns.length === 0 ? 'Nenhuma campanha ainda' : 'Nenhuma campanha encontrada'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {campaigns.length === 0
              ? 'Crie sua primeira campanha de disparos'
              : 'Tente ajustar os filtros de busca'}
          </p>
          {campaigns.length === 0 && (
            <Button className="mt-4" onClick={() => setShowWizard(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nova Campanha
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(c => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onView={() => navigate(`/broadcasts/${c.id}`)}
              onStatusAction={handleStatusAction}
              onDuplicate={handleDuplicate}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showWizard && (
        <NewCampaignWizard onClose={() => setShowWizard(false)} />
      )}

      {editingCampaign && (
        <EditCampaignModal
          campaign={editingCampaign}
          onClose={() => setEditingCampaign(null)}
        />
      )}

      <AlertDialog open={!!deletingCampaign} onOpenChange={(open) => !open && setDeletingCampaign(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente a campanha
              {deletingCampaign ? ` "${deletingCampaign.name}"` : ''} e todos os seus destinatários.
              Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingCampaign) {
                  deleteCampaign.mutate(deletingCampaign.id);
                  setDeletingCampaign(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CampaignCard({
  campaign: c,
  onView,
  onStatusAction,
  onDuplicate,
  onEdit,
  onDelete,
}: {
  campaign: BroadcastCampaign;
  onView: () => void;
  onStatusAction: (e: React.MouseEvent, id: string, status: string) => void;
  onDuplicate: (e: React.MouseEvent, id: string) => void;
  onEdit: (e: React.MouseEvent, campaign: BroadcastCampaign) => void;
  onDelete: (e: React.MouseEvent, campaign: BroadcastCampaign) => void;
}) {
  const st = STATUS_CONFIG[c.status] ?? { label: c.status, className: 'bg-muted text-muted-foreground' };
  const src = SOURCE_CONFIG[c.source_type ?? 'spreadsheet'];
  const total = c.total ?? 0;
  const sent = c.sent ?? 0;
  const failed = c.failed ?? 0;
  const responded = c.responded ?? 0;
  const progress = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onView}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: name + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-base truncate">{c.name}</h3>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${st.className}`}>
                {c.status === 'running' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                {st.label}
              </span>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-muted text-muted-foreground">
                {src.icon} {src.label}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
              <span>{c.instance_name}</span>
              {c.scheduled_at ? (
                <span className="flex items-center gap-1 text-purple-600">
                  <Calendar className="h-3 w-3" />
                  Agendado p/ {format(new Date(c.scheduled_at), "dd/MM HH:mm", { locale: ptBR })}
                </span>
              ) : (
                <span>{format(new Date(c.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
              )}
            </div>

            {/* Progress bar */}
            {total > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{sent + failed} de {total} processados</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="h-3.5 w-3.5" />
                {sent} enviados
              </span>
              <span className="flex items-center gap-1 text-blue-600">
                <MessageSquareReply className="h-3.5 w-3.5" />
                {responded} responderam
              </span>
              {failed > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {failed} falhas
                </span>
              )}
              {(c.total ?? 0) - (sent + failed) > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {total - sent - failed} pendentes
                </span>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onView} title="Ver detalhes">
              <Eye className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {c.status !== 'completed' && (
                  <DropdownMenuItem onClick={e => onEdit(e, c)}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                  </DropdownMenuItem>
                )}
                {c.status === 'running' && (
                  <DropdownMenuItem onClick={e => onStatusAction(e, c.id, 'paused')}>
                    <Pause className="h-4 w-4 mr-2" /> Pausar
                  </DropdownMenuItem>
                )}
                {(c.status === 'paused' || c.status === 'scheduled') && (
                  <DropdownMenuItem onClick={e => onStatusAction(e, c.id, 'running')}>
                    <Play className="h-4 w-4 mr-2" /> Iniciar
                  </DropdownMenuItem>
                )}
                {(c.status === 'running' || c.status === 'paused' || c.status === 'scheduled') && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={e => onStatusAction(e, c.id, 'canceled')}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Cancelar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={e => onDuplicate(e, c.id)}>
                  <Copy className="h-4 w-4 mr-2" /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={e => onDelete(e, c)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
