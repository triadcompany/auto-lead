import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Webhook, 
  Copy, 
  CheckCircle2, 
  Shield, 
  ExternalLink,
  Code,
  Zap,
  ArrowRight
} from "lucide-react";

export function WebhookIntegration() {
  const { profile, isAdmin, orgId: authOrgId } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const organizationId = profile?.organization_id || authOrgId;
  
  // URL base do webhook - usando a URL do Supabase diretamente
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const webhookUrl = organizationId 
    ? `${supabaseUrl}/functions/v1/receive-lead-webhook?org=${organizationId}`
    : '';

  const handleCopyWebhook = async () => {
    if (!webhookUrl) return;
    
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast({
        title: "URL copiada!",
        description: "A URL do webhook foi copiada para a área de transferência.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar a URL.",
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return null;
  }

  const payloadExample = `{
  "name": "Nome do Lead",
  "phone": "5511999999999",
  "email": "lead@email.com",
  "source": "n8n",
  "interest": "Veículo de interesse",
  "observations": "Observações adicionais"
}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-poppins font-semibold text-foreground flex items-center gap-2">
          <Webhook className="h-5 w-5 text-primary" />
          Webhook para Receber Leads
        </h3>
        <p className="text-sm text-muted-foreground font-poppins">
          Use este webhook para integrar com n8n, Evolution API, Make, Zapier e outras ferramentas
        </p>
      </div>

      {/* Webhook URL Card */}
      <Card className="card-gradient border-0 border-l-4 border-l-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-poppins text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                URL do Webhook
              </CardTitle>
              <CardDescription className="font-poppins">
                Este é o endpoint único da sua organização para receber leads
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Ativo
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={webhookUrl}
              readOnly
              className="font-mono text-sm bg-muted/50"
            />
            <Button
              onClick={handleCopyWebhook}
              variant="outline"
              className="shrink-0"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="font-mono">POST</Badge>
            <span className="font-poppins">Método HTTP requerido</span>
          </div>
        </CardContent>
      </Card>

      {/* Instruções de Uso */}
      <Card className="card-gradient border-0">
        <CardHeader>
          <CardTitle className="font-poppins text-base flex items-center gap-2">
            <Code className="h-4 w-4 text-primary" />
            Como Usar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            {/* Passo 1 */}
            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                1
              </div>
              <div>
                <p className="font-poppins font-medium text-sm">Configure no n8n ou Evolution API</p>
                <p className="text-xs text-muted-foreground font-poppins">
                  Use um node HTTP Request (n8n) ou configure o webhook de saída (Evolution)
                </p>
              </div>
            </div>

            {/* Passo 2 */}
            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                2
              </div>
              <div>
                <p className="font-poppins font-medium text-sm">Cole a URL do webhook</p>
                <p className="text-xs text-muted-foreground font-poppins">
                  Use a URL acima como destino do seu fluxo de automação
                </p>
              </div>
            </div>

            {/* Passo 3 */}
            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                3
              </div>
              <div>
                <p className="font-poppins font-medium text-sm">Envie os dados do lead</p>
                <p className="text-xs text-muted-foreground font-poppins">
                  Os leads serão automaticamente distribuídos conforme suas regras
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payload Example */}
      <Card className="card-gradient border-0">
        <CardHeader>
          <CardTitle className="font-poppins text-base flex items-center gap-2">
            <Code className="h-4 w-4 text-primary" />
            Exemplo de Payload (JSON)
          </CardTitle>
          <CardDescription className="font-poppins">
            Envie os dados do lead no corpo da requisição POST
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-zinc-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-green-400 font-mono whitespace-pre">
              {payloadExample}
            </pre>
          </div>
          
          <div className="mt-4 space-y-2">
            <p className="text-sm font-poppins font-medium text-foreground">Campos obrigatórios:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="destructive" className="font-mono text-xs">name</Badge>
              <Badge variant="destructive" className="font-mono text-xs">phone</Badge>
            </div>
            
            <p className="text-sm font-poppins font-medium text-foreground mt-3">Campos opcionais:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="font-mono text-xs">email</Badge>
              <Badge variant="secondary" className="font-mono text-xs">source</Badge>
              <Badge variant="secondary" className="font-mono text-xs">interest</Badge>
              <Badge variant="secondary" className="font-mono text-xs">observations</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integrações Compatíveis */}
      <Card className="card-gradient border-0">
        <CardHeader>
          <CardTitle className="font-poppins text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-primary" />
            Integrações Compatíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <div className="w-8 h-8 bg-orange-500/10 rounded flex items-center justify-center">
                <span className="text-orange-500 font-bold text-xs">n8n</span>
              </div>
              <span className="font-poppins text-sm">n8n</span>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <div className="w-8 h-8 bg-green-500/10 rounded flex items-center justify-center">
                <span className="text-green-500 font-bold text-xs">EVO</span>
              </div>
              <span className="font-poppins text-sm">Evolution</span>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <div className="w-8 h-8 bg-purple-500/10 rounded flex items-center justify-center">
                <span className="text-purple-500 font-bold text-xs">M</span>
              </div>
              <span className="font-poppins text-sm">Make</span>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <div className="w-8 h-8 bg-blue-500/10 rounded flex items-center justify-center">
                <span className="text-blue-500 font-bold text-xs">Z</span>
              </div>
              <span className="font-poppins text-sm">Zapier</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
