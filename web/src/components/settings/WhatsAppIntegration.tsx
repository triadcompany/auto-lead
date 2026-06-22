import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Smartphone, Link2, Copy, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

interface WhatsAppIntegration {
  id: string;
  webhook_url: string;
  api_key: string;
  phone_number: string;
  is_active: boolean;
  webhook_token: string;
  evolution_instance_id: string;
  evolution_api_key: string;
  n8n_webhook_evolution_notify: string;
}

export function WhatsAppIntegration() {
  const [integration, setIntegration] = useState<WhatsAppIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    webhook_url: '',
    api_key: '',
    phone_number: '',
    is_active: true,
    evolution_instance_id: '',
    evolution_api_key: '',
    n8n_webhook_evolution_notify: '',
  });

  const webhookEndpoint = integration?.webhook_token 
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook/${integration.webhook_token}`
    : 'Configure primeiro para gerar a URL única';

  useEffect(() => {
    if (profile?.organization_id) {
      fetchIntegration();
    }
  }, [profile?.organization_id]);

  const fetchIntegration = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_integrations')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setIntegration(data);
        setFormData({
          webhook_url: data.webhook_url || '',
          api_key: data.api_key || '',
          phone_number: data.phone_number || '',
          is_active: data.is_active,
          evolution_instance_id: data.evolution_instance_id || '',
          evolution_api_key: data.evolution_api_key || '',
          n8n_webhook_evolution_notify: data.n8n_webhook_evolution_notify || '',
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao carregar configuração do WhatsApp",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile?.organization_id || !isAdmin) {
      toast({
        title: "Erro",
        description: "Apenas administradores podem salvar configurações",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const integrationData = {
        organization_id: profile.organization_id,
        webhook_url: formData.webhook_url,
        api_key: formData.api_key,
        phone_number: formData.phone_number,
        is_active: formData.is_active,
        evolution_instance_id: formData.evolution_instance_id,
        evolution_api_key: formData.evolution_api_key,
        n8n_webhook_evolution_notify: formData.n8n_webhook_evolution_notify,
        instance_name: formData.evolution_instance_id || `legacy-${profile.organization_id.substring(0, 8)}`,
      };

      if (integration) {
        // Update existing
        const { error } = await supabase
          .from('whatsapp_integrations')
          .update(integrationData)
          .eq('id', integration.id);

        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('whatsapp_integrations')
          .insert(integrationData)
          .select()
          .single();

        if (error) throw error;
        setIntegration(data);
      }

      toast({
        title: "Sucesso",
        description: "Configuração do WhatsApp salva com sucesso",
      });

      await fetchIntegration();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao salvar configuração",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookEndpoint);
      setCopied(true);
      toast({
        title: "Copiado!",
        description: "URL do webhook copiada para a área de transferência",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao copiar URL",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card className="card-gradient border-0">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="card-gradient border-0">
        <CardContent className="p-6">
          <Alert>
            <MessageSquare className="h-4 w-4" />
            <AlertDescription>
              Apenas administradores podem configurar integrações do WhatsApp.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="card-gradient border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 font-poppins">
            <MessageSquare className="h-5 w-5 text-primary" />
            <span>Integração WhatsApp</span>
          </CardTitle>
          <CardDescription className="font-poppins">
            Configure a integração com Evolution API e n8n para automaticamente criar leads quando receber mensagens no WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Webhook URL Display */}
          <div className="space-y-2">
            <Label className="font-poppins font-medium">URL do Webhook Única da Organização</Label>
            <div className="flex items-center space-x-2">
              <Input
                value={webhookEndpoint}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyWebhookUrl}
                className="flex items-center space-x-1"
                disabled={!integration?.webhook_token}
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {integration?.webhook_token 
                ? 'Esta é a URL única da sua organização. Use no n8n para enviar webhooks.'
                : 'Salve as configurações primeiro para gerar a URL única da organização.'
              }
            </p>
          </div>

          <Separator />

          {/* Configuration Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone_number" className="font-poppins font-medium">
                <Smartphone className="h-4 w-4 inline mr-1" />
                Número do WhatsApp
              </Label>
              <Input
                id="phone_number"
                value={formData.phone_number}
                onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                placeholder="5511999999999"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Número completo com código do país (sem símbolos)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api_key" className="font-poppins font-medium">
                <Link2 className="h-4 w-4 inline mr-1" />
                API Key (Opcional)
              </Label>
              <Input
                id="api_key"
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                placeholder="Sua chave da API"
              />
              <p className="text-xs text-muted-foreground">
                Para autenticação adicional se necessário
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook_url" className="font-poppins font-medium">
              URL do Webhook do n8n (Receber Leads - Opcional)
            </Label>
            <Input
              id="webhook_url"
              value={formData.webhook_url}
              onChange={(e) => setFormData(prev => ({ ...prev, webhook_url: e.target.value }))}
              placeholder="https://seu-n8n.com/webhook/whatsapp"
            />
            <p className="text-xs text-muted-foreground">
              URL para notificar seu n8n quando um lead for criado via WhatsApp
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-poppins font-semibold text-sm">Configuração Evolution API (Notificações)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="evolution_instance_id" className="font-poppins font-medium">
                  ID da Instância Evolution
                </Label>
                <Input
                  id="evolution_instance_id"
                  value={formData.evolution_instance_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, evolution_instance_id: e.target.value }))}
                  placeholder="instance-12345"
                />
                <p className="text-xs text-muted-foreground">
                  ID da instância Evolution da sua organização
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="evolution_api_key" className="font-poppins font-medium">
                  API Key Evolution
                </Label>
                <Input
                  id="evolution_api_key"
                  type="password"
                  value={formData.evolution_api_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, evolution_api_key: e.target.value }))}
                  placeholder="sua-api-key"
                />
                <p className="text-xs text-muted-foreground">
                  Chave da API Evolution para enviar mensagens
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="n8n_webhook_evolution_notify" className="font-poppins font-medium">
                Webhook n8n para Notificações (Enviar via Evolution)
              </Label>
              <Input
                id="n8n_webhook_evolution_notify"
                value={formData.n8n_webhook_evolution_notify}
                onChange={(e) => setFormData(prev => ({ ...prev, n8n_webhook_evolution_notify: e.target.value }))}
                placeholder="https://seu-n8n.com/webhook/notify-user"
              />
              <p className="text-xs text-muted-foreground">
                URL do webhook n8n que receberá requisições para enviar notificações via Evolution quando um lead for atribuído
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label htmlFor="is_active" className="font-poppins">
              Integração ativa
            </Label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={fetchIntegration}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="btn-gradient text-white"
            >
              {saving ? 'Salvando...' : 'Salvar Configuração'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card className="card-gradient border-0">
        <CardHeader>
          <CardTitle className="font-poppins">Como Configurar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
              <div>
                <p className="font-medium">Configure seu Evolution API</p>
                <p className="text-muted-foreground">Configure a Evolution API para enviar webhooks quando receber mensagens</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
              <div>
                <p className="font-medium">Crie um workflow no n8n</p>
                <p className="text-muted-foreground">Configure o n8n para processar as mensagens e enviar para a URL do webhook acima</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</div>
              <div>
                <p className="font-medium">Configure o número do WhatsApp</p>
                <p className="text-muted-foreground">Certifique-se de inserir o número correto com código do país</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</div>
              <div>
                <p className="font-medium">Teste a integração</p>
                <p className="text-muted-foreground">Envie uma mensagem para o WhatsApp e verifique se o lead foi criado automaticamente</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}