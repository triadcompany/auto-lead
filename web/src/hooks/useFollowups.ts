import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';
import {
  Followup,
  FollowupFilter,
  FollowupStatus,
  MessageChannel
} from '@/types/followup';

export function useFollowups() {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FollowupFilter>('hoje');
  const [sellerFilter, setSellerFilter] = useState<string>('todos');
  const { profile, isAdmin, orgId: authOrgId } = useAuth();
  const resolvedOrgId = profile?.organization_id || authOrgId;
  const { toast } = useToast();
  const api = useApi();

  const fetchFollowups = useCallback(async () => {
    if (!resolvedOrgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.followups.list({
        ...(filter !== 'todos' && { status: 'PENDENTE' }),
        ...(isAdmin && sellerFilter !== 'todos' && { lead_id: undefined }),
      }) as any[];

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const next7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

      let filtered = data;
      if (filter === 'hoje') {
        filtered = data.filter(f => {
          const d = new Date(f.scheduled_for || f.scheduledFor);
          return d >= todayStart && d < todayEnd && (f.status === 'PENDENTE');
        });
      } else if (filter === 'atrasados') {
        filtered = data.filter(f => new Date(f.scheduled_for || f.scheduledFor) < now && f.status === 'PENDENTE');
      } else if (filter === 'proximos_7_dias') {
        filtered = data.filter(f => {
          const d = new Date(f.scheduled_for || f.scheduledFor);
          return d >= todayStart && d < next7Days && f.status === 'PENDENTE';
        });
      }

      if (isAdmin && sellerFilter !== 'todos') {
        filtered = filtered.filter(f => (f.assigned_to || f.assignedTo) === sellerFilter);
      }

      setFollowups(filtered as unknown as Followup[]);
    } catch (error: any) {
      console.error('Erro ao buscar follow-ups:', error);
      toast({ title: "Erro", description: "Erro ao carregar follow-ups", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [resolvedOrgId, filter, sellerFilter, isAdmin, toast, api]);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  const sendNow = async (followupId: string) => {
    try {
      await api.followups.update(followupId, {
        status: 'ENVIADO' as FollowupStatus,
        sent_at: new Date().toISOString(),
        sent_by: 'MANUAL',
      });
      toast({ title: "Sucesso", description: "Follow-up marcado como enviado" });
      fetchFollowups();
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao enviar follow-up", variant: "destructive" });
    }
  };

  const skipFollowup = async (followupId: string, notes?: string) => {
    try {
      await api.followups.update(followupId, {
        status: 'PULADO' as FollowupStatus,
        notes: notes || 'Pulado manualmente',
      });
      toast({ title: "Sucesso", description: "Follow-up pulado" });
      fetchFollowups();
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao pular follow-up", variant: "destructive" });
    }
  };

  const rescheduleFollowup = async (followupId: string, newDate: Date) => {
    try {
      await api.followups.update(followupId, { scheduled_for: newDate.toISOString() });
      toast({ title: "Sucesso", description: "Follow-up reagendado" });
      fetchFollowups();
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao reagendar follow-up", variant: "destructive" });
    }
  };

  const createFollowup = async (data: {
    lead_id: string;
    assigned_to: string;
    scheduled_for: Date;
    channel?: MessageChannel;
    template_id?: string;
    message_custom?: string;
  }) => {
    if (!profile) return;
    try {
      await api.followups.create({
        lead_id: data.lead_id,
        assigned_to: data.assigned_to,
        scheduled_for: data.scheduled_for.toISOString(),
        channel: data.channel || 'whatsapp',
        status: 'PENDENTE',
        template_id: data.template_id,
        message_custom: data.message_custom,
      });
      toast({ title: "Sucesso", description: "Follow-up criado com sucesso" });
      fetchFollowups();
    } catch (error: any) {
      toast({ title: "Erro", description: "Erro ao criar follow-up", variant: "destructive" });
    }
  };

  const applyCadence = async (leadId: string, cadenceId: string, assignedTo: string) => {
    try {
      const result = await api.leads.applyCadence(leadId, cadenceId, assignedTo) as any;
      toast({ title: "Cadência aplicada", description: `${result.created} follow-up(s) agendado(s)` });
      fetchFollowups();
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Erro ao aplicar cadência", variant: "destructive" });
    }
  };

  const stats = {
    hoje: followups.filter(f => {
      const scheduledDate = new Date(f.scheduled_for);
      const today = new Date();
      return scheduledDate.toDateString() === today.toDateString() && f.status === 'PENDENTE';
    }).length,
    atrasados: followups.filter(f => new Date(f.scheduled_for) < new Date() && f.status === 'PENDENTE').length,
    pendentes: followups.filter(f => f.status === 'PENDENTE').length,
    enviados: followups.filter(f => f.status === 'ENVIADO').length,
  };

  return {
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
    createFollowup,
    applyCadence,
    refreshFollowups: fetchFollowups,
  };
}
