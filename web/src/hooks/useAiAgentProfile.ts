import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { toast } from 'sonner';

export interface ProductService {
  name: string;
  description: string;
  price?: string;
  notes?: string;
}

export interface FewShotExample {
  customer_says: string;
  ideal_response: string;
}

export interface AiAgentProfile {
  id?: string;
  organization_id?: string;
  niche: string;
  agent_name: string;
  agent_role: string;
  personality: string;
  tone: string;
  business_description: string;
  products_services: ProductService[];
  rules: {
    no_negotiate_values?: boolean;
    no_close_sale?: boolean;
    no_promise_price?: boolean;
    always_call_human_on_close?: boolean;
    response_time?: string;
    questions_per_message?: number;
    response_length?: string;
  };
  funnel_rules: {
    can_suggest_stage_change?: boolean;
    can_auto_move_stage?: boolean;
    call_human_on_discount?: boolean;
    call_human_on_close?: boolean;
    call_human_on_objection?: boolean;
    call_human_on_confused?: boolean;
  };
  qualification_rules: {
    qualified_when: {
      intents: string[];
      urgency_level: string[];
      sentiment: string[];
    };
  };
  prioritization_rules: {
    priority_when: {
      intents: string[];
      urgency_level: string[];
    };
  };
  autonomous_rules: {
    mode: 'all' | 'traffic_only' | 'organic_only' | 'unassigned_only';
    only_outside_business_hours: boolean;
    pause_after_qualification: boolean;
  };
  examples: FewShotExample[];
  response_time: string;
  questions_per_message: number;
  response_length: string;
  is_active: boolean;
  version: number;
  created_at?: string;
  updated_at?: string;
}

const defaultProfile: AiAgentProfile = {
  niche: 'personalizado',
  agent_name: 'Assistente IA',
  agent_role: 'pre-vendas',
  personality: 'equilibrada',
  tone: 'profissional',
  business_description: '',
  products_services: [],
  rules: {
    no_negotiate_values: false,
    no_close_sale: false,
    no_promise_price: true,
    always_call_human_on_close: true,
    response_time: '20-40',
    questions_per_message: 1,
    response_length: 'media',
  },
  funnel_rules: {
    can_suggest_stage_change: true,
    can_auto_move_stage: false,
    call_human_on_discount: true,
    call_human_on_close: true,
    call_human_on_objection: false,
    call_human_on_confused: false,
  },
  qualification_rules: {
    qualified_when: { intents: [], urgency_level: [], sentiment: [] },
  },
  prioritization_rules: {
    priority_when: { intents: [], urgency_level: [] },
  },
  autonomous_rules: {
    mode: 'all',
    only_outside_business_hours: false,
    pause_after_qualification: false,
  },
  examples: [],
  response_time: '20-40',
  questions_per_message: 1,
  response_length: 'media',
  is_active: true,
  version: 1,
};

const nicheTemplates: Record<string, Partial<AiAgentProfile>> = {
  'loja-de-carros': {
    agent_name: 'Consultor AutoLead',
    agent_role: 'pre-vendas',
    personality: 'equilibrada',
    tone: 'profissional',
    business_description: 'Somos uma loja de veículos novos e seminovos. Trabalhamos com diversas marcas e modelos, oferecendo financiamento, troca e garantia.',
    products_services: [
      { name: 'Veículos Novos', description: 'Carros 0km de diversas marcas' },
      { name: 'Seminovos', description: 'Veículos revisados com garantia' },
      { name: 'Financiamento', description: 'Facilitamos aprovação de crédito' },
    ],
    rules: {
      no_negotiate_values: true,
      no_close_sale: false,
      no_promise_price: true,
      always_call_human_on_close: true,
    },
    examples: [
      { customer_says: 'Vocês têm SUV automático?', ideal_response: 'Temos sim! Qual faixa de preço você está buscando? Assim consigo filtrar as melhores opções pra você.' },
      { customer_says: 'Aceitam troca?', ideal_response: 'Aceitamos sim! Qual veículo você tem hoje? Me conta o modelo, ano e quilometragem que já faço uma avaliação preliminar.' },
    ],
  },
  'imobiliaria': {
    agent_name: 'Consultor Imobiliário',
    agent_role: 'pre-vendas',
    personality: 'consultiva',
    tone: 'profissional',
    business_description: 'Somos uma imobiliária que trabalha com venda e locação de imóveis residenciais e comerciais.',
    products_services: [
      { name: 'Venda de Imóveis', description: 'Casas, apartamentos e terrenos' },
      { name: 'Locação', description: 'Aluguel residencial e comercial' },
      { name: 'Assessoria', description: 'Documentação e financiamento' },
    ],
    rules: {
      no_negotiate_values: true,
      no_close_sale: true,
      no_promise_price: true,
      always_call_human_on_close: true,
    },
    examples: [
      { customer_says: 'Procuro um apartamento de 3 quartos', ideal_response: 'Ótimo! Em qual bairro ou região você prefere? E qual sua faixa de investimento? Assim consigo encontrar as melhores opções.' },
    ],
  },
  'agencia-de-marketing': {
    agent_name: 'Consultor de Marketing',
    agent_role: 'pre-vendas',
    personality: 'direta',
    tone: 'informal',
    business_description: 'Somos uma agência de marketing digital focada em resultados. Trabalhamos com tráfego pago, social media, criação de sites e estratégias de crescimento.',
    products_services: [
      { name: 'Gestão de Tráfego', description: 'Google Ads e Meta Ads' },
      { name: 'Social Media', description: 'Gestão de redes sociais' },
      { name: 'Criação de Sites', description: 'Sites e landing pages' },
    ],
    rules: {
      no_negotiate_values: false,
      no_close_sale: false,
      no_promise_price: true,
      always_call_human_on_close: true,
    },
    examples: [
      { customer_says: 'Quanto custa gestão de tráfego?', ideal_response: 'Depende do seu objetivo e investimento em mídia! Me conta: qual seu segmento e faturamento mensal? Assim monto uma proposta sob medida.' },
    ],
  },
};

export function useAiAgentProfile() {
  const { profile: userProfile, orgId: authOrgId } = useAuth();
  const api = useApi();
  const [agentProfile, setAgentProfile] = useState<AiAgentProfile>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [versions, setVersions] = useState<AiAgentProfile[]>([]);

  const organizationId = userProfile?.organization_id || authOrgId;

  const fetchProfile = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.aiAgentProfile.get().catch(() => null);

      if (data) {
        const mapped = {
          ...defaultProfile,
          id: data.id,
          organization_id: data.organizationId || organizationId,
          niche: data.niche || defaultProfile.niche,
          agent_name: data.agentName || defaultProfile.agent_name,
          agent_role: data.agentRole || defaultProfile.agent_role,
          personality: data.personality || defaultProfile.personality,
          tone: data.tone || defaultProfile.tone,
          business_description: data.businessDescription || null,
          products_services: (data.productsServices as any) || [],
          rules: (data.rules as any) || {},
          funnel_rules: (data.funnelRules as any) || {},
          examples: (data.examples as any) || [],
          response_time: data.responseTime || defaultProfile.response_time,
          questions_per_message: data.questionsPerMessage ?? defaultProfile.questions_per_message,
          response_length: data.responseLength || defaultProfile.response_length,
          is_active: data.isActive ?? true,
          version: data.version || 1,
        };
        setAgentProfile(mapped);
        setHasExisting(true);
        setVersions([mapped]);
      }
    } catch (err) {
      console.error('Error fetching AI agent profile:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const saveProfile = async () => {
    if (!organizationId || !userProfile) return;
    setSaving(true);
    try {
      await api.aiAgentProfile.update({
        niche: agentProfile.niche,
        agent_name: agentProfile.agent_name,
        agent_role: agentProfile.agent_role,
        personality: agentProfile.personality,
        tone: agentProfile.tone,
        business_description: agentProfile.business_description || null,
        products_services: agentProfile.products_services,
        rules: agentProfile.rules,
        funnel_rules: agentProfile.funnel_rules,
        examples: agentProfile.examples,
        response_time: agentProfile.response_time,
        questions_per_message: agentProfile.questions_per_message,
        response_length: agentProfile.response_length,
        is_active: true,
      });

      setHasExisting(true);
      toast.success('Treinamento salvo e aplicado com sucesso!');
      await fetchProfile();
    } catch (err: any) {
      console.error('Error saving AI agent profile:', err);
      toast.error('Erro ao salvar treinamento: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const applyNicheTemplate = (nicheKey: string) => {
    const template = nicheTemplates[nicheKey];
    if (template) {
      setAgentProfile(prev => ({
        ...prev,
        ...template,
        niche: nicheKey,
        rules: { ...prev.rules, ...template.rules },
        products_services: template.products_services || prev.products_services,
        examples: template.examples || prev.examples,
      }));
    }
  };

  const restoreVersion = async (version: AiAgentProfile) => {
    setAgentProfile({
      ...version,
      is_active: true,
    });
    toast.info(`Versão ${version.version} carregada. Clique em "Salvar" para aplicar.`);
  };

  const updateField = <K extends keyof AiAgentProfile>(field: K, value: AiAgentProfile[K]) => {
    setAgentProfile(prev => ({ ...prev, [field]: value }));
  };

  const updateRules = (key: string, value: any) => {
    setAgentProfile(prev => ({
      ...prev,
      rules: { ...prev.rules, [key]: value },
    }));
  };

  const updateFunnelRules = (key: string, value: any) => {
    setAgentProfile(prev => ({
      ...prev,
      funnel_rules: { ...prev.funnel_rules, [key]: value },
    }));
  };

  return {
    agentProfile,
    loading,
    saving,
    hasExisting,
    versions,
    saveProfile,
    applyNicheTemplate,
    restoreVersion,
    updateField,
    updateRules,
    updateFunnelRules,
    setAgentProfile,
  };
}
