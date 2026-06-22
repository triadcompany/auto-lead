import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  Workflow, 
  Save, 
  TestTube, 
  Loader2, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  Zap,
  ArrowRight
} from "lucide-react";
import { usePipelines } from "@/hooks/usePipelines";

interface N8nConfig {
  id?: string;
  webhook_url: string;
  is_active: boolean;
  trigger_on_stage_change: boolean;
  trigger_stages: string[];
  name: string;
}

export function N8nIntegration() {
  const { profile, isAdmin, orgId: authOrgId } = useAuth();
  const n8nOrgId = profile?.organization_id || authOrgId;
  const { toast } = useToast();
  const { stages } = usePipelines();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  
  const [config, setConfig] = useState<N8nConfig>({
    webhook_url: '',
    is_active: false,
    trigger_on_stage_change: true,
    trigger_stages: [],
    name: 'Integração n8n'
  });

  useEffect(() => {
    fetchConfig();
  }, [n8nOrgId]);

  const fetchConfig = async () => {
    if (!n8nOrgId) return;
    
    try {
      const { data, error } = await supabase
        .from('n8n_workflows')
        .select('*')
        .eq('organization_id', n8nOrgId)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          id: data.id,
          webhook_url: data.webhook_url || '',
          is_active: data.is_active || false,
          trigger_on_stage_change: true,
          trigger_stages: (data.triggers as any)?.stages || [],
          name: data.name || 'Integração n8n'
        });
      }
    } catch (error) {
      console.error('Error fetching n8n config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!n8nOrgId) return;

    setSaving(true);
    try {
      const payload = {
        organization_id: n8nOrgId,
        name: config.name,
        webhook_url: config.webhook_url,
        is_active: config.is_active,
        triggers: {
          on_stage_change: config.trigger_on_stage_change,
          stages: config.trigger_stages
        }
      };

      if (config.id) {
        const { error } = await supabase
          .from('n8n_workflows')
          .update(payload)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('n8n_workflows')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        setConfig(prev => ({ ...prev, id: data.id }));
      }

      toast({
        title: "Configuração salva",
        description: "A integração n8n foi configurada com sucesso.",
      });
    } catch (error) {
      console.error('Error saving n8n config:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a configuração.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!config.webhook_url) {
      toast({
        title: "URL não configurada",
        description: "Configure a URL do webhook antes de testar.",
        variant: "destructive"
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        organization_id: profile?.organization_id,
        lead: {
          id: 'test-lead-id',
          nome: 'Lead de Teste',
          telefone: '5547999999999',
          email: 'teste@exemplo.com',
          status: 'Lead Qualificado'
        }
      };

      const response = await fetch(config.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'no-cors',
        body: JSON.stringify(testPayload)
      });

      // Since we're using no-cors, we can't read the response
      // We'll assume success if no error was thrown
      setTestResult('success');
      toast({
        title: "Teste enviado",
        description: "A requisição foi enviada para o n8n. Verifique o histórico do seu workflow.",
      });
    } catch (error) {
      console.error('Error testing webhook:', error);
      setTestResult('error');
      toast({
        title: "Erro no teste",
        description: "Não foi possível enviar a requisição. Verifique a URL.",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const toggleStage = (stageId: string) => {
    setConfig(prev => ({
      ...prev,
      trigger_stages: prev.trigger_stages.includes(stageId)
        ? prev.trigger_stages.filter(id => id !== stageId)
        : [...prev.trigger_stages, stageId]
    }));
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <Card className="card-gradient border-0">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 font-poppins">Carregando configuração...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="card-gradient border-0">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Zap className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <CardTitle className="font-poppins font-semibold">
                Integração n8n
              </CardTitle>
              <CardDescription className="font-poppins">
                Conecte seu CRM com workflows automatizados no n8n
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Switch
                checked={config.is_active}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, is_active: checked }))}
              />
              <div>
                <p className="font-poppins font-medium">Ativar Integração</p>
                <p className="text-sm text-muted-foreground font-poppins">
                  Quando ativo, eventos serão enviados para o n8n
                </p>
              </div>
            </div>
            <Badge variant={config.is_active ? "default" : "secondary"}>
              {config.is_active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card className="card-gradient border-0">
        <CardHeader>
          <CardTitle className="font-poppins font-semibold text-lg">
            Configuração do Webhook
          </CardTitle>
          <CardDescription className="font-poppins">
            Configure a URL do webhook do n8n para receber os dados dos leads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhookUrl" className="font-poppins">
              URL do Webhook n8n
            </Label>
            <Input
              id="webhookUrl"
              type="url"
              placeholder="https://seu-n8n.app.n8n.cloud/webhook/..."
              value={config.webhook_url}
              onChange={(e) => setConfig(prev => ({ ...prev, webhook_url: e.target.value }))}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground font-poppins">
              Copie a URL do nó Webhook no seu workflow do n8n
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !config.webhook_url}
              className="font-poppins"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : testResult === 'success' ? (
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              ) : testResult === 'error' ? (
                <XCircle className="h-4 w-4 mr-2 text-red-500" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Testar Webhook
            </Button>
            
            <a
              href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center font-poppins"
            >
              Documentação n8n
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Trigger Configuration */}
      <Card className="card-gradient border-0">
        <CardHeader>
          <CardTitle className="font-poppins font-semibold text-lg">
            Gatilhos de Disparo
          </CardTitle>
          <CardDescription className="font-poppins">
            Defina quando os dados devem ser enviados para o n8n
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <ArrowRight className="h-5 w-5 text-primary" />
              <div>
                <p className="font-poppins font-medium">Mudança de Estágio</p>
                <p className="text-sm text-muted-foreground font-poppins">
                  Disparar quando o lead mudar para estágios específicos
                </p>
              </div>
            </div>
            <Switch
              checked={config.trigger_on_stage_change}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, trigger_on_stage_change: checked }))}
            />
          </div>

          {config.trigger_on_stage_change && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="font-poppins">Selecione os estágios que disparam o webhook:</Label>
                <div className="grid grid-cols-2 gap-2">
                  {stages.map((stage) => (
                    <div
                      key={stage.id}
                      onClick={() => toggleStage(stage.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        config.trigger_stages.includes(stage.id)
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="font-poppins text-sm">{stage.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {config.trigger_stages.length === 0 && (
                  <p className="text-sm text-amber-600 font-poppins">
                    ⚠️ Selecione ao menos um estágio para ativar os disparos
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payload Example */}
      <Card className="card-gradient border-0">
        <CardHeader>
          <CardTitle className="font-poppins font-semibold text-lg">
            Exemplo de Payload
          </CardTitle>
          <CardDescription className="font-poppins">
            Dados que serão enviados para o n8n quando um lead for qualificado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
{`{
  "event": "lead_stage_changed",
  "timestamp": "2026-01-09T12:00:00Z",
  "lead": {
    "id": "uuid-do-lead",
    "nome": "Nome do Cliente",
    "telefone": "5547999999999",
    "email": "cliente@email.com",
    "status": "Lead Qualificado",
    "interesse": "Veículo de interesse",
    "observacoes": "Observações do lead"
  },
  "stage": {
    "from": "Novo Lead",
    "to": "Lead Qualificado"
  }
}`}
          </pre>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="btn-gradient text-white font-poppins"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Configuração
        </Button>
      </div>
    </div>
  );
}
