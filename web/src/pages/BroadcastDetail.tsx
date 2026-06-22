import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBroadcastDetail, useBroadcasts } from '@/hooks/useBroadcasts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Pause, Play, XCircle, RotateCcw, Loader2, Send, AlertTriangle, Clock, CheckCircle, MessageSquareReply } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const statusBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  sending: { label: 'Enviando', variant: 'default' },
  sent: { label: 'Enviado', variant: 'outline' },
  failed: { label: 'Falhou', variant: 'destructive' },
  skipped: { label: 'Pulado', variant: 'secondary' },
};

export default function BroadcastDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { campaign, recipients, stats, loading } = useBroadcastDetail(id);
  const { updateCampaignStatus, retryFailed } = useBroadcasts();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  if (loading || !campaign) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filtered = statusFilter === 'all'
    ? recipients
    : recipients.filter(r => r.status === statusFilter);

  const progress = stats.total > 0 ? Math.round(((stats.sent + stats.failed) / stats.total) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/broadcasts')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader title={campaign.name} description={`Instância: ${campaign.instance_name}`} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Send className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
            <div className="text-xs text-muted-foreground">Enviados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <MessageSquareReply className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <div className="text-2xl font-bold text-blue-600">{stats.responded}</div>
            <div className="text-xs text-muted-foreground">Respondidos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
            <div className="text-xs text-muted-foreground">Falhas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <div className="text-2xl font-bold">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Pendentes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Loader2 className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <div className="text-2xl font-bold">{stats.sending}</div>
            <div className="text-xs text-muted-foreground">Enviando</div>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso: {progress}%</span>
            <Badge variant={campaign.status === 'running' ? 'default' : 'secondary'}>
              {campaign.status === 'running' ? 'Em andamento' :
               campaign.status === 'paused' ? 'Pausada' :
               campaign.status === 'completed' ? 'Concluída' : 'Cancelada'}
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {campaign.status === 'running' && (
          <Button
            variant="outline"
            onClick={() => updateCampaignStatus.mutate({ id: campaign.id, status: 'paused' })}
            disabled={updateCampaignStatus.isPending}
          >
            <Pause className="h-4 w-4 mr-2" /> Pausar
          </Button>
        )}
        {campaign.status === 'paused' && (
          <Button
            onClick={() => updateCampaignStatus.mutate({ id: campaign.id, status: 'running' })}
            disabled={updateCampaignStatus.isPending}
          >
            <Play className="h-4 w-4 mr-2" /> Retomar
          </Button>
        )}
        {(campaign.status === 'running' || campaign.status === 'paused') && (
          <Button
            variant="destructive"
            onClick={() => updateCampaignStatus.mutate({ id: campaign.id, status: 'canceled' })}
            disabled={updateCampaignStatus.isPending}
          >
            <XCircle className="h-4 w-4 mr-2" /> Cancelar
          </Button>
        )}
        {stats.failed > 0 && (
          <Button
            variant="outline"
            onClick={() => retryFailed.mutate(campaign.id)}
            disabled={retryFailed.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Reenviar falhas ({stats.failed})
          </Button>
        )}
      </div>

      {/* Recipients Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Destinatários</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="sending">Enviando</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
                <SelectItem value="failed">Falhas</SelectItem>
                <SelectItem value="skipped">Pulados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Telefone</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Respondeu</TableHead>
                <TableHead>Enviado em</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum destinatário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.slice(0, 200).map((r) => {
                  const st = statusBadge[r.status] || { label: r.status, variant: 'outline' as const };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.phone}</TableCell>
                      <TableCell>{r.name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.response_received ? (
                          <Badge variant="default" className="bg-blue-500">Sim</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {r.sent_at ? new Date(r.sent_at).toLocaleString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell className="text-destructive text-xs max-w-[200px] truncate">
                        {r.error || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {filtered.length > 200 && (
            <div className="text-center text-sm text-muted-foreground py-3">
              Mostrando 200 de {filtered.length} destinatários
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
