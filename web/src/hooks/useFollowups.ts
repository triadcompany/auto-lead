import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
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

  const fetchFollowups = useCallback(async () => {
    if (!resolvedOrgId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      let query = supabase
        .from('followups')
        .select(`
          *,
          lead:leads!lead_id(id, name, phone, email, interest, seller_id, stage_id),
          assigned_user:profiles!assigned_to(id, name),
          template:followup_templates!template_id(id, name, content, category)
        `)
        .eq('organization_id', resolvedOrgId)
        .order('scheduled_for', { ascending: true });

      // Aplicar filtro de data
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const next7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();

      switch (filter) {
        case 'hoje':
          query = query
            .gte('scheduled_for', todayStart)
            .lt('scheduled_for', todayEnd)
            .eq('status', 'PENDENTE');
          break;
        case 'atrasados':
          query = query
            .lt('scheduled_for', now.toISOString())
            .eq('status', 'PENDENTE');
          break;
        case 'proximos_7_dias':
          query = query
            .gte('scheduled_for', todayStart)
            .lt('scheduled_for', next7Days)
            .eq('status', 'PENDENTE');
          break;
        // 'todos' não adiciona filtro
      }

      // Filtro por vendedor (apenas para admin)
      if (isAdmin && sellerFilter !== 'todos') {
        query = query.eq('assigned_to', sellerFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Type assertion para contornar tipos gerados
      setFollowups((data || []) as unknown as Followup[]);
    } catch (error: any) {
      console.error('Erro ao buscar follow-ups:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar follow-ups",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [resolvedOrgId, filter, sellerFilter, isAdmin, toast]);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  // Enviar follow-up agora
  const sendNow = async (followupId: string) => {
    try {
      const { error } = await supabase
        .from('followups')
        .update({ 
          status: 'ENVIADO' as FollowupStatus,
          sent_at: new Date().toISOString(),
          sent_by: 'MANUAL',
          updated_at: new Date().toISOString()
        })
        .eq('id', followupId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Follow-up marcado como enviado",
      });

      fetchFollowups();
    } catch (error: any) {
      console.error('Erro ao enviar follow-up:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar follow-up",
        variant: "destructive",
      });
    }
  };

  // Pular follow-up
  const skipFollowup = async (followupId: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from('followups')
        .update({ 
          status: 'PULADO' as FollowupStatus,
          notes: notes || 'Pulado manualmente',
          updated_at: new Date().toISOString()
        })
        .eq('id', followupId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Follow-up pulado",
      });

      fetchFollowups();
    } catch (error: any) {
      console.error('Erro ao pular follow-up:', error);
      toast({
        title: "Erro",
        description: "Erro ao pular follow-up",
        variant: "destructive",
      });
    }
  };

  // Reagendar follow-up
  const rescheduleFollowup = async (followupId: string, newDate: Date) => {
    try {
      const { error } = await supabase
        .from('followups')
        .update({ 
          scheduled_for: newDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', followupId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Follow-up reagendado",
      });

      fetchFollowups();
    } catch (error: any) {
      console.error('Erro ao reagendar follow-up:', error);
      toast({
        title: "Erro",
        description: "Erro ao reagendar follow-up",
        variant: "destructive",
      });
    }
  };

  // Criar novo follow-up
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
      const { error } = await supabase
        .from('followups')
        .insert({
          organization_id: profile.organization_id,
          lead_id: data.lead_id,
          assigned_to: data.assigned_to,
          scheduled_for: data.scheduled_for.toISOString(),
          channel: data.channel || 'whatsapp',
          status: 'PENDENTE',
          template_id: data.template_id,
          message_custom: data.message_custom,
          created_by: profile.id,
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Follow-up criado com sucesso",
      });

      fetchFollowups();
    } catch (error: any) {
      console.error('Erro ao criar follow-up:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar follow-up",
        variant: "destructive",
      });
    }
  };

  // Aplicar cadência a um lead
  const applyCadence = async (leadId: string, cadenceId: string, assignedTo: string) => {
    if (!profile) return;

    try {
      const { data, error } = await supabase.rpc('apply_cadence_to_lead', {
        p_lead_id: leadId,
        p_cadence_id: cadenceId,
        p_assigned_to: assignedTo,
        p_created_by: profile.id,
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `${data} follow-ups criados a partir da cadência`,
      });

      fetchFollowups();
    } catch (error: any) {
      console.error('Erro ao aplicar cadência:', error);
      toast({
        title: "Erro",
        description: "Erro ao aplicar cadência",
        variant: "destructive",
      });
    }
  };

  // Estatísticas
  const stats = {
    hoje: followups.filter(f => {
      const scheduledDate = new Date(f.scheduled_for);
      const today = new Date();
      return (
        scheduledDate.toDateString() === today.toDateString() &&
        f.status === 'PENDENTE'
      );
    }).length,
    atrasados: followups.filter(f => {
      const scheduledDate = new Date(f.scheduled_for);
      return scheduledDate < new Date() && f.status === 'PENDENTE';
    }).length,
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
