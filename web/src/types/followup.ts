// Tipos para o sistema de Follow-up

export type FollowupStatus = 'PENDENTE' | 'ENVIADO' | 'PULADO' | 'FALHOU' | 'CANCELADO';
export type FollowupSentBy = 'AUTO' | 'MANUAL';
export type MessageDirection = 'outbound' | 'inbound';
export type MessageChannel = 'whatsapp' | 'email' | 'sms';

export interface FollowupTemplate {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  content: string;
  variables: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FollowupCadenceStep {
  delay_hours: number;
  channel?: MessageChannel;
  template_id?: string;
  message?: string;
}

export interface FollowupCadence {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  steps: FollowupCadenceStep[];
  is_default: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Followup {
  id: string;
  organization_id: string;
  lead_id: string;
  assigned_to: string;
  scheduled_for: string;
  channel: MessageChannel;
  status: FollowupStatus;
  template_id?: string;
  message_custom?: string;
  sent_at?: string;
  sent_by?: FollowupSentBy;
  result_tag?: string;
  notes?: string;
  cadence_id?: string;
  cadence_step?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined data
  lead?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    interest?: string;
    seller_id: string;
    stage_id: string;
  };
  assigned_user?: {
    id: string;
    name: string;
  };
  template?: FollowupTemplate;
}

export interface MessageLog {
  id: string;
  organization_id: string;
  lead_id: string;
  followup_id?: string;
  direction: MessageDirection;
  channel: MessageChannel;
  content: string;
  provider_message_id?: string;
  status: string;
  error_message?: string;
  created_at: string;
  // Joined data
  lead?: {
    id: string;
    name: string;
    phone: string;
  };
}

export interface WhatsAppConfig {
  id: string;
  organization_id: string;
  api_url: string;
  api_key: string;
  instance_name: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Filtros para a Central de Follow-ups
export type FollowupFilter = 'hoje' | 'atrasados' | 'proximos_7_dias' | 'todos';

// Status colors para badges
export const followupStatusColors: Record<FollowupStatus, string> = {
  PENDENTE: 'bg-amber-100 text-amber-700 border-amber-200',
  ENVIADO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  PULADO: 'bg-gray-100 text-gray-700 border-gray-200',
  FALHOU: 'bg-red-100 text-red-700 border-red-200',
  CANCELADO: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const followupStatusLabels: Record<FollowupStatus, string> = {
  PENDENTE: 'Pendente',
  ENVIADO: 'Enviado',
  PULADO: 'Pulado',
  FALHOU: 'Falhou',
  CANCELADO: 'Cancelado',
};

export const channelLabels: Record<MessageChannel, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  sms: 'SMS',
};

export const channelIcons: Record<MessageChannel, string> = {
  whatsapp: 'MessageCircle',
  email: 'Mail',
  sms: 'Smartphone',
};
