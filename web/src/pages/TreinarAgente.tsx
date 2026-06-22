import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bot, Save, Car, Building2, TrendingUp, Sparkles, Plus, Trash2,
  MessageSquare, Brain, Shield, GitBranch, BookOpen, History, Loader2,
  RotateCcw, Eye, Target, Zap
} from 'lucide-react';
import { useAiAgentProfile, type ProductService, type FewShotExample } from '@/hooks/useAiAgentProfile';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const nicheCards = [
  { key: 'loja-de-carros', label: 'Loja de Carros', icon: Car, description: 'Atendimento focado em veículos, test-drive, financiamento e troca.' },
  { key: 'imobiliaria', label: 'Imobiliária', icon: Building2, description: 'Consultoria imobiliária, visitas, documentação e financiamento.' },
  { key: 'agencia-de-marketing', label: 'Agência de Marketing', icon: TrendingUp, description: 'Prospecção de clientes, propostas e gestão de tráfego.' },
];

const personalityPreview: Record<string, string> = {
  direta: 'Olá! Posso te ajudar. Qual veículo procura?',
  equilibrada: 'Olá! 😊 Posso te ajudar com algumas informações?',
  consultiva: 'Olá! Que bom ter você aqui! Me conta um pouco sobre o que você está buscando, assim consigo te orientar da melhor forma.',
};

export default function TreinarAgente() {
  const {
    agentProfile, loading, saving, hasExisting, versions,
    saveProfile, applyNicheTemplate, restoreVersion,
    updateField, updateRules, updateFunnelRules, setAgentProfile,
  } = useAiAgentProfile();

  const { profile: userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('identidade');
  const [availableIntents, setAvailableIntents] = useState<{ intent_key: string; intent_label: string }[]>([]);

  const organizationId = userProfile?.organization_id;

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('intent_definitions')
        .select('intent_key, intent_label, scope_type, scope_id')
        .or(
          `and(scope_type.eq.global,scope_id.is.null),and(scope_type.eq.organization,scope_id.eq.${organizationId})`
        );
      if (data) {
        // Also load niche-based intents
        const niche = agentProfile.niche;
        const { data: nicheIntents } = await (supabase as any)
          .from('intent_definitions')
          .select('intent_key, intent_label')
          .eq('scope_type', 'niche')
          .eq('scope_id', niche);
        
        const map = new Map<string, { intent_key: string; intent_label: string }>();
        for (const i of data) map.set(i.intent_key, { intent_key: i.intent_key, intent_label: i.intent_label });
        if (nicheIntents) {
          for (const i of nicheIntents) map.set(i.intent_key, { intent_key: i.intent_key, intent_label: i.intent_label });
        }
        setAvailableIntents(Array.from(map.values()));
      }
    })();
  }, [organizationId, agentProfile.niche]);

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const addProduct = () => {
    setAgentProfile(prev => ({
      ...prev,
      products_services: [...prev.products_services, { name: '', description: '' }],
    }));
  };

  const removeProduct = (index: number) => {
    setAgentProfile(prev => ({
      ...prev,
      products_services: prev.products_services.filter((_, i) => i !== index),
    }));
  };

  const updateProduct = (index: number, field: keyof ProductService, value: string) => {
    setAgentProfile(prev => ({
      ...prev,
      products_services: prev.products_services.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      ),
    }));
  };

  const addExample = () => {
    setAgentProfile(prev => ({
      ...prev,
      examples: [...prev.examples, { customer_says: '', ideal_response: '' }],
    }));
  };

  const removeExample = (index: number) => {
    setAgentProfile(prev => ({
      ...prev,
      examples: prev.examples.filter((_, i) => i !== index),
    }));
  };

  const updateExample = (index: number, field: keyof FewShotExample, value: string) => {
    setAgentProfile(prev => ({
      ...prev,
      examples: prev.examples.map((e, i) =>
        i === index ? { ...e, [field]: value } : e
      ),
    }));
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto pb-20">
      {/* Header Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-poppins font-bold text-foreground">
                    {agentProfile.agent_name}
                  </h1>
                  <Badge variant={agentProfile.is_active ? 'default' : 'secondary'}>
                    {agentProfile.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  {agentProfile.niche !== 'personalizado' && (
                    <Badge variant="outline" className="capitalize">
                      {agentProfile.niche.replace(/-/g, ' ')}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Personalize como a IA conversa, vende e atende seus clientes.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="agent-active" className="text-sm">Agente Ativo</Label>
                <Switch
                  id="agent-active"
                  checked={agentProfile.is_active}
                  onCheckedChange={(v) => updateField('is_active', v)}
                />
              </div>
              <Button onClick={saveProfile} disabled={saving} className="font-poppins">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar e Aplicar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Name */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-poppins flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Nome do Agente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={agentProfile.agent_name}
            onChange={(e) => updateField('agent_name', e.target.value)}
            placeholder="Ex: Consultor AutoLead"
          />
        </CardContent>
      </Card>

      {/* Niche Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-poppins flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Nicho e Modelo Base
          </CardTitle>
          <CardDescription>
            Escolha um modelo pré-configurado ou comece do zero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {nicheCards.map((niche) => {
              const isSelected = agentProfile.niche === niche.key;
              return (
                <button
                  key={niche.key}
                  onClick={() => applyNicheTemplate(niche.key)}
                  className={cn(
                    'relative p-5 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-md',
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <niche.icon className={cn('h-8 w-8 mb-3', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                  <h3 className="font-poppins font-semibold text-sm">{niche.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{niche.description}</p>
                  {isSelected && (
                    <Badge className="absolute top-3 right-3 text-xs">Selecionado</Badge>
                  )}
                </button>
              );
            })}
          </div>
          {agentProfile.niche !== 'personalizado' && (
            <p className="text-xs text-muted-foreground mt-3 bg-muted/50 rounded-lg p-3">
              💡 Você pode editar tudo abaixo. Este é apenas um ponto de partida.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 md:grid-cols-8 w-full">
          <TabsTrigger value="identidade" className="text-xs">
            <MessageSquare className="h-3 w-3 mr-1" />
            Identidade
          </TabsTrigger>
          <TabsTrigger value="conhecimento" className="text-xs">
            <BookOpen className="h-3 w-3 mr-1" />
            Conhecimento
          </TabsTrigger>
          <TabsTrigger value="regras" className="text-xs">
            <Shield className="h-3 w-3 mr-1" />
            Regras
          </TabsTrigger>
          <TabsTrigger value="funil" className="text-xs">
            <GitBranch className="h-3 w-3 mr-1" />
            Funil
          </TabsTrigger>
          <TabsTrigger value="qualificacao" className="text-xs">
            <Target className="h-3 w-3 mr-1" />
            Qualificação
          </TabsTrigger>
          <TabsTrigger value="autonomo" className="text-xs">
            <Zap className="h-3 w-3 mr-1" />
            Autônomo
          </TabsTrigger>
          <TabsTrigger value="exemplos" className="text-xs">
            <Brain className="h-3 w-3 mr-1" />
            Exemplos
          </TabsTrigger>
          <TabsTrigger value="versoes" className="text-xs">
            <History className="h-3 w-3 mr-1" />
            Versões
          </TabsTrigger>
        </TabsList>

        {/* Identity Tab */}
        <TabsContent value="identidade">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-poppins">Identidade do Agente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Função principal</Label>
                <Select value={agentProfile.agent_role} onValueChange={(v) => updateField('agent_role', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atendimento">Atendimento</SelectItem>
                    <SelectItem value="pre-vendas">Pré-vendas</SelectItem>
                    <SelectItem value="vendas">Vendas</SelectItem>
                    <SelectItem value="suporte">Suporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Personalidade</Label>
                <RadioGroup value={agentProfile.personality} onValueChange={(v) => updateField('personality', v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="direta" id="p-direta" />
                    <Label htmlFor="p-direta" className="font-normal">Mais direta</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="equilibrada" id="p-equilibrada" />
                    <Label htmlFor="p-equilibrada" className="font-normal">Equilibrada</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="consultiva" id="p-consultiva" />
                    <Label htmlFor="p-consultiva" className="font-normal">Mais consultiva</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Tom de voz</Label>
                <RadioGroup value={agentProfile.tone} onValueChange={(v) => updateField('tone', v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="formal" id="t-formal" />
                    <Label htmlFor="t-formal" className="font-normal">Formal</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="profissional" id="t-profissional" />
                    <Label htmlFor="t-profissional" className="font-normal">Profissional e próximo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="informal" id="t-informal" />
                    <Label htmlFor="t-informal" className="font-normal">Informal</Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Eye className="h-3 w-3" /> Preview dinâmico
                </p>
                <div className="bg-background rounded-lg p-3 border">
                  <p className="text-sm">
                    🤖 {personalityPreview[agentProfile.personality] || personalityPreview.equilibrada}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Tab */}
        <TabsContent value="conhecimento">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-poppins">Conhecimento do Negócio</CardTitle>
              <CardDescription>
                Descreva como se estivesse explicando sua empresa para um novo vendedor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Descrição do negócio</Label>
                <Textarea
                  value={agentProfile.business_description}
                  onChange={(e) => updateField('business_description', e.target.value)}
                  placeholder="Ex: Somos uma loja de veículos novos e seminovos localizada em São Paulo. Trabalhamos com financiamento próprio..."
                  className="min-h-[120px]"
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Produtos / Serviços</Label>
                  <Button variant="outline" size="sm" onClick={addProduct}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>

                {agentProfile.products_services.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6 bg-muted/30 rounded-lg">
                    Nenhum produto/serviço cadastrado. Clique em "Adicionar" para começar.
                  </p>
                )}

                {agentProfile.products_services.map((product, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Produto #{index + 1}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeProduct(index)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Nome</Label>
                        <Input
                          value={product.name}
                          onChange={(e) => updateProduct(index, 'name', e.target.value)}
                          placeholder="Nome do produto"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Preço (opcional)</Label>
                        <Input
                          value={product.price || ''}
                          onChange={(e) => updateProduct(index, 'price', e.target.value)}
                          placeholder="R$ 0,00"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Descrição</Label>
                      <Input
                        value={product.description}
                        onChange={(e) => updateProduct(index, 'description', e.target.value)}
                        placeholder="Breve descrição"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Observações (opcional)</Label>
                      <Input
                        value={product.notes || ''}
                        onChange={(e) => updateProduct(index, 'notes', e.target.value)}
                        placeholder="Informações extras"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="regras">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-poppins">Regras de Atendimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tempo de resposta</Label>
                  <Select value={agentProfile.response_time} onValueChange={(v) => updateField('response_time', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10-20">10–20 segundos</SelectItem>
                      <SelectItem value="20-40">20–40 segundos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Perguntas por mensagem</Label>
                  <Select
                    value={String(agentProfile.questions_per_message)}
                    onValueChange={(v) => updateField('questions_per_message', Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 pergunta</SelectItem>
                      <SelectItem value="2">2 perguntas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tamanho da resposta</Label>
                  <Select value={agentProfile.response_length} onValueChange={(v) => updateField('response_length', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="curta">Curta</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="longa">Longa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-base font-semibold">Limites da IA</Label>
                <div className="space-y-3">
                  {[
                    { key: 'no_negotiate_values', label: 'Não negociar valores' },
                    { key: 'no_close_sale', label: 'Não fechar venda' },
                    { key: 'no_promise_price', label: 'Não prometer preço sem contexto' },
                    { key: 'always_call_human_on_close', label: 'Sempre chamar humano em fechamento' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-3">
                      <Checkbox
                        id={`rule-${key}`}
                        checked={!!agentProfile.rules[key as keyof typeof agentProfile.rules]}
                        onCheckedChange={(v) => updateRules(key, !!v)}
                      />
                      <Label htmlFor={`rule-${key}`} className="font-normal cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Funnel Tab */}
        <TabsContent value="funil">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-poppins">Funil e Inteligência</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <Label className="font-medium">IA pode sugerir mudança de etapa</Label>
                    <p className="text-xs text-muted-foreground">A IA sugere mover o lead no funil</p>
                  </div>
                  <Switch
                    checked={!!agentProfile.funnel_rules.can_suggest_stage_change}
                    onCheckedChange={(v) => updateFunnelRules('can_suggest_stage_change', v)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <Label className="font-medium">IA pode mover etapa automaticamente</Label>
                    <p className="text-xs text-muted-foreground">Desativado por padrão — requer supervisão</p>
                  </div>
                  <Switch
                    checked={!!agentProfile.funnel_rules.can_auto_move_stage}
                    onCheckedChange={(v) => updateFunnelRules('can_auto_move_stage', v)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-base font-semibold">Quando chamar humano automaticamente</Label>
                <div className="space-y-3">
                  {[
                    { key: 'call_human_on_discount', label: 'Pedido de desconto' },
                    { key: 'call_human_on_close', label: 'Pedido de fechamento' },
                    { key: 'call_human_on_objection', label: 'Objeção repetida' },
                    { key: 'call_human_on_confused', label: 'Cliente confuso' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-3">
                      <Checkbox
                        id={`funnel-${key}`}
                        checked={!!agentProfile.funnel_rules[key as keyof typeof agentProfile.funnel_rules]}
                        onCheckedChange={(v) => updateFunnelRules(key, !!v)}
                      />
                      <Label htmlFor={`funnel-${key}`} className="font-normal cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Qualification Tab */}
        <TabsContent value="qualificacao">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-poppins flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Critérios de Lead Qualificado
                </CardTitle>
                <CardDescription>
                  Defina quando um lead deve ser considerado qualificado com base na inteligência da conversa.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-sm font-semibold">Intents que qualificam</Label>
                  <p className="text-xs text-muted-foreground">Se a IA detectar uma dessas intenções, o lead será marcado como qualificado.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {availableIntents.map((intent) => (
                      <div key={intent.intent_key} className="flex items-center space-x-3">
                        <Checkbox
                          id={`q-intent-${intent.intent_key}`}
                          checked={agentProfile.qualification_rules?.qualified_when?.intents?.includes(intent.intent_key) || false}
                          onCheckedChange={(checked) => {
                            const current = agentProfile.qualification_rules?.qualified_when?.intents || [];
                            const updated = checked
                              ? [...current, intent.intent_key]
                              : current.filter((k: string) => k !== intent.intent_key);
                            setAgentProfile(prev => ({
                              ...prev,
                              qualification_rules: {
                                ...prev.qualification_rules,
                                qualified_when: { ...prev.qualification_rules.qualified_when, intents: updated },
                              },
                            }));
                          }}
                        />
                        <Label htmlFor={`q-intent-${intent.intent_key}`} className="font-normal cursor-pointer text-sm">
                          {intent.intent_label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {availableIntents.length === 0 && (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                      Nenhuma intent disponível. As intents serão carregadas automaticamente.
                    </p>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label className="text-sm font-semibold">Nível de urgência que qualifica</Label>
                  <div className="flex flex-wrap gap-3">
                    {['medium', 'high'].map((level) => (
                      <div key={level} className="flex items-center space-x-2">
                        <Checkbox
                          id={`q-urgency-${level}`}
                          checked={agentProfile.qualification_rules?.qualified_when?.urgency_level?.includes(level) || false}
                          onCheckedChange={(checked) => {
                            const current = agentProfile.qualification_rules?.qualified_when?.urgency_level || [];
                            const updated = checked
                              ? [...current, level]
                              : current.filter((k: string) => k !== level);
                            setAgentProfile(prev => ({
                              ...prev,
                              qualification_rules: {
                                ...prev.qualification_rules,
                                qualified_when: { ...prev.qualification_rules.qualified_when, urgency_level: updated },
                              },
                            }));
                          }}
                        />
                        <Label htmlFor={`q-urgency-${level}`} className="font-normal cursor-pointer text-sm">
                          {level === 'medium' ? 'Média' : 'Alta'}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label className="text-sm font-semibold">Sentimento que qualifica</Label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { value: 'positive', label: 'Positivo' },
                      { value: 'neutral', label: 'Neutro' },
                    ].map(({ value, label }) => (
                      <div key={value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`q-sentiment-${value}`}
                          checked={agentProfile.qualification_rules?.qualified_when?.sentiment?.includes(value) || false}
                          onCheckedChange={(checked) => {
                            const current = agentProfile.qualification_rules?.qualified_when?.sentiment || [];
                            const updated = checked
                              ? [...current, value]
                              : current.filter((k: string) => k !== value);
                            setAgentProfile(prev => ({
                              ...prev,
                              qualification_rules: {
                                ...prev.qualification_rules,
                                qualified_when: { ...prev.qualification_rules.qualified_when, sentiment: updated },
                              },
                            }));
                          }}
                        />
                        <Label htmlFor={`q-sentiment-${value}`} className="font-normal cursor-pointer text-sm">
                          {label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-poppins flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Critérios de Prioridade Alta
                </CardTitle>
                <CardDescription>
                  Defina quando um lead deve receber prioridade alta no atendimento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-sm font-semibold">Intents de prioridade</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {availableIntents.map((intent) => (
                      <div key={intent.intent_key} className="flex items-center space-x-3">
                        <Checkbox
                          id={`p-intent-${intent.intent_key}`}
                          checked={agentProfile.prioritization_rules?.priority_when?.intents?.includes(intent.intent_key) || false}
                          onCheckedChange={(checked) => {
                            const current = agentProfile.prioritization_rules?.priority_when?.intents || [];
                            const updated = checked
                              ? [...current, intent.intent_key]
                              : current.filter((k: string) => k !== intent.intent_key);
                            setAgentProfile(prev => ({
                              ...prev,
                              prioritization_rules: {
                                ...prev.prioritization_rules,
                                priority_when: { ...prev.prioritization_rules.priority_when, intents: updated },
                              },
                            }));
                          }}
                        />
                        <Label htmlFor={`p-intent-${intent.intent_key}`} className="font-normal cursor-pointer text-sm">
                          {intent.intent_label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label className="text-sm font-semibold">Nível de urgência de prioridade</Label>
                  <div className="flex flex-wrap gap-3">
                    {['medium', 'high'].map((level) => (
                      <div key={level} className="flex items-center space-x-2">
                        <Checkbox
                          id={`p-urgency-${level}`}
                          checked={agentProfile.prioritization_rules?.priority_when?.urgency_level?.includes(level) || false}
                          onCheckedChange={(checked) => {
                            const current = agentProfile.prioritization_rules?.priority_when?.urgency_level || [];
                            const updated = checked
                              ? [...current, level]
                              : current.filter((k: string) => k !== level);
                            setAgentProfile(prev => ({
                              ...prev,
                              prioritization_rules: {
                                ...prev.prioritization_rules,
                                priority_when: { ...prev.prioritization_rules.priority_when, urgency_level: updated },
                              },
                            }));
                          }}
                        />
                        <Label htmlFor={`p-urgency-${level}`} className="font-normal cursor-pointer text-sm">
                          {level === 'medium' ? 'Média' : 'Alta'}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Autonomous Rules Tab */}
        <TabsContent value="autonomo">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-poppins flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Regras de Ativação do Agente Autônomo
              </CardTitle>
              <CardDescription>
                Defina quando o agente autônomo deve atuar nas conversas. Essas regras são verificadas antes de cada resposta automática.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label className="text-sm font-semibold">Modo de ativação</Label>
                <RadioGroup
                  value={agentProfile.autonomous_rules?.mode || 'all'}
                  onValueChange={(v) =>
                    setAgentProfile(prev => ({
                      ...prev,
                      autonomous_rules: { ...prev.autonomous_rules, mode: v as any },
                    }))
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="ar-all" />
                    <Label htmlFor="ar-all" className="font-normal">Todos os leads</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="traffic_only" id="ar-traffic" />
                    <Label htmlFor="ar-traffic" className="font-normal">Apenas leads de tráfego (anúncios)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="organic_only" id="ar-organic" />
                    <Label htmlFor="ar-organic" className="font-normal">Apenas leads orgânicos</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="unassigned_only" id="ar-unassigned" />
                    <Label htmlFor="ar-unassigned" className="font-normal">Apenas leads não atribuídos</Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-semibold">Regras adicionais</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="ar-business-hours"
                      checked={agentProfile.autonomous_rules?.only_outside_business_hours || false}
                      onCheckedChange={(checked) =>
                        setAgentProfile(prev => ({
                          ...prev,
                          autonomous_rules: { ...prev.autonomous_rules, only_outside_business_hours: !!checked },
                        }))
                      }
                    />
                    <Label htmlFor="ar-business-hours" className="font-normal cursor-pointer">
                      Apenas fora do horário comercial (Seg-Sex 8h-18h)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="ar-pause-qualified"
                      checked={agentProfile.autonomous_rules?.pause_after_qualification || false}
                      onCheckedChange={(checked) =>
                        setAgentProfile(prev => ({
                          ...prev,
                          autonomous_rules: { ...prev.autonomous_rules, pause_after_qualification: !!checked },
                        }))
                      }
                    />
                    <Label htmlFor="ar-pause-qualified" className="font-normal cursor-pointer">
                      Pausar após lead qualificado (aguardar humano)
                    </Label>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-xs text-muted-foreground">
                  💡 Essas regras são verificadas no webhook inbound antes de ativar o modo AUTO. Não interferem no modo ASSISTED.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Examples Tab */}
        <TabsContent value="exemplos">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-poppins">Treinamento por Exemplos</CardTitle>
              <CardDescription>
                Ensine a IA com exemplos reais de como sua empresa responde. Quanto mais exemplos, melhor o atendimento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {agentProfile.examples.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8 bg-muted/30 rounded-lg">
                  Nenhum exemplo cadastrado. Adicione exemplos para melhorar as respostas da IA.
                </p>
              )}

              {agentProfile.examples.map((example, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Exemplo #{index + 1}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeExample(index)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs">Cliente diz:</Label>
                    <Input
                      value={example.customer_says}
                      onChange={(e) => updateExample(index, 'customer_says', e.target.value)}
                      placeholder="Ex: Vocês têm SUV automático?"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Resposta ideal:</Label>
                    <Textarea
                      value={example.ideal_response}
                      onChange={(e) => updateExample(index, 'ideal_response', e.target.value)}
                      placeholder="Ex: Temos sim! Qual faixa de preço você está buscando?"
                      className="min-h-[60px]"
                    />
                  </div>
                </div>
              ))}

              <Button variant="outline" className="w-full" onClick={addExample}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar exemplo
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Versions Tab */}
        <TabsContent value="versoes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-poppins">Histórico de Versões</CardTitle>
              <CardDescription>
                Visualize e restaure versões anteriores do treinamento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8 bg-muted/30 rounded-lg">
                  Nenhuma versão salva ainda.
                </p>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3">
                    {versions.map((v) => (
                      <div key={v.id} className={cn(
                        'flex items-center justify-between p-4 rounded-lg border',
                        v.is_active && 'border-primary bg-primary/5'
                      )}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-poppins font-semibold text-sm">Versão {v.version}</span>
                            {v.is_active && <Badge variant="default" className="text-xs">Ativa</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {v.created_at ? format(new Date(v.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Nicho: {v.niche} · Tom: {v.tone} · {v.examples.length} exemplos
                          </p>
                        </div>
                        {!v.is_active && (
                          <Button variant="outline" size="sm" onClick={() => restoreVersion(v)}>
                            <RotateCcw className="h-3 w-3 mr-1" /> Restaurar
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
