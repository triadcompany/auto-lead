import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Info, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  BroadcastCampaign,
  useBroadcasts,
} from '@/hooks/useBroadcasts';

interface Props {
  campaign: BroadcastCampaign;
  onClose: () => void;
}

/**
 * Edit a broadcast campaign.
 * Only available when the campaign is `paused`, `scheduled`, or `canceled`.
 * For safety, recipients / instance / payload type / media cannot be edited
 * after creation — duplicate the campaign instead.
 */
export function EditCampaignModal({ campaign, onClose }: Props) {
  const { orgId } = useAuth();
  const { updateCampaign } = useBroadcasts();

  const settings = (campaign.settings || {}) as Record<string, any>;
  const payload = (campaign.payload || {}) as Record<string, any>;

  const [name, setName] = useState(campaign.name);
  const [messageText, setMessageText] = useState<string>(payload.text || '');
  const [caption, setCaption] = useState<string>(payload.caption || '');

  const [minDelay, setMinDelay] = useState<number>(settings.minDelay ?? 20);
  const [maxDelay, setMaxDelay] = useState<number>(settings.maxDelay ?? 60);
  const [limitPerHour, setLimitPerHour] = useState<number>(settings.limitPerHour ?? 80);
  const [windowStart, setWindowStart] = useState<string>(settings.windowStart || '09:00');
  const [windowEnd, setWindowEnd] = useState<string>(settings.windowEnd || '18:00');
  const [noDuplicate, setNoDuplicate] = useState<boolean>(settings.noDuplicate ?? true);

  const [responseWindowHours, setResponseWindowHours] = useState<number>(
    campaign.response_window_hours ?? 24,
  );

  const [enableAutomation, setEnableAutomation] = useState<boolean>(
    campaign.enable_automation ?? false,
  );
  const [automationId, setAutomationId] = useState<string>(campaign.automation_id || '');

  const [scheduledAt, setScheduledAt] = useState<string>(
    campaign.scheduled_at
      ? new Date(campaign.scheduled_at).toISOString().slice(0, 16)
      : '',
  );

  // Lock fields that depend on campaign type
  const isText = campaign.payload_type === 'text' || campaign.payload_type === 'interactive';
  const hasCaption =
    campaign.payload_type === 'image' || (campaign.payload_type as string) === 'document';
  const isScheduled = campaign.status === 'scheduled';

  // Automations list
  const { data: automations } = useQuery({
    queryKey: ['automations-for-broadcast', orgId],
    enabled: !!orgId && enableAutomation,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/automations-api`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: 'list', organization_id: orgId }),
        },
      );
      const json = await res.json();
      return (json?.automations || []) as Array<{
        id: string;
        name: string;
        is_active: boolean;
      }>;
    },
  });

  const handleSave = async () => {
    if (!name.trim()) return;

    // Build merged payload preserving fields we don't expose for edit (media_url, file_name, audio_url, etc.)
    const newPayload: Record<string, any> = { ...payload };
    if (isText) newPayload.text = messageText;
    if (hasCaption) newPayload.caption = caption;

    const newSettings: Record<string, any> = {
      ...settings,
      minDelay,
      maxDelay,
      limitPerHour,
      windowStart,
      windowEnd,
      noDuplicate,
    };

    await updateCampaign.mutateAsync({
      id: campaign.id,
      name: name.trim(),
      payload: newPayload,
      settings: newSettings,
      response_window_hours: responseWindowHours,
      enable_automation: enableAutomation,
      automation_id: enableAutomation ? automationId || null : null,
      scheduled_at: isScheduled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="font-poppins">Editar campanha</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Para alterar a lista de destinatários, instância ou tipo de mídia, use a opção{' '}
              <strong>Duplicar</strong> e crie uma nova campanha.
            </AlertDescription>
          </Alert>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-sm">Nome da campanha</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {/* Message text */}
          {isText && (
            <div className="space-y-1.5">
              <Label className="text-sm">
                {campaign.payload_type === 'interactive' ? 'Texto da mensagem (com botões)' : 'Mensagem'}
              </Label>
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={6}
                placeholder="Digite a mensagem..."
              />
              <p className="text-xs text-muted-foreground">
                Variáveis dinâmicas (ex.: <code>{'{{nome}}'}</code>) são preservadas conforme a origem original.
              </p>
            </div>
          )}

          {/* Caption (image/document) */}
          {hasCaption && (
            <div className="space-y-1.5">
              <Label className="text-sm">Legenda</Label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                placeholder="Legenda opcional..."
              />
            </div>
          )}

          {/* Schedule (only if currently scheduled) */}
          {isScheduled && (
            <div className="space-y-1.5">
              <Label className="text-sm">Agendamento</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          )}

          {/* Throttle settings */}
          <div className="rounded-lg border p-4 space-y-4">
            <div className="text-sm font-medium">Cadência de envio</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Delay mínimo (s)</Label>
                <Input
                  type="number"
                  min={1}
                  value={minDelay}
                  onChange={(e) => setMinDelay(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Delay máximo (s)</Label>
                <Input
                  type="number"
                  min={1}
                  value={maxDelay}
                  onChange={(e) => setMaxDelay(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Limite por hora</Label>
                <Input
                  type="number"
                  min={1}
                  value={limitPerHour}
                  onChange={(e) => setLimitPerHour(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Janela início</Label>
                <Input
                  type="time"
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs text-muted-foreground">Janela fim</Label>
                <Input
                  type="time"
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <Label className="text-sm">Evitar números duplicados</Label>
                <p className="text-xs text-muted-foreground">Ignora números que já receberam outras campanhas recentes</p>
              </div>
              <Switch checked={noDuplicate} onCheckedChange={setNoDuplicate} />
            </div>
          </div>

          {/* Automation */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Vincular automação</Label>
                <p className="text-xs text-muted-foreground">
                  Dispara uma automação quando o destinatário responder
                </p>
              </div>
              <Switch checked={enableAutomation} onCheckedChange={setEnableAutomation} />
            </div>
            {enableAutomation && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Automação</Label>
                  <Select value={automationId} onValueChange={setAutomationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma automação" />
                    </SelectTrigger>
                    <SelectContent>
                      {(automations || []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} {!a.is_active && '(inativa)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Janela de resposta (horas)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={responseWindowHours}
                    onChange={(e) => setResponseWindowHours(Number(e.target.value) || 24)}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} disabled={updateCampaign.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateCampaign.isPending || !name.trim()}>
            {updateCampaign.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
