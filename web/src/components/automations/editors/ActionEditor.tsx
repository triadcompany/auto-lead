import React, { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CreateEventDefinitionModal } from "./CreateEventDefinitionModal";

interface ActionEditorProps {
  config: any;
  onChange: (config: any) => void;
}

const actionTypes = [
  { value: "add_tag", label: "Adicionar tag" },
  { value: "move_stage", label: "Mover etapa" },
  { value: "assign_owner", label: "Atribuir responsável" },
  { value: "send_whatsapp", label: "Enviar WhatsApp" },
  { value: "send_email", label: "Enviar e-mail" },
  { value: "update_lead", label: "Atualizar lead" },
  { value: "create_deal", label: "Criar negócio" },
  { value: "send_meta_event", label: "📊 Enviar para Meta (CAPI)" },
  { value: "end_automation", label: "Encerrar automação" },
];

const priorityOptions = [
  { value: "0", label: "Sem prioridade" },
  { value: "1", label: "1 – Baixa" },
  { value: "2", label: "2 – Média" },
  { value: "3", label: "3 – Alta" },
  { value: "4", label: "4 – Urgente" },
];

interface Pipeline {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  name: string;
  pipeline_id: string;
}

interface LeadSource {
  id: string;
  name: string;
}

export function ActionEditor({ config, onChange }: ActionEditorProps) {
  const params = config.params || {};
  const { profile, orgId: authOrgId } = useAuth();
  const orgId = profile?.organization_id || authOrgId;

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [eventDefs, setEventDefs] = useState<{ id: string; name: string; meta_event_name: string }[]>([]);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  // Fetch pipelines, sources and members once
  useEffect(() => {
    if (!orgId) return;

    const fetchData = async () => {
      const [pRes, sRes, mRes, eRes] = await Promise.all([
        supabase.rpc("get_org_pipelines", { p_org_id: orgId }),
        supabase.rpc("get_org_lead_sources", { p_org_id: orgId }),
        supabase.rpc("get_org_members", { p_org_id: orgId }),
        supabase.from("capi_event_definitions" as any).select("id, name, meta_event_name").eq("organization_id", orgId).eq("active", true).order("name"),
      ]);
      if (pRes.data) setPipelines(pRes.data as Pipeline[]);
      if (sRes.data) setSources(sRes.data as LeadSource[]);
      if (mRes.data) setMembers((mRes.data as any[]).map((m: any) => ({ id: m.user_id, name: m.full_name || m.clerk_user_id })));
      if (eRes.data) setEventDefs(eRes.data as any[]);
    };
    fetchData();
  }, [orgId]);

  // Fetch stages when pipeline changes
  useEffect(() => {
    if (!params.pipeline_id) {
      setStages([]);
      return;
    }
    const fetchStages = async () => {
      const { data } = await supabase.rpc("get_pipeline_stages", {
        p_pipeline_id: params.pipeline_id,
      });
      if (data) setStages(data as Stage[]);
    };
    fetchStages();
  }, [params.pipeline_id]);

  const updateParams = (key: string, value: string | boolean) => {
    onChange({ ...config, params: { ...params, [key]: value } });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="font-poppins text-sm font-medium">Tipo de ação</Label>
        <Select
          value={config.actionType || ""}
          onValueChange={(v) => onChange({ ...config, actionType: v, params: {} })}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="Selecione a ação" />
          </SelectTrigger>
          <SelectContent>
            {actionTypes.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Criar negócio ── */}
      {config.actionType === "create_deal" && (
        <div className="space-y-4 border border-border rounded-lg p-3 bg-muted/30">
          <p className="text-[11px] text-muted-foreground font-poppins">
            Cria um lead/negócio no CRM com os dados abaixo.
          </p>

          {/* Origem */}
          <div>
            <Label className="font-poppins text-sm">Origem do lead</Label>
            <Select
              value={params.source || ""}
              onValueChange={(v) => updateParams("source", v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecione a origem" />
              </SelectTrigger>
              <SelectContent>
                {sources.length > 0 ? (
                  sources.map((s) => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__none__" disabled>
                    Nenhuma origem cadastrada
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Pipeline */}
          <div>
            <Label className="font-poppins text-sm">Pipeline</Label>
            <Select
              value={params.pipeline_id || ""}
              onValueChange={(v) => {
                onChange({
                  ...config,
                  params: { ...params, pipeline_id: v, stage_id: "" },
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
          </div>

          {/* Etapa */}
          <div>
            <Label className="font-poppins text-sm">Etapa</Label>
            <Select
              value={params.stage_id || ""}
              onValueChange={(v) => updateParams("stage_id", v)}
              disabled={!params.pipeline_id}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={params.pipeline_id ? "Selecione a etapa" : "Selecione o pipeline primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prioridade */}
          <div>
            <Label className="font-poppins text-sm">Prioridade</Label>
            <Select
              value={String(params.priority ?? "0")}
              onValueChange={(v) => updateParams("priority", v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsável */}
          <div>
            <Label className="font-poppins text-sm">Responsável (se vazio, usa distribuição/fallback)</Label>
            <Select
              value={params.owner_id || "none"}
              onValueChange={(v) => updateParams("owner_id", v === "none" ? "" : v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Nenhum (distribuição automática)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (distribuição automática)</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              Se não escolher um responsável, o sistema atribui automaticamente via distribuição ou fallback (admin/primeiro vendedor).
            </p>
          </div>

          {/* Deduplicação */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-poppins text-sm">Deduplicação</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Criar apenas se não existir negócio aberto para esse telefone
              </p>
            </div>
            <Switch
              checked={params.deduplicate ?? true}
              onCheckedChange={(v) => updateParams("deduplicate", v)}
            />
          </div>
        </div>
      )}

      {config.actionType === "add_tag" && (
        <div>
          <Label className="font-poppins text-sm">Tag</Label>
          <Input
            className="mt-1.5"
            placeholder="Nome da tag"
            value={params.tag || ""}
            onChange={(e) => updateParams("tag", e.target.value)}
          />
        </div>
      )}

      {config.actionType === "move_stage" && (
        <div className="space-y-3">
          <div>
            <Label className="font-poppins text-sm">Pipeline</Label>
            <Select
              value={params.pipeline_id || ""}
              onValueChange={(v) => {
                const pipeline = pipelines.find(p => p.id === v);
                onChange({
                  ...config,
                  params: { ...params, pipeline_id: v, pipeline: pipeline?.name || "", stage_id: "", stage: "" },
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
          </div>
          <div>
            <Label className="font-poppins text-sm">Etapa de destino</Label>
            <Select
              value={params.stage_id || ""}
              onValueChange={(v) => {
                const stage = stages.find(s => s.id === v);
                updateParams("stage_id", v);
                updateParams("stage", stage?.name || "");
              }}
              disabled={!params.pipeline_id}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={params.pipeline_id ? "Selecione a etapa" : "Selecione o pipeline primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {config.actionType === "assign_owner" && (
        <div>
          <Label className="font-poppins text-sm">Responsável</Label>
          <Select
            value={params.owner_id || "auto"}
            onValueChange={(v) => {
              if (v === "auto") {
                onChange({ ...config, params: { ...params, owner_id: "", owner: "" } });
              } else {
                const member = members.find((m) => m.id === v);
                onChange({ ...config, params: { ...params, owner_id: v, owner: member?.name || "" } });
              }
            }}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Selecione o responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Distribuição automática</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Se escolher distribuição automática, o sistema atribui via round-robin ou fallback.
          </p>
        </div>
      )}

      {config.actionType === "send_whatsapp" && (
        <div>
          <Label className="font-poppins text-sm">Mensagem</Label>
          <Input
            className="mt-1.5"
            placeholder="Texto da mensagem"
            value={params.message || ""}
            onChange={(e) => updateParams("message", e.target.value)}
          />
        </div>
      )}

      {config.actionType === "send_email" && (
        <div className="space-y-3">
          <div>
            <Label className="font-poppins text-sm">Assunto</Label>
            <Input
              className="mt-1.5"
              placeholder="Assunto do e-mail"
              value={params.subject || ""}
              onChange={(e) => updateParams("subject", e.target.value)}
            />
          </div>
          <div>
            <Label className="font-poppins text-sm">Corpo</Label>
            <Input
              className="mt-1.5"
              placeholder="Texto do e-mail"
              value={params.body || ""}
              onChange={(e) => updateParams("body", e.target.value)}
            />
          </div>
        </div>
      )}

      {config.actionType === "send_meta_event" && (
        <div className="space-y-4 border border-border rounded-lg p-3 bg-muted/30">
          <p className="text-[11px] text-muted-foreground font-poppins">
            Envia um evento de conversão para a Meta Conversions API (CAPI).
            Configure o Pixel/Dataset ID e Access Token em Configurações → Meta Ads.
          </p>

          <div>
            <Label className="font-poppins text-sm">Nome do Evento</Label>
            <Select
              value={params.event_definition_id || params.event_name || "Lead"}
              onValueChange={(v) => {
                if (v === "__create__") {
                  setShowCreateEvent(true);
                  return;
                }
                // Check if it's a definition ID
                const def = eventDefs.find((d) => d.id === v);
                if (def) {
                  onChange({
                    ...config,
                    params: {
                      ...params,
                      event_definition_id: def.id,
                      event_name: def.meta_event_name,
                    },
                  });
                } else {
                  // Legacy hardcoded value
                  onChange({
                    ...config,
                    params: {
                      ...params,
                      event_definition_id: undefined,
                      event_name: v,
                    },
                  });
                }
              }}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Lead">Lead</SelectItem>
                <SelectItem value="QualifiedLead">QualifiedLead</SelectItem>
                <SelectItem value="Purchase">Purchase</SelectItem>
                <SelectItem value="Lead_Veio_Loja">Lead_Veio_Loja</SelectItem>
                {eventDefs.map((def) => (
                  <SelectItem key={def.id} value={def.id}>
                    {def.name} ({def.meta_event_name})
                  </SelectItem>
                ))}
                <SelectItem value="__create__">
                  <span className="flex items-center gap-1 text-primary">
                    + Criar novo evento
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showCreateEvent && orgId && (
            <CreateEventDefinitionModal
              open={showCreateEvent}
              onClose={() => setShowCreateEvent(false)}
              organizationId={orgId}
              onCreated={(def) => {
                setEventDefs((prev) => [...prev, def]);
                onChange({
                  ...config,
                  params: {
                    ...params,
                    event_definition_id: def.id,
                    event_name: def.meta_event_name,
                  },
                });
              }}
            />
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-poppins text-sm">Enviar apenas uma vez</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Não reenviar se já existir evento de sucesso para este lead + evento
              </p>
            </div>
            <Switch
              checked={params.send_once ?? true}
              onCheckedChange={(v) => updateParams("send_once", v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-poppins text-sm">Incluir código de teste</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Usa o test_event_code configurado no Meta Ads
              </p>
            </div>
            <Switch
              checked={params.include_test_event_code ?? false}
              onCheckedChange={(v) => updateParams("include_test_event_code", v)}
            />
          </div>

          <div>
            <Label className="font-poppins text-sm">Valor (opcional)</Label>
            <Input
              type="number"
              className="mt-1.5 w-40"
              placeholder="0.00"
              value={params.value || ""}
              onChange={(e) => updateParams("value", e.target.value)}
            />
          </div>

          <div>
            <Label className="font-poppins text-sm">Moeda</Label>
            <Input
              className="mt-1.5 w-32"
              placeholder="BRL"
              value={params.currency || "BRL"}
              onChange={(e) => updateParams("currency", e.target.value)}
            />
          </div>
        </div>
      )}

      {config.actionType === "end_automation" && (
        <p className="text-sm text-muted-foreground font-poppins">
          Este bloco encerra a execução da automação para o lead atual.
        </p>
      )}
    </div>
  );
}
