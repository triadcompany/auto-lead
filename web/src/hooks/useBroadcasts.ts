import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Dispara o broadcast-worker via fetch com keepalive: true para garantir
// que o request não seja cancelado se a UI fechar o modal logo em seguida.
// Era o motivo das campanhas ficarem em "Em andamento" sem disparar nada.
async function triggerBroadcastWorker(campaignId: string) {
  try {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    await fetch(`${SUPABASE_URL}/functions/v1/broadcast-worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({ campaign_id: campaignId }),
      keepalive: true,
    });
  } catch (err) {
    console.error('[broadcasts] worker trigger failed:', err);
  }
}
export interface BroadcastCampaign {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  instance_name: string;
  status: 'running' | 'paused' | 'completed' | 'canceled' | 'scheduled';
  payload_type: 'text' | 'image' | 'audio' | 'interactive';
  payload: Record<string, any>;
  buttons: any;
  settings: Record<string, any>;
  source_type: 'spreadsheet' | 'crm_leads' | 'inbox';
  source_filters: Record<string, any> | null;
  scheduled_at: string | null;
  created_at: string;
  enable_automation: boolean;
  automation_id: string | null;
  response_window_hours: number;
  total?: number;
  sent?: number;
  failed?: number;
  responded?: number;
}

export interface BroadcastRecipient {
  id: string;
  campaign_id: string;
  organization_id: string;
  phone: string;
  name: string | null;
  variables: Record<string, any> | null;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
  sent_at: string | null;
  error: string | null;
  message_id: string | null;
  response_received: boolean;
  response_at: string | null;
  response_message_id: string | null;
  created_at: string;
}

export function useBroadcasts() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({
    queryKey: ['broadcasts', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      // Fetch campaigns
      const { data: rawCampaigns, error } = await supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!rawCampaigns?.length) return [];

      // Single query for all recipient stats (fixes N+1)
      const campaignIds = rawCampaigns.map(c => c.id);
      const { data: allRecipients } = await supabase
        .from('broadcast_recipients')
        .select('campaign_id, status, response_received')
        .in('campaign_id', campaignIds);

      // Aggregate stats client-side
      const statMap = new Map<string, { total: number; sent: number; failed: number; responded: number }>();
      for (const r of allRecipients || []) {
        const s = statMap.get(r.campaign_id) ?? { total: 0, sent: 0, failed: 0, responded: 0 };
        s.total++;
        if (r.status === 'sent') s.sent++;
        if (r.status === 'failed') s.failed++;
        if ((r as any).response_received) s.responded++;
        statMap.set(r.campaign_id, s);
      }

      return rawCampaigns.map(c => ({
        ...c,
        status: c.status as BroadcastCampaign['status'],
        payload_type: c.payload_type as BroadcastCampaign['payload_type'],
        payload: c.payload as Record<string, any>,
        settings: c.settings as Record<string, any>,
        source_type: ((c as any).source_type || 'spreadsheet') as BroadcastCampaign['source_type'],
        source_filters: (c as any).source_filters || null,
        scheduled_at: (c as any).scheduled_at || null,
        enable_automation: c.enable_automation || false,
        automation_id: c.automation_id || null,
        response_window_hours: c.response_window_hours || 24,
        ...statMap.get(c.id) ?? { total: 0, sent: 0, failed: 0, responded: 0 },
      })) as BroadcastCampaign[];
    },
  });

  const createCampaign = useMutation({
    mutationFn: async (params: {
      name: string;
      instance_name: string;
      payload_type: 'text' | 'image' | 'audio' | 'interactive';
      payload: Record<string, any>;
      settings: Record<string, any>;
      recipients: Array<{ phone: string; name?: string; variables?: Record<string, any> }>;
      profileId: string;
      enableAutomation?: boolean;
      automationId?: string | null;
      responseWindowHours?: number;
      buttons?: Array<{ label: string; value: string }> | null;
      sourceType?: 'spreadsheet' | 'crm_leads' | 'inbox';
      sourceFilters?: Record<string, any> | null;
      scheduledAt?: string | null;
    }) => {
      // Fail fast before touching the DB
      if (!params.recipients || params.recipients.length === 0) {
        throw new Error('Nenhum destinatário válido encontrado. Verifique os telefones da sua lista.');
      }

      const isScheduled = !!params.scheduledAt;
      const { data: campaign, error: cErr } = await supabase
        .from('broadcast_campaigns')
        .insert({
          organization_id: orgId!,
          created_by: params.profileId,
          name: params.name,
          instance_name: params.instance_name,
          payload_type: params.payload_type,
          payload: params.payload,
          settings: params.settings,
          status: isScheduled ? 'scheduled' : 'running',
          enable_automation: params.enableAutomation || false,
          automation_id: params.automationId || null,
          response_window_hours: params.responseWindowHours || 24,
          buttons: params.buttons || null,
          source_type: params.sourceType || 'spreadsheet',
          source_filters: params.sourceFilters || null,
          scheduled_at: params.scheduledAt || null,
        } as any)
        .select('id')
        .single();
      if (cErr) throw cErr;

      // Insert recipients in batches of 500.
      // On failure: cancel the campaign so it doesn't stay stuck in 'running'.
      const batchSize = 500;
      try {
        for (let i = 0; i < params.recipients.length; i += batchSize) {
          const batch = params.recipients.slice(i, i + batchSize).map(r => ({
            campaign_id: campaign.id,
            organization_id: orgId!,
            phone: r.phone,
            name: r.name || null,
            variables: r.variables || null,
            status: 'pending' as const,
          }));
          const { error: rErr } = await supabase.from('broadcast_recipients').insert(batch);
          if (rErr) throw rErr;
        }
      } catch (err) {
        // Rollback: mark campaign as canceled so it doesn't appear stuck
        await supabase
          .from('broadcast_campaigns')
          .update({ status: 'canceled' })
          .eq('id', campaign.id);
        throw err;
      }

      // Only trigger worker immediately if not scheduled
      if (!isScheduled) {
        await triggerBroadcastWorker(campaign.id);
      }

      return campaign.id;
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success(
        params.scheduledAt
          ? 'Campanha agendada com sucesso!'
          : 'Campanha criada e disparos iniciados!'
      );
    },
    onError: (err: any) => {
      toast.error('Erro ao criar campanha: ' + err.message);
    },
  });

  const updateCampaign = useMutation({
    mutationFn: async (params: {
      id: string;
      name?: string;
      payload?: Record<string, any>;
      settings?: Record<string, any>;
      response_window_hours?: number;
      enable_automation?: boolean;
      automation_id?: string | null;
      scheduled_at?: string | null;
    }) => {
      const update: {
        name?: string;
        payload?: any;
        settings?: any;
        response_window_hours?: number;
        enable_automation?: boolean;
        automation_id?: string | null;
        scheduled_at?: string | null;
      } = {};
      if (params.name !== undefined) update.name = params.name;
      if (params.payload !== undefined) update.payload = params.payload;
      if (params.settings !== undefined) update.settings = params.settings;
      if (params.response_window_hours !== undefined)
        update.response_window_hours = params.response_window_hours;
      if (params.enable_automation !== undefined)
        update.enable_automation = params.enable_automation;
      if (params.automation_id !== undefined) update.automation_id = params.automation_id;
      if (params.scheduled_at !== undefined) update.scheduled_at = params.scheduled_at;

      const { error } = await supabase
        .from('broadcast_campaigns')
        .update(update)
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['broadcast-detail'] });
      toast.success('Campanha atualizada');
    },
    onError: (err: any) => {
      toast.error('Erro ao atualizar: ' + err.message);
    },
  });

  const updateCampaignStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('broadcast_campaigns')
        .update({ status })
        .eq('id', id);
      if (error) throw error;

      if (status === 'running') {
        await triggerBroadcastWorker(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['broadcast-detail'] });
    },
  });

  const retryFailed = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('broadcast_recipients')
        .update({ status: 'pending', error: null })
        .eq('campaign_id', campaignId)
        .eq('status', 'failed');
      if (error) throw error;

      await supabase
        .from('broadcast_campaigns')
        .update({ status: 'running' })
        .eq('id', campaignId);

      await triggerBroadcastWorker(campaignId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['broadcast-detail'] });
      toast.success('Reenvio de falhas iniciado');
    },
  });

  const duplicateCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      // Get original campaign
      const { data: original, error: fErr } = await supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();
      if (fErr || !original) throw new Error('Campanha não encontrada');

      // Get original recipients
      const { data: recipients } = await supabase
        .from('broadcast_recipients')
        .select('phone, name, variables')
        .eq('campaign_id', campaignId);

      // Create new campaign as draft (paused)
      const { data: newCampaign, error: cErr } = await supabase
        .from('broadcast_campaigns')
        .insert({
          organization_id: original.organization_id,
          created_by: original.created_by,
          name: `${original.name} (cópia)`,
          instance_name: original.instance_name,
          payload_type: original.payload_type,
          payload: original.payload,
          settings: original.settings,
          status: 'paused',
          enable_automation: original.enable_automation,
          automation_id: original.automation_id,
          response_window_hours: original.response_window_hours,
          buttons: original.buttons,
          source_type: (original as any).source_type || 'spreadsheet',
          source_filters: (original as any).source_filters || null,
          scheduled_at: null,
        } as any)
        .select('id')
        .single();
      if (cErr) throw cErr;

      // Copy recipients in batches
      if (recipients?.length) {
        const batchSize = 500;
        for (let i = 0; i < recipients.length; i += batchSize) {
          const batch = recipients.slice(i, i + batchSize).map(r => ({
            campaign_id: newCampaign.id,
            organization_id: original.organization_id,
            phone: r.phone,
            name: r.name || null,
            variables: r.variables || null,
            status: 'pending' as const,
          }));
          await supabase.from('broadcast_recipients').insert(batch);
        }
      }

      return newCampaign.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Campanha duplicada! Ela está pausada — revise e inicie quando quiser.');
    },
    onError: (err: any) => {
      toast.error('Erro ao duplicar: ' + err.message);
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      // Apaga destinatários primeiro (FK), depois a campanha
      const { error: rErr } = await supabase
        .from('broadcast_recipients')
        .delete()
        .eq('campaign_id', campaignId);
      if (rErr) throw rErr;

      const { error: cErr } = await supabase
        .from('broadcast_campaigns')
        .delete()
        .eq('id', campaignId);
      if (cErr) throw cErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Campanha excluída');
    },
    onError: (err: any) => {
      toast.error('Erro ao excluir: ' + err.message);
    },
  });

  return {
    campaigns: campaignsQuery.data || [],
    loading: campaignsQuery.isLoading,
    refetch: campaignsQuery.refetch,
    createCampaign,
    updateCampaign,
    updateCampaignStatus,
    retryFailed,
    duplicateCampaign,
    deleteCampaign,
  };
}

export function useBroadcastDetail(campaignId: string | undefined) {
  const { orgId } = useAuth();

  const campaignQuery = useQuery({
    queryKey: ['broadcast-detail', campaignId],
    enabled: !!campaignId && !!orgId,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('id', campaignId!)
        .single();
      if (error) throw error;
      return data as unknown as BroadcastCampaign;
    },
  });

  const recipientsQuery = useQuery({
    queryKey: ['broadcast-recipients', campaignId],
    enabled: !!campaignId && !!orgId,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('broadcast_recipients')
        .select('*')
        .eq('campaign_id', campaignId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as BroadcastRecipient[];
    },
  });

  const stats = {
    total: recipientsQuery.data?.length || 0,
    sent: recipientsQuery.data?.filter(r => r.status === 'sent').length || 0,
    failed: recipientsQuery.data?.filter(r => r.status === 'failed').length || 0,
    pending: recipientsQuery.data?.filter(r => r.status === 'pending').length || 0,
    sending: recipientsQuery.data?.filter(r => r.status === 'sending').length || 0,
    responded: recipientsQuery.data?.filter(r => (r as any).response_received === true).length || 0,
  };

  return {
    campaign: campaignQuery.data,
    recipients: recipientsQuery.data || [],
    stats,
    loading: campaignQuery.isLoading,
  };
}
