import React, { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AI_EVENT_OPTIONS } from "@/services/automationEventBus";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface TriggerEditorProps {
  config: any;
  onChange: (config: any) => void;
}

const triggerTypes = [
  { value: "lead_created", label: "Lead criado" },
  { value: "lead_stage_changed", label: "Lead movido de etapa" },
  { value: "deal_stage_changed", label: "📊 Mudança de etapa (Kanban)" },
  { value: "lead_from_instagram", label: "Lead via Instagram" },
  { value: "lead_from_whatsapp", label: "Lead via WhatsApp" },
  { value: "first_message", label: "📩 Primeira mensagem recebida" },
  { value: "broadcast_campaign", label: "📢 Disparo de Campanha (ao enviar)" },
  { value: "broadcast_response", label: "💬 Resposta a Campanha (ao responder)" },
  { value: "tag_added", label: "Tag adicionada" },
  { value: "form_submitted", label: "Formulário enviado" },
  { value: "event", label: "📡 Evento do sistema (Event Bus)" },
];

const matchTypes = [
  { value: "contains", label: "Contém" },
  { value: "equals", label: "É exatamente" },
  { value: "starts_with", label: "Começa com" },
  { value: "regex", label: "Regex (avançado)" },
];

export function TriggerEditor({ config, onChange }: TriggerEditorProps) {
  const { profile, orgId: authOrgId } = useAuth();
  const orgId = profile?.organization_id || authOrgId;
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; position: number }[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [loadingStages, setLoadingStages] = useState(false);

  // Load pipelines when trigger type is deal_stage_changed
  useEffect(() => {
    if (!["deal_stage_changed", "lead_stage_changed"].includes(config.triggerType) || !orgId) return;
    setLoadingPipelines(true);
    Promise.resolve(
      supabase.rpc("get_org_pipelines", { p_org_id: orgId })
    ).then(({ data }) => {
        setPipelines((data || []).filter((p: any) => p.is_active).map((p: any) => ({ id: p.id, name: p.name })));
      })
      .finally(() => setLoadingPipelines(false));
  }, [config.triggerType, orgId]);

  // Load stages when pipeline_id changes
  useEffect(() => {
    if (!config.pipeline_id) {
      setStages([]);
      return;
    }
    setLoadingStages(true);
    Promise.resolve(
      supabase.rpc("get_pipeline_stages", { p_pipeline_id: config.pipeline_id })
    ).then(({ data }) => {
        setStages(
          (data || [])
            .filter((s: any) => s.is_active)
            .map((s: any) => ({ id: s.id, name: s.name, position: s.position }))
            .sort((a: any, b: any) => a.position - b.position)
        );
      })
      .finally(() => setLoadingStages(false));
  }, [config.pipeline_id]);

  return (
    <div className="space-y-4">
      <div>
        <Label className="font-poppins text-sm font-medium">Tipo de gatilho</Label>
        <Select
          value={config.triggerType || ""}
          onValueChange={(v) => onChange({ ...config, triggerType: v })}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="Selecione o gatilho" />
          </SelectTrigger>
          <SelectContent>
            {triggerTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── First Message trigger config ── */}
      {config.triggerType === "first_message" && (
        <div className="space-y-4 border border-border rounded-lg p-3 bg-muted/30">
          <p className="text-[11px] text-muted-foreground">
            Dispara apenas na primeira mensagem de um contato (dedup via <code>whatsapp_first_touch</code>). Funciona com WhatsApp e Instagram.
          </p>

          {/* Normalize toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-poppins text-sm">Ignorar acentos e maiúsculas</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Normaliza texto para comparação (ex: "AnÚncio" = "anuncio")
              </p>
            </div>
            <Switch
              checked={config.ignore_accents_case ?? true}
              onCheckedChange={(v) => onChange({ ...config, ignore_accents_case: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-poppins text-sm">Filtrar por palavra-chave</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Se desativado, dispara em qualquer primeira mensagem
              </p>
            </div>
            <Switch
              checked={config.useKeyword ?? false}
              onCheckedChange={(v) => onChange({ ...config, useKeyword: v })}
            />
          </div>

          {config.useKeyword && (
            <>
              <div>
                <Label className="font-poppins text-sm">Palavra-chave</Label>
                <Input
                  className="mt-1.5"
                  placeholder="anuncio"
                  value={config.keyword || ""}
                  onChange={(e) => onChange({ ...config, keyword: e.target.value })}
                />
              </div>

              <div>
                <Label className="font-poppins text-sm">Tipo de match</Label>
                <Select
                  value={config.matchType || "contains"}
                  onValueChange={(v) => onChange({ ...config, matchType: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {matchTypes.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {config.matchType === "regex" && (
                <p className="text-[10px] text-muted-foreground bg-muted p-2 rounded">
                  Exemplo: <code>anun[cç]io|promo[çc][aã]o</code>
                  {(config.ignore_accents_case ?? true)
                    ? " — normalização será aplicada antes do regex"
                    : " — case-insensitive por padrão (flag 'i')"}
                </p>
              )}
            </>
          )}

          <div>
            <Label className="font-poppins text-sm">Canal</Label>
            <Select
              value={config.channel || "all"}
              onValueChange={(v) => onChange({ ...config, channel: v })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* ── Event Bus trigger config ── */}
      {config.triggerType === "event" && (
        <div className="space-y-4 border border-border rounded-lg p-3 bg-muted/30">
          <div>
            <Label className="font-poppins text-sm">Evento</Label>
            <Select
              value={config.triggerEventName || ""}
              onValueChange={(v) => onChange({ ...config, triggerEventName: v })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecione o evento" />
              </SelectTrigger>
              <SelectContent>
                {AI_EVENT_OPTIONS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-poppins text-sm">Permitir disparo por IA</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Se ativado, eventos gerados por IA podem disparar esta automação
              </p>
            </div>
            <Switch
              checked={config.allowAiTriggers ?? false}
              onCheckedChange={(v) => onChange({ ...config, allowAiTriggers: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-poppins text-sm">Permitir disparo por humano</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Se ativado, eventos confirmados por humanos podem disparar esta automação
              </p>
            </div>
            <Switch
              checked={config.allowHumanTriggers ?? true}
              onCheckedChange={(v) => onChange({ ...config, allowHumanTriggers: v })}
            />
          </div>

          <div>
            <Label className="font-poppins text-sm">Throttle (segundos)</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Tempo mínimo entre disparos (0 = sem limite)
            </p>
            <Input
              type="number"
              className="mt-1.5 w-32"
              min={0}
              value={config.throttleSeconds ?? 0}
              onChange={(e) => onChange({ ...config, throttleSeconds: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
      )}

      {config.triggerType === "lead_stage_changed" && (
        <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/30">
          <div>
            <Label className="font-poppins text-sm">Pipeline</Label>
            {loadingPipelines ? (
              <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <Select
                value={config.pipeline_id || ""}
                onValueChange={(v) => {
                  const pipeline = pipelines.find(p => p.id === v);
                  onChange({
                    ...config,
                    pipeline_id: v,
                    pipeline: pipeline?.name || "",
                    stage_id: "",
                    stage: "",
                  });
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione o pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label className="font-poppins text-sm">Etapa</Label>
            {!config.pipeline_id ? (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Selecione um pipeline primeiro
              </p>
            ) : loadingStages ? (
              <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando etapas...
              </div>
            ) : (
              <Select
                value={config.stage_id || ""}
                onValueChange={(v) => {
                  const stage = stages.find(s => s.id === v);
                  onChange({
                    ...config,
                    stage_id: v,
                    stage: stage?.name || "",
                  });
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      )}

      {config.triggerType === "deal_stage_changed" && (
        <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/30">
          <p className="text-[11px] text-muted-foreground">
            Dispara quando um lead é movido para a etapa destino no Kanban. Publica <code>deal.stage_changed</code> no Event Bus.
          </p>

          <div>
            <Label className="font-poppins text-sm">Pipeline</Label>
            {loadingPipelines ? (
              <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <Select
                value={config.pipeline_id || ""}
                onValueChange={(v) => {
                  const pipeline = pipelines.find(p => p.id === v);
                  onChange({
                    ...config,
                    pipeline_id: v,
                    pipeline: pipeline?.name || "",
                    stage_id: "",
                    stage: "",
                  });
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione o pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label className="font-poppins text-sm">Etapa destino</Label>
            {!config.pipeline_id ? (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Selecione um pipeline primeiro
              </p>
            ) : loadingStages ? (
              <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando etapas...
              </div>
            ) : (
              <Select
                value={config.stage_id || ""}
                onValueChange={(v) => {
                  const stage = stages.find(s => s.id === v);
                  onChange({
                    ...config,
                    stage_id: v,
                    stage: stage?.name || "",
                  });
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      )}

      {config.triggerType === "broadcast_campaign" && (
        <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/30">
          <p className="text-[11px] text-muted-foreground">
            Dispara automaticamente para cada destinatário após o envio da mensagem do broadcast.
            O contexto inclui: <code>campaign_id</code>, <code>recipient_phone</code>, <code>instance_name</code>, <code>variables</code> e <code>message_id</code>.
          </p>
          <p className="text-[10px] text-muted-foreground">
            💡 Use o bloco "Esperar Resposta" ou a condição "Respondeu à campanha" para criar fluxos de follow-up inteligentes.
          </p>
        </div>
      )}

      {config.triggerType === "tag_added" && (
        <div>
          <Label className="font-poppins text-sm">Tag</Label>
          <Input
            className="mt-1.5"
            placeholder="Nome da tag"
            value={config.tag || ""}
            onChange={(e) => onChange({ ...config, tag: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
