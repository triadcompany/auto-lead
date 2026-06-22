import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Clock, Plus, Pencil, Trash2, Loader2, Users, Megaphone, MessageCircle, CalendarDays,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Profile } from '@/hooks/useSupabaseProfiles';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DistributionSchedule {
  id?: string;
  organization_id: string;
  bucket: 'traffic' | 'non_traffic' | 'all';
  name: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  assigned_user_ids: string[];
  is_active: boolean;
  priority: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

const DAY_SHORT: Record<number, string> = {
  0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb',
};

const BUCKET_LABELS: Record<string, string> = {
  traffic: 'Tráfego',
  non_traffic: 'Orgânico',
  all: 'Todos',
};

const emptySchedule = (orgId: string): DistributionSchedule => ({
  organization_id: orgId,
  bucket: 'all',
  name: '',
  days_of_week: [1, 2, 3, 4, 5],
  start_time: '08:00',
  end_time: '18:00',
  assigned_user_ids: [],
  is_active: true,
  priority: 0,
});

// ── Sub-component: Schedule Form Dialog ───────────────────────────────────────

interface ScheduleDialogProps {
  open: boolean;
  initial: DistributionSchedule;
  profiles: Profile[];
  onClose: () => void;
  onSave: (schedule: DistributionSchedule) => Promise<void>;
}

function ScheduleDialog({ open, initial, profiles, onClose, onSave }: ScheduleDialogProps) {
  const [form, setForm] = useState<DistributionSchedule>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day],
    }));
  };

  const toggleUser = (userId: string) => {
    setForm(prev => ({
      ...prev,
      assigned_user_ids: prev.assigned_user_ids.includes(userId)
        ? prev.assigned_user_ids.filter(id => id !== userId)
        : [...prev.assigned_user_ids, userId],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Informe o nome da regra'); return; }
    if (form.days_of_week.length === 0) { toast.error('Selecione ao menos um dia'); return; }
    if (form.assigned_user_ids.length === 0) { toast.error('Selecione ao menos um usuário'); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-poppins flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {form.id ? 'Editar regra de horário' : 'Nova regra de horário'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="font-poppins text-sm font-medium">Nome da regra</Label>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Horário comercial, Fora do horário"
              className="font-poppins"
              autoFocus
            />
          </div>

          {/* Bucket */}
          <div className="space-y-1.5">
            <Label className="font-poppins text-sm font-medium">Aplica a</Label>
            <Select value={form.bucket} onValueChange={v => setForm(f => ({ ...f, bucket: v as any }))}>
              <SelectTrigger className="font-poppins">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os leads</SelectItem>
                <SelectItem value="traffic">Tráfego (Ads)</SelectItem>
                <SelectItem value="non_traffic">Orgânico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Days */}
          <div className="space-y-1.5">
            <Label className="font-poppins text-sm font-medium">Dias da semana</Label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map(day => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    form.days_of_week.includes(day.value)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-poppins text-sm font-medium">Início</Label>
              <Input
                type="time"
                value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                className="font-poppins"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-poppins text-sm font-medium">Fim</Label>
              <Input
                type="time"
                value={form.end_time}
                onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                className="font-poppins"
              />
              {form.start_time > form.end_time && (
                <p className="text-xs text-amber-600 font-poppins">
                  Janela passa da meia-noite (ex: 22:00 → 06:00)
                </p>
              )}
            </div>
          </div>

          {/* Users */}
          <div className="space-y-1.5">
            <Label className="font-poppins text-sm font-medium flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Usuários que recebem leads nesse horário
            </Label>
            <div className="space-y-1.5 max-h-44 overflow-y-auto rounded-md border border-border p-2">
              {profiles.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  Nenhum usuário encontrado
                </p>
              ) : profiles.map(p => (
                <label
                  key={p.id}
                  className="flex items-center gap-2.5 p-2 rounded hover:bg-accent/50 cursor-pointer"
                >
                  <Checkbox
                    checked={form.assigned_user_ids.includes(p.user_id)}
                    onCheckedChange={() => toggleUser(p.user_id)}
                  />
                  <span className="text-sm font-poppins font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">({p.role})</span>
                </label>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label className="font-poppins text-sm font-medium">
              Prioridade
              <span className="text-xs font-normal text-muted-foreground ml-1">(menor número = maior prioridade)</span>
            </Label>
            <Input
              type="number"
              min={0}
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
              className="font-poppins w-24"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="font-poppins">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="btn-gradient text-white font-poppins">
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Clock className="h-4 w-4 mr-1.5" />}
            Salvar regra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface DistributionScheduleManagerProps {
  orgId: string;
  profiles: Profile[];
  isAdmin: boolean;
}

export function DistributionScheduleManager({ orgId, profiles, isAdmin }: DistributionScheduleManagerProps) {
  const [schedules, setSchedules] = useState<DistributionSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DistributionSchedule | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('distribution_schedules')
        .select('*')
        .eq('organization_id', orgId)
        .order('priority', { ascending: true })
        .order('name');
      if (error) throw error;
      setSchedules((data || []) as DistributionSchedule[]);
    } catch (err) {
      console.error('Error fetching schedules:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const getUserName = (userId: string) => {
    const p = profiles.find(pr => pr.user_id === userId || pr.id === userId || pr.clerk_user_id === userId);
    return p?.name || 'Usuário';
  };

  const handleSave = async (schedule: DistributionSchedule) => {
    try {
      if (schedule.id) {
        const { error } = await supabase
          .from('distribution_schedules')
          .update({
            bucket: schedule.bucket,
            name: schedule.name,
            days_of_week: schedule.days_of_week,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            assigned_user_ids: schedule.assigned_user_ids,
            is_active: schedule.is_active,
            priority: schedule.priority,
          })
          .eq('id', schedule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('distribution_schedules')
          .insert({
            organization_id: orgId,
            bucket: schedule.bucket,
            name: schedule.name,
            days_of_week: schedule.days_of_week,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            assigned_user_ids: schedule.assigned_user_ids,
            is_active: schedule.is_active,
            priority: schedule.priority,
          });
        if (error) throw error;
      }
      toast.success(schedule.id ? 'Regra atualizada' : 'Regra criada');
      await fetchSchedules();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar regra');
      throw err;
    }
  };

  const handleToggleActive = async (schedule: DistributionSchedule) => {
    if (!schedule.id) return;
    try {
      const { error } = await supabase
        .from('distribution_schedules')
        .update({ is_active: !schedule.is_active })
        .eq('id', schedule.id);
      if (error) throw error;
      setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, is_active: !s.is_active } : s));
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar regra');
    }
  };

  const handleDelete = async (scheduleId: string) => {
    setDeleting(scheduleId);
    try {
      const { error } = await supabase
        .from('distribution_schedules')
        .delete()
        .eq('id', scheduleId);
      if (error) throw error;
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      toast.success('Regra excluída');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir regra');
    } finally {
      setDeleting(null);
    }
  };

  const openEdit = (schedule: DistributionSchedule) => {
    setEditing(schedule);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const formatDays = (days: number[]) => {
    if (days.length === 7) return 'Todos os dias';
    if (days.length === 0) return 'Nenhum dia';
    const sorted = [...days].sort((a, b) => a - b);
    return sorted.map(d => DAY_SHORT[d]).join(', ');
  };

  const formatTime = (t: string) => t.substring(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-poppins font-semibold text-sm text-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Regras de Horário
          </h4>
          <p className="text-xs text-muted-foreground font-poppins mt-0.5">
            Defina quais usuários recebem leads em horários específicos. Quando uma regra se aplica,
            ela substitui a lista padrão do round-robin.
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={openCreate} className="font-poppins gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Adicionar regra
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-6 text-center">
          <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-poppins">
            Nenhuma regra de horário configurada
          </p>
          <p className="text-xs text-muted-foreground font-poppins mt-1">
            Sem regras, todos os leads seguem a configuração padrão do bucket.
          </p>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={openCreate} className="mt-4 font-poppins gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Criar primeira regra
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {schedules.map(schedule => (
            <div
              key={schedule.id}
              className={`rounded-xl border p-4 transition-colors ${
                schedule.is_active ? 'border-border bg-card' : 'border-border/50 bg-muted/30 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-poppins font-semibold text-sm">{schedule.name}</span>
                    <Badge variant={schedule.is_active ? 'default' : 'secondary'} className="text-[10px] px-1.5">
                      {schedule.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 gap-1">
                      {schedule.bucket === 'traffic' && <Megaphone className="h-2.5 w-2.5" />}
                      {schedule.bucket === 'non_traffic' && <MessageCircle className="h-2.5 w-2.5" />}
                      {BUCKET_LABELS[schedule.bucket]}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-poppins">
                      prioridade {schedule.priority}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground font-poppins">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {formatDays(schedule.days_of_week)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(schedule.start_time)} → {formatTime(schedule.end_time)}
                      {schedule.start_time > schedule.end_time && (
                        <span className="text-amber-600 ml-1">(passa meia-noite)</span>
                      )}
                    </span>
                  </div>

                  {schedule.assigned_user_ids.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {schedule.assigned_user_ids.map(uid => (
                        <Badge key={uid} variant="secondary" className="text-[10px] px-1.5 font-poppins">
                          {getUserName(uid)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isAdmin && (
                    <>
                      <Switch
                        checked={schedule.is_active}
                        onCheckedChange={() => handleToggleActive(schedule)}
                        className="scale-90"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(schedule)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(schedule.id!)}
                        disabled={deleting === schedule.id}
                      >
                        {deleting === schedule.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ScheduleDialog
        open={dialogOpen}
        initial={editing ?? emptySchedule(orgId)}
        profiles={profiles}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
