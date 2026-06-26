import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import {
  Settings, Users, Loader2, Save, Megaphone, MessageCircle, UserCheck, RefreshCw,
  Zap, ArrowRight, GitBranch,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseProfiles } from '@/hooks/useSupabaseProfiles';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { DistributionScheduleManager } from './DistributionScheduleManager';
import { useNavigate } from 'react-router-dom';

interface BucketSettings {
  id?: string;
  organization_id: string;
  bucket: 'traffic' | 'non_traffic';
  enabled: boolean;
  mode: 'auto' | 'fixed_user';
  auto_assign_user_ids: string[];
  fixed_user_id: string | null;
}

interface GlobalSettings {
  id?: string;
  organization_id: string;
  enabled: boolean;
}

interface RoutingState {
  bucket: string;
  last_assigned_user_id: string | null;
}

const DEFAULT_BUCKET = (bucket: 'traffic' | 'non_traffic', orgId: string): BucketSettings => ({
  organization_id: orgId,
  bucket,
  enabled: true,
  mode: 'auto',
  auto_assign_user_ids: [],
  fixed_user_id: null,
});

const LeadDistribution: React.FC = () => {
  const { profile, isAdmin, orgId: authOrgId } = useAuth();
  const { profiles } = useSupabaseProfiles();
  const orgId = profile?.organization_id || authOrgId || '';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<'traffic' | 'non_traffic' | null>(null);
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [globalSettingsId, setGlobalSettingsId] = useState<string | undefined>();
  const [transferIntroMessage, setTransferIntroMessage] = useState('');
  const [trafficSettings, setTrafficSettings] = useState<BucketSettings>(DEFAULT_BUCKET('traffic', orgId));
  const [nonTrafficSettings, setNonTrafficSettings] = useState<BucketSettings>(DEFAULT_BUCKET('non_traffic', orgId));
  const [routingStates, setRoutingStates] = useState<RoutingState[]>([]);
  // 'settings' = use the config below | 'automation' = bypass, handled by automations
  const [distributionMode, setDistributionMode] = useState<'settings' | 'automation'>('settings');

  const fetchData = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: globalData } = await supabase
        .from('whatsapp_routing_settings')
        .select('id, enabled, transfer_intro_message, distribution_mode')
        .eq('organization_id', orgId)
        .maybeSingle();

      if (globalData) {
        setGlobalEnabled(globalData.enabled);
        setGlobalSettingsId(globalData.id);
        setTransferIntroMessage((globalData as any).transfer_intro_message ?? '');
        setDistributionMode(((globalData as any).distribution_mode as any) || 'settings');
      }

      const { data: bucketData } = await supabase
        .from('whatsapp_routing_bucket_settings')
        .select('*')
        .eq('organization_id', orgId);

      if (bucketData) {
        for (const row of bucketData) {
          const parsed: BucketSettings = {
            id: row.id,
            organization_id: row.organization_id,
            bucket: row.bucket as 'traffic' | 'non_traffic',
            enabled: row.enabled,
            mode: row.mode as 'auto' | 'fixed_user',
            auto_assign_user_ids: (row.auto_assign_user_ids as string[]) || [],
            fixed_user_id: row.fixed_user_id,
          };
          if (row.bucket === 'traffic') setTrafficSettings(parsed);
          else setNonTrafficSettings(parsed);
        }
      }

      const { data: stateData } = await supabase
        .from('whatsapp_routing_state')
        .select('bucket, last_assigned_user_id')
        .eq('organization_id', orgId);

      setRoutingStates(stateData || []);
    } catch (err) {
      console.error('Error fetching distribution settings:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!orgId || !isAdmin) return;
    setSaving(true);
    try {
      // When automation mode, force enabled = false so the legacy routing doesn't fire
      const effectiveEnabled = distributionMode === 'automation' ? false : globalEnabled;

      if (globalSettingsId) {
        const { error } = await supabase
          .from('whatsapp_routing_settings')
          .update({
            enabled: effectiveEnabled,
            transfer_intro_message: transferIntroMessage || null,
            distribution_mode: distributionMode,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', globalSettingsId);
        if (error) { toast.error('Erro ao salvar: ' + error.message); setSaving(false); return; }
      } else {
        const { data, error } = await supabase
          .from('whatsapp_routing_settings')
          .insert({
            organization_id: orgId,
            enabled: effectiveEnabled,
            transfer_intro_message: transferIntroMessage || null,
            distribution_mode: distributionMode,
          } as any)
          .select('id')
          .single();
        if (error) { toast.error('Erro ao inserir: ' + error.message); setSaving(false); return; }
        if (data) setGlobalSettingsId(data.id);
      }

      // Save each bucket (only relevant when mode = settings, but save anyway to persist config)
      for (const settings of [trafficSettings, nonTrafficSettings]) {
        const payload = {
          organization_id: orgId,
          bucket: settings.bucket,
          enabled: settings.enabled,
          mode: settings.mode,
          auto_assign_user_ids: settings.auto_assign_user_ids,
          fixed_user_id: settings.mode === 'fixed_user' ? settings.fixed_user_id : null,
          updated_at: new Date().toISOString(),
        };

        if (settings.id) {
          const { error } = await supabase
            .from('whatsapp_routing_bucket_settings')
            .update(payload)
            .eq('id', settings.id);
          if (error) toast.error('Erro bucket: ' + error.message);
        } else {
          const { data, error } = await supabase
            .from('whatsapp_routing_bucket_settings')
            .insert(payload)
            .select('id')
            .single();
          if (error) toast.error('Erro bucket: ' + error.message);
          else if (data) {
            if (settings.bucket === 'traffic') setTrafficSettings(s => ({ ...s, id: data.id }));
            else setNonTrafficSettings(s => ({ ...s, id: data.id }));
          }
        }
      }

      toast.success('Configurações salvas com sucesso');
      await fetchData();
    } catch (err) {
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  // Resolve user_id or id or clerk_user_id → display name
  const getUserName = (userId: string) => {
    if (!userId) return 'Usuário';
    const p = profiles.find(
      pr => pr.user_id === userId || pr.id === userId || (pr as any).clerk_user_id === userId
    );
    return p?.name || 'Usuário desconhecido';
  };

  const getNextInQueue = (bucket: 'traffic' | 'non_traffic') => {
    const settings = bucket === 'traffic' ? trafficSettings : nonTrafficSettings;
    if (settings.mode !== 'auto' || settings.auto_assign_user_ids.length === 0) return null;

    const state = routingStates.find(s => s.bucket === bucket);
    if (!state?.last_assigned_user_id) {
      return getUserName(settings.auto_assign_user_ids[0]);
    }

    const lastIdx = settings.auto_assign_user_ids.indexOf(state.last_assigned_user_id);
    const nextIdx = lastIdx === -1 ? 0 : (lastIdx + 1) % settings.auto_assign_user_ids.length;
    return getUserName(settings.auto_assign_user_ids[nextIdx]);
  };

  const handleResetCursor = async (bucket: 'traffic' | 'non_traffic') => {
    if (!orgId) return;
    setResetting(bucket);
    try {
      await supabase
        .from('whatsapp_routing_state')
        .delete()
        .eq('organization_id', orgId)
        .eq('bucket', bucket);

      setRoutingStates(prev => prev.filter(s => s.bucket !== bucket));
      toast.success(`Fila de ${bucket === 'traffic' ? 'tráfego' : 'orgânico'} resetada — próximo lead vai para o primeiro usuário`);
    } catch (err) {
      toast.error('Erro ao resetar fila');
    } finally {
      setResetting(null);
    }
  };

  const toggleUserInBucket = (bucket: 'traffic' | 'non_traffic', userId: string) => {
    const setter = bucket === 'traffic' ? setTrafficSettings : setNonTrafficSettings;
    setter(prev => {
      const ids = prev.auto_assign_user_ids.includes(userId)
        ? prev.auto_assign_user_ids.filter(id => id !== userId)
        : [...prev.auto_assign_user_ids, userId];
      return { ...prev, auto_assign_user_ids: ids };
    });
  };

  const readOnly = !isAdmin;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderBucketTab = (bucket: 'traffic' | 'non_traffic') => {
    const settings = bucket === 'traffic' ? trafficSettings : nonTrafficSettings;
    const setter = bucket === 'traffic' ? setTrafficSettings : setNonTrafficSettings;
    const nextUser = getNextInQueue(bucket);
    const isResetting = resetting === bucket;

    return (
      <div className="space-y-5 pt-2">
        {/* Enable bucket */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Bucket ativo</Label>
            <p className="text-xs text-muted-foreground">
              {bucket === 'traffic'
                ? 'Distribuir leads vindos de anúncios'
                : 'Distribuir leads orgânicos / clientes antigos'}
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => setter(s => ({ ...s, enabled: checked }))}
            disabled={readOnly}
          />
        </div>

        {settings.enabled && (
          <>
            {/* Mode */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Modo de distribuição</Label>
              <RadioGroup
                value={settings.mode}
                onValueChange={(v) => setter(s => ({ ...s, mode: v as 'auto' | 'fixed_user' }))}
                disabled={readOnly}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="auto" id={`${bucket}-auto`} />
                  <Label htmlFor={`${bucket}-auto`} className="cursor-pointer flex-1">
                    <span className="font-medium text-sm">Automático (Round-robin)</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Distribui alternando entre os usuários selecionados em ordem circular
                    </p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="fixed_user" id={`${bucket}-fixed`} />
                  <Label htmlFor={`${bucket}-fixed`} className="cursor-pointer flex-1">
                    <span className="font-medium text-sm">Usuário único</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Todos os leads deste bucket vão para um único responsável
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Auto mode: user list */}
            {settings.mode === 'auto' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Usuários que recebem leads
                  <span className="text-xs text-muted-foreground font-normal">
                    (salve após selecionar)
                  </span>
                </Label>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {profiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3 text-center">
                      Nenhum usuário encontrado nesta organização
                    </p>
                  ) : (
                    profiles.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <Checkbox
                          checked={settings.auto_assign_user_ids.includes(p.user_id)}
                          onCheckedChange={() => toggleUserInBucket(bucket, p.user_id)}
                          disabled={readOnly}
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">({p.role})</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Usuários na fila</p>
                    <p className="text-sm font-semibold">
                      {settings.auto_assign_user_ids.length > 0
                        ? `${settings.auto_assign_user_ids.length} usuário${settings.auto_assign_user_ids.length > 1 ? 's' : ''}`
                        : <span className="text-muted-foreground font-normal text-xs">Nenhum selecionado</span>}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Próximo na fila</p>
                    <p className="text-sm font-semibold">
                      {nextUser ?? (
                        <span className="text-muted-foreground font-normal text-xs">
                          {settings.auto_assign_user_ids.length === 0 ? 'Sem usuários' : 'N/A'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {isAdmin && settings.auto_assign_user_ids.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResetCursor(bucket)}
                    disabled={isResetting}
                    className="w-full font-poppins gap-2 text-xs"
                  >
                    {isResetting
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />}
                    Resetar fila (próximo vai para {getUserName(settings.auto_assign_user_ids[0])})
                  </Button>
                )}
              </div>
            )}

            {/* Fixed user mode */}
            {settings.mode === 'fixed_user' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Usuário responsável
                </Label>
                <Select
                  value={settings.fixed_user_id || ''}
                  onValueChange={(v) => setter(s => ({ ...s, fixed_user_id: v }))}
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.name} ({p.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {settings.fixed_user_id && (
                  <p className="text-xs text-muted-foreground">
                    Todos os leads de {bucket === 'traffic' ? 'tráfego' : 'orgânico'} serão atribuídos a{' '}
                    <strong>{getUserName(settings.fixed_user_id)}</strong>.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* ── Modo de distribuição ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-5 w-5" />
            Modo de Distribuição
          </CardTitle>
          <CardDescription>
            Escolha como os leads do WhatsApp são atribuídos aos vendedores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={distributionMode}
            onValueChange={(v) => setDistributionMode(v as 'settings' | 'automation')}
            disabled={readOnly}
            className="space-y-3"
          >
            {/* Opção: Via Configurações */}
            <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              distributionMode === 'settings'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-border/80 hover:bg-accent/30'
            } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <RadioGroupItem value="settings" id="mode-settings" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <GitBranch className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm font-poppins">Via Configurações</span>
                  {distributionMode === 'settings' && (
                    <Badge className="text-xs bg-primary/10 text-primary border-0">Ativo</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-poppins leading-relaxed">
                  Round-robin ou usuário fixo. Configure abaixo quem recebe cada tipo de lead.
                  Ideal para equipes com regras simples.
                </p>
              </div>
            </label>

            {/* Opção: Via Automações */}
            <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              distributionMode === 'automation'
                ? 'border-orange-500 bg-orange-500/5'
                : 'border-border hover:border-border/80 hover:bg-accent/30'
            } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <RadioGroupItem value="automation" id="mode-automation" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold text-sm font-poppins">Via Automações</span>
                  {distributionMode === 'automation' && (
                    <Badge className="text-xs bg-orange-500/10 text-orange-600 border-0">Ativo</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-poppins leading-relaxed">
                  Use o bloco <strong className="text-foreground">Atribuir Responsável</strong> nas
                  suas automações para ter controle total: distribua por fonte, horário, tag ou qualquer
                  condição. A distribuição acima fica pausada.
                </p>
              </div>
            </label>
          </RadioGroup>

          {/* Info card when automation mode is active */}
          {distributionMode === 'automation' && (
            <div className="mt-4 p-4 rounded-xl bg-orange-500/8 border border-orange-500/20 space-y-3">
              <p className="text-sm font-semibold font-poppins text-foreground">
                A distribuição via Configurações está pausada
              </p>
              <p className="text-xs text-muted-foreground font-poppins leading-relaxed">
                Para que os leads sejam atribuídos automaticamente, crie uma automação com o gatilho
                <strong className="text-foreground"> Lead criado</strong> e adicione o bloco
                <strong className="text-foreground"> Atribuir Responsável</strong> com o usuário desejado.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 text-xs font-poppins border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
                  onClick={() => navigate('/automacoes')}
                >
                  Ver Automações
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Config (only visible in settings mode) ── */}
      {distributionMode === 'settings' && (
        <>
          {/* Global toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4" />
                Distribuição Automática
              </CardTitle>
              <CardDescription>
                Configure como os leads são distribuídos entre os vendedores.
                Leads de tráfego pago (Meta Ads) e leads orgânicos têm filas independentes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Ativar distribuição automática</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando ativada, novos leads são atribuídos automaticamente conforme as regras por bucket
                  </p>
                </div>
                <Switch
                  checked={globalEnabled}
                  onCheckedChange={setGlobalEnabled}
                  disabled={readOnly}
                />
              </div>
            </CardContent>
          </Card>

          {/* Per-bucket configuration */}
          {globalEnabled && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5" />
                  Configuração por Bucket
                </CardTitle>
                <CardDescription>
                  Tráfego = leads com marcador de anúncio (palavra "anuncio" na mensagem).
                  Não-tráfego = leads orgânicos e clientes antigos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="traffic">
                  <TabsList className="w-full">
                    <TabsTrigger value="traffic" className="flex-1 gap-2">
                      <Megaphone className="h-4 w-4" />
                      Tráfego (Ads)
                    </TabsTrigger>
                    <TabsTrigger value="non_traffic" className="flex-1 gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Não-tráfego
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="traffic">
                    {renderBucketTab('traffic')}
                  </TabsContent>
                  <TabsContent value="non_traffic">
                    {renderBucketTab('non_traffic')}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* Time-based schedule rules */}
          {globalEnabled && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  Regras de Horário
                </CardTitle>
                <CardDescription>
                  Defina diferentes conjuntos de usuários para cada período do dia.
                  Quando uma regra de horário se aplica, ela substitui a lista padrão do round-robin.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DistributionScheduleManager
                  orgId={orgId}
                  profiles={profiles}
                  isAdmin={isAdmin}
                />
              </CardContent>
            </Card>
          )}

          {/* How it works info */}
          {globalEnabled && (
            <div className="rounded-xl bg-muted/40 border border-border p-4 text-xs text-muted-foreground font-poppins space-y-1.5">
              <p className="font-semibold text-foreground text-sm mb-2">Como funciona a distribuição</p>
              <p>1. Ao chegar um lead pelo WhatsApp, o sistema identifica se é <strong>tráfego</strong> (mensagem contém "anuncio") ou <strong>orgânico</strong>.</p>
              <p>2. Verifica se há uma <strong>regra de horário ativa</strong> para o momento atual — se houver, usa os usuários daquela regra.</p>
              <p>3. Se não há regra de horário aplicável, usa a <strong>lista padrão do bucket</strong> em round-robin.</p>
              <p>4. No modo <strong>round-robin</strong>, cada novo lead vai para o próximo usuário da fila em sequência circular.</p>
              <p>5. Leads já atribuídos, clientes ou oportunidades ganhas <strong>não são redistribuídos</strong>.</p>
            </div>
          )}
        </>
      )}

      {/* Transfer intro message (always visible) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Mensagem de Apresentação na Transferência
          </CardTitle>
          <CardDescription>
            Enviada automaticamente ao lead quando uma conversa é transferida para um vendedor.
            Use as variáveis disponíveis para personalizar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Olá {nome_lead}! Vou te conectar com {nome_vendedor}, nosso consultor especialista. Ele dará continuidade ao seu atendimento."
            value={transferIntroMessage}
            onChange={(e) => setTransferIntroMessage(e.target.value)}
            disabled={readOnly}
            className="min-h-[80px] resize-none text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {['{nome_lead}', '{nome_vendedor}', '{nome_empresa}'].map((v) => (
              <button
                key={v}
                type="button"
                disabled={readOnly}
                onClick={() => setTransferIntroMessage((prev) => prev + v)}
                className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {v}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Deixe em branco para usar a mensagem padrão do sistema.
          </p>
        </CardContent>
      </Card>

      {/* Save button */}
      {isAdmin && (
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Configurações
        </Button>
      )}

      {!isAdmin && (
        <p className="text-sm text-muted-foreground text-center">
          Somente administradores podem alterar estas configurações.
        </p>
      )}
    </div>
  );
};

export default LeadDistribution;
