import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useApi } from '@/hooks/useApi';

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

function normalize(c: any): BroadcastCampaign {
  return {
    id: c.id,
    organization_id: c.organizationId || c.organization_id || '',
    created_by: c.createdBy || c.created_by || '',
    name: c.name,
    instance_name: c.instanceName || c.instance_name || '',
    status: c.status,
    payload_type: c.payloadType || c.payload_type || 'text',
    payload: c.payload || {},
    buttons: c.buttons || null,
    settings: c.settings || {},
    source_type: c.sourceType || c.source_type || 'spreadsheet',
    source_filters: c.sourceFilters || c.source_filters || null,
    scheduled_at: c.scheduledAt || c.scheduled_at || null,
    created_at: c.createdAt || c.created_at || '',
    enable_automation: c.enableAutomation || c.enable_automation || false,
    automation_id: c.automationId || c.automation_id || null,
    response_window_hours: c.responseWindowHours || c.response_window_hours || 24,
    total: c.total,
    sent: c.sent,
    failed: c.failed,
    responded: c.responded,
  };
}

export function useBroadcasts() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const api = useApi();

  const campaignsQuery = useQuery({
    queryKey: ['broadcasts', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const data = await api.broadcasts.list() as any[];
      return data.map(normalize);
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
      if (!params.recipients || params.recipients.length === 0) {
        throw new Error('Nenhum destinatário válido encontrado. Verifique os telefones da sua lista.');
      }

      const isScheduled = !!params.scheduledAt;

      const campaign = await api.broadcasts.create({
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
      }) as any;

      await api.broadcasts.addRecipients(campaign.id, params.recipients);

      if (!isScheduled) {
        await api.broadcasts.start(campaign.id);
      }

      return campaign.id;
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success(
        params.scheduledAt ? 'Campanha agendada com sucesso!' : 'Campanha iniciada!',
        { description: `"${params.name}" está em andamento.` }
      );
    },
    onError: (err: any) => {
      toast.error('Erro ao criar campanha', { description: err.message });
    },
  });

  const pauseCampaign = useMutation({
    mutationFn: (id: string) => api.broadcasts.pause(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Campanha pausada');
    },
    onError: (err: any) => toast.error('Erro ao pausar', { description: err.message }),
  });

  const resumeCampaign = useMutation({
    mutationFn: (id: string) => api.broadcasts.start(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Campanha retomada');
    },
    onError: (err: any) => toast.error('Erro ao retomar', { description: err.message }),
  });

  const deleteCampaign = useMutation({
    mutationFn: (id: string) => api.broadcasts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Campanha excluída');
    },
    onError: (err: any) => toast.error('Erro ao excluir', { description: err.message }),
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
      const { id, ...data } = params;
      return api.broadcasts.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['broadcast'] });
      toast.success('Campanha atualizada');
    },
    onError: (err: any) => toast.error('Erro ao atualizar campanha', { description: err.message }),
  });

  const updateCampaignStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (status === 'paused') return api.broadcasts.pause(id);
      if (status === 'running') return api.broadcasts.start(id);
      if (status === 'cancelled' || status === 'canceled') return api.broadcasts.cancel(id);
      throw new Error(`Status desconhecido: ${status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Status da campanha atualizado');
    },
    onError: (err: any) => toast.error('Erro ao atualizar campanha', { description: err.message }),
  });

  const retryFailed = useMutation({
    mutationFn: async (id: string) => {
      await api.broadcasts.retry(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Reenvio iniciado');
    },
    onError: (err: any) => toast.error('Erro ao reenviar', { description: err.message }),
  });

  const duplicateCampaign = useMutation({
    mutationFn: async (id: string) => {
      const original = await api.broadcasts.get(id) as any;
      return api.broadcasts.create({
        name: `Cópia de ${original.name || original.instanceName || id}`,
        instance_name: original.instanceName || original.instance_name || '',
        payload_type: original.payloadType || original.payload_type || 'text',
        payload: original.payload || {},
        settings: original.settings || null,
        buttons: original.buttons || null,
        enable_automation: original.enableAutomation || original.enable_automation || false,
        automation_id: original.automationId || original.automation_id || null,
        response_window_hours: original.responseWindowHours || original.response_window_hours || 24,
        source_type: original.sourceType || original.source_type || null,
        source_filters: original.sourceFilters || original.source_filters || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Campanha duplicada');
    },
    onError: (err: any) => toast.error('Erro ao duplicar campanha', { description: err.message }),
  });

  const getCampaignRecipients = async (campaignId: string): Promise<BroadcastRecipient[]> => {
    try {
      const data = await api.broadcasts.listRecipients(campaignId) as any[];
      return data.map(r => ({
        id: r.id,
        campaign_id: r.campaignId || r.campaign_id,
        organization_id: r.organizationId || r.organization_id,
        phone: r.phone,
        name: r.name,
        variables: r.variables,
        status: r.status,
        sent_at: r.sentAt || r.sent_at,
        error: r.error,
        message_id: r.messageId || r.message_id,
        response_received: r.responseReceived || r.response_received || false,
        response_at: r.responseAt || r.response_at,
        response_message_id: r.responseMessageId || r.response_message_id,
        created_at: r.createdAt || r.created_at,
      }));
    } catch {
      return [];
    }
  };

  return {
    campaigns: campaignsQuery.data ?? [],
    loading: campaignsQuery.isLoading,
    createCampaign: createCampaign.mutateAsync,
    isCreating: createCampaign.isPending,
    pauseCampaign: (id: string) => pauseCampaign.mutateAsync(id),
    resumeCampaign: (id: string) => resumeCampaign.mutateAsync(id),
    deleteCampaign,
    updateCampaign,
    updateCampaignStatus,
    retryFailed,
    duplicateCampaign,
    getCampaignRecipients,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['broadcasts'] }),
  };
}

export function useBroadcastDetail(id: string | undefined) {
  const api = useApi();

  const campaignQuery = useQuery({
    queryKey: ['broadcast', id],
    enabled: !!id,
    queryFn: async () => normalize(await api.broadcasts.get(id!) as any),
  });

  const recipientsQuery = useQuery({
    queryKey: ['broadcast-recipients', id],
    enabled: !!id,
    queryFn: async () => {
      const data = await api.broadcasts.listRecipients(id!) as any[];
      return data.map(r => ({
        id: r.id,
        campaign_id: r.campaignId || r.campaign_id,
        organization_id: r.organizationId || r.organization_id,
        phone: r.phone,
        name: r.name,
        variables: r.variables,
        status: r.status,
        sent_at: r.sentAt || r.sent_at,
        error: r.error,
        message_id: r.messageId || r.message_id,
        response_received: r.responseReceived || r.response_received || false,
        response_at: r.responseAt || r.response_at,
        response_message_id: r.responseMessageId || r.response_message_id,
        created_at: r.createdAt || r.created_at,
      })) as BroadcastRecipient[];
    },
  });

  const campaign = campaignQuery.data;
  const recipients = recipientsQuery.data ?? [];
  const stats = campaign ? {
    total: campaign.total ?? recipients.length,
    sent: campaign.sent ?? recipients.filter(r => r.status === 'sent').length,
    failed: campaign.failed ?? recipients.filter(r => r.status === 'failed').length,
    responded: campaign.responded ?? recipients.filter(r => r.response_received).length,
    pending: recipients.filter(r => r.status === 'pending' || r.status === 'skipped').length,
    sending: recipients.filter(r => r.status === 'sending').length,
  } : null;

  return {
    campaign: campaign ?? null,
    recipients,
    stats,
    loading: campaignQuery.isLoading || recipientsQuery.isLoading,
  };
}
