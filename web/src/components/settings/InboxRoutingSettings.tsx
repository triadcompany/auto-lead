import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Inbox, Loader2, Save, Clock, Users, Megaphone, MessageCircle } from 'lucide-react';

interface RoutingSettings {
  id?: string;
  organization_id: string;
  enabled: boolean;
  mode: string;
  assign_on: string;
  only_roles: string[];
  business_hours_enabled: boolean;
  business_hours: { start: string; end: string; days: number[] } | null;
  traffic_enabled: boolean;
  non_traffic_enabled: boolean;
  traffic_roles: string[];
  non_traffic_roles: string[];
}

const DAYS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

const AVAILABLE_ROLES = ['seller', 'admin'] as const;
const ROLE_LABELS: Record<string, string> = {
  seller: 'Vendedores',
  admin: 'Administradores',
};

function RoleBadges({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (role: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {AVAILABLE_ROLES.map((role) => (
        <Badge
          key={role}
          variant={selected.includes(role) ? 'default' : 'outline'}
          className="cursor-pointer select-none"
          onClick={() => onToggle(role)}
        >
          {ROLE_LABELS[role] || role}
        </Badge>
      ))}
    </div>
  );
}

export function InboxRoutingSettings() {
  const { profile, orgId: authOrgId } = useAuth();
  const routingOrgId = profile?.organization_id || authOrgId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<RoutingSettings>({
    organization_id: routingOrgId || '',
    enabled: false,
    mode: 'round_robin',
    assign_on: 'first_message',
    only_roles: ['seller', 'admin'],
    business_hours_enabled: false,
    business_hours: { start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] },
    traffic_enabled: true,
    non_traffic_enabled: true,
    traffic_roles: ['seller', 'admin'],
    non_traffic_roles: ['seller', 'admin'],
  });

  const orgId = routingOrgId;

  const fetchSettings = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_routing_settings')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          organization_id: data.organization_id,
          enabled: data.enabled,
          mode: data.mode,
          assign_on: data.assign_on,
          only_roles: (data.only_roles as string[]) || ['seller', 'admin'],
          business_hours_enabled: data.business_hours_enabled,
          business_hours: (data.business_hours as any) || { start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] },
          traffic_enabled: (data as any).traffic_enabled !== false,
          non_traffic_enabled: (data as any).non_traffic_enabled !== false,
          traffic_roles: ((data as any).traffic_roles as string[]) || ['seller', 'admin'],
          non_traffic_roles: ((data as any).non_traffic_roles as string[]) || ['seller', 'admin'],
        });
      }
    } catch (err) {
      console.error('Error fetching routing settings:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const payload = {
        organization_id: orgId,
        enabled: settings.enabled,
        mode: settings.mode,
        assign_on: settings.assign_on,
        only_roles: settings.only_roles,
        business_hours_enabled: settings.business_hours_enabled,
        business_hours: settings.business_hours,
        traffic_enabled: settings.traffic_enabled,
        non_traffic_enabled: settings.non_traffic_enabled,
        traffic_roles: settings.traffic_roles,
        non_traffic_roles: settings.non_traffic_roles,
        updated_at: new Date().toISOString(),
      };

      if (settings.id) {
        const { error } = await supabase
          .from('whatsapp_routing_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_routing_settings')
          .insert(payload);
        if (error) throw error;
      }

      toast.success('Configurações salvas');
      await fetchSettings();
    } catch (err: any) {
      console.error('Error saving routing settings:', err);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setSettings((prev) => {
      const bh = prev.business_hours || { start: '08:00', end: '18:00', days: [] };
      const days = bh.days.includes(day) ? bh.days.filter((d) => d !== day) : [...bh.days, day];
      return { ...prev, business_hours: { ...bh, days } };
    });
  };

  const toggleBucketRole = (bucket: 'traffic' | 'non_traffic', role: string) => {
    const key = bucket === 'traffic' ? 'traffic_roles' : 'non_traffic_roles';
    setSettings((prev) => {
      const roles = prev[key].includes(role)
        ? prev[key].filter((r) => r !== role)
        : [...prev[key], role];
      return { ...prev, [key]: roles.length > 0 ? roles : prev[key] };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-poppins font-semibold text-foreground">
          Distribuição de Conversas (Inbox)
        </h3>
        <p className="text-sm text-muted-foreground font-poppins">
          Configure a atribuição automática de conversas do WhatsApp para sua equipe
        </p>
      </div>

      {/* Toggle principal */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Inbox className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Distribuir automaticamente conversas</p>
                <p className="text-xs text-muted-foreground">
                  Novas conversas serão atribuídas automaticamente aos membros da equipe
                </p>
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings((s) => ({ ...s, enabled: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {settings.enabled && (
        <>
          {/* Modo */}
          <div className="space-y-2">
            <Label className="font-poppins text-sm">Modo de distribuição</Label>
            <Select value={settings.mode} onValueChange={(v) => setSettings((s) => ({ ...s, mode: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="round_robin">Round-robin (alternado)</SelectItem>
                <SelectItem value="least_loaded">Menos carregado</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {settings.mode === 'round_robin'
                ? 'Distribui igualmente entre os membros disponíveis, alternando a cada nova conversa.'
                : 'Atribui ao membro com menos conversas abertas no momento.'}
            </p>
          </div>

          {/* Quando atribuir */}
          <div className="space-y-2">
            <Label className="font-poppins text-sm">Quando atribuir</Label>
            <Select value={settings.assign_on} onValueChange={(v) => setSettings((s) => ({ ...s, assign_on: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first_message">Na primeira mensagem (novo contato)</SelectItem>
                <SelectItem value="any_new_thread">Em qualquer nova conversa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bucket: Tráfego (Ads) */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Megaphone className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Tráfego (Ads)</p>
                    <p className="text-xs text-muted-foreground">
                      Mensagens com marcador de anúncio — fila separada
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.traffic_enabled}
                  onCheckedChange={(checked) => setSettings((s) => ({ ...s, traffic_enabled: checked }))}
                />
              </div>
              {settings.traffic_enabled && (
                <div className="pt-2 border-t border-border space-y-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Quem recebe conversas de tráfego
                  </Label>
                  <RoleBadges
                    selected={settings.traffic_roles}
                    onToggle={(role) => toggleBucketRole('traffic', role)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bucket: Não-tráfego (Orgânico) */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <MessageCircle className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Orgânico / Clientes</p>
                    <p className="text-xs text-muted-foreground">
                      Mensagens sem marcador de anúncio — fila separada
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.non_traffic_enabled}
                  onCheckedChange={(checked) => setSettings((s) => ({ ...s, non_traffic_enabled: checked }))}
                />
              </div>
              {settings.non_traffic_enabled && (
                <div className="pt-2 border-t border-border space-y-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Quem recebe conversas orgânicas
                  </Label>
                  <RoleBadges
                    selected={settings.non_traffic_roles}
                    onToggle={(role) => toggleBucketRole('non_traffic', role)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Horário comercial */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Horário comercial</p>
                    <p className="text-xs text-muted-foreground">
                      Distribuir apenas durante o horário de trabalho
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.business_hours_enabled}
                  onCheckedChange={(checked) => setSettings((s) => ({ ...s, business_hours_enabled: checked }))}
                />
              </div>

              {settings.business_hours_enabled && settings.business_hours && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Início</Label>
                      <Input
                        type="time"
                        value={settings.business_hours.start}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            business_hours: { ...s.business_hours!, start: e.target.value },
                          }))
                        }
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fim</Label>
                      <Input
                        type="time"
                        value={settings.business_hours.end}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            business_hours: { ...s.business_hours!, end: e.target.value },
                          }))
                        }
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dias ativos</Label>
                    <div className="flex gap-1.5">
                      {DAYS.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => toggleDay(day.value)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                            settings.business_hours!.days.includes(day.value)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Button onClick={handleSave} disabled={saving} className="font-poppins">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Salvar configurações
      </Button>
    </div>
  );
}
