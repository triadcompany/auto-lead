import { supabase } from '@/integrations/supabase/client';

interface Lead {
  id: string;
  name: string;
  email?: string;
  phone: string;
  source?: string;
  interest?: string;
  observations?: string;
}

interface StageChange {
  from: string;
  to: string;
  fromId: string;
  toId: string;
}

export async function triggerN8nWebhook(
  organizationId: string,
  lead: Lead,
  stageChange: StageChange
): Promise<void> {
  try {
    // Buscar configuração n8n da organização
    const { data: workflow, error } = await supabase
      .from('n8n_workflows')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching n8n config:', error);
      return;
    }

    if (!workflow || !workflow.webhook_url) {
      console.log('No active n8n webhook configured for this organization');
      return;
    }

    // Verificar se o estágio de destino está configurado para disparar
    const triggers = workflow.triggers as { stages?: string[] } | null;
    const triggerStages = triggers?.stages || [];
    
    if (triggerStages.length > 0 && !triggerStages.includes(stageChange.toId)) {
      console.log('Stage not configured for n8n trigger:', stageChange.to);
      return;
    }

    // Preparar payload
    const payload = {
      event: 'lead_stage_changed',
      timestamp: new Date().toISOString(),
      organization_id: organizationId,
      lead: {
        id: lead.id,
        nome: lead.name,
        telefone: lead.phone,
        email: lead.email || '',
        interesse: lead.interest || '',
        observacoes: lead.observations || '',
        status: stageChange.to
      },
      stage: {
        from: stageChange.from,
        to: stageChange.to
      }
    };

    console.log('📤 Sending to n8n webhook:', workflow.webhook_url);
    console.log('📦 Payload:', payload);

    // Enviar para o webhook
    await fetch(workflow.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'no-cors', // Para evitar erros de CORS
      body: JSON.stringify(payload)
    });

    console.log('✅ n8n webhook triggered successfully');
  } catch (error) {
    console.error('❌ Error triggering n8n webhook:', error);
    // Não lançar erro para não interromper o fluxo principal
  }
}
