import React, { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { CreateEventDefinitionModal } from "./CreateEventDefinitionModal";

interface ActionEditorProps {
  config: any;
  onChange: (config: any) => void;
}

const actionTypes = [
  { value: "add_tag", label: "Adicionar tag" },
  { value: "move_stage", label: "Mover etapa" },
  { value: "transfer_to_agent", label: "Transferir para atendente" },
  { value: "create_note", label: "Criar nota" },
  { value: "set_lead_status", label: "Marcar como ganho / perdido" },
  { value: "internal_notification", label: "Notificação interna" },
  { value: "send_whatsapp", label: "Enviar WhatsApp" },
  { value: "send_email", label: "Enviar e-mail" },
  { value: "update_lead", label: "Atualizar lead" },
  { value: "create_deal", label: "Criar negócio" },
  { value: "send_meta_event", label: "📊 Enviar para Meta" },
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
  const api = useApi();

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [eventDefs, setEventDefs] = useState<{ id: string; name: string; meta_event_name: string }[]>([]);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  // Fetch pipelines, sources and members once
  useEffect(() => {
    if (!orgId) return;

    const fetchData = async () => {
      const [pipelines, sources, members, eventDefs] = await Promise.all([
        api.pipelines.list(),
        api.leadSources.list(),
        api.users.list(),
        api.automations.eventDefinitions().catch(() => []),
      ]);
      setPipelines(pipelines || []);
      setSources(sources || []);
      setMembers((members || []).map((m: any) => ({
        id: m.id || m.user_id,
        name: m.name || m.full_name || m.clerk_user_id,
        role: m.role || "seller",
      })));
      setEventDefs((eventDefs || []).map((d: any) => ({ id: d.id, name: d.name, meta_event_name: d.metaEventName || d.meta_event_name })));
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
      const data = await api.pipelines.stages(params.pipeline_id);
      if (data) setStages(data as Stage[]);
    };
    fetchStages();
  }, [params.pipeline_id]);

  const updateParams = (key: string, value: string | boolean | string[]) => {
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

          {/* Participantes do rodízio (só aparece quando é distribuição automática) */}
          {!params.owner_id && (
            <div>
              <Label className="font-poppins text-sm">Quem participa do rodízio</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5 mb-2">
                Selecione quem deve receber leads nesta distribuição automática (admins não entram por padrão — marque aqui se quiser incluir). Deixe tudo desmarcado para usar todos os vendedores.
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto border border-border rounded-md p-2 bg-background/50">
                {members.length === 0 && (
                  <p className="text-xs text-muted-foreground">Carregando membros...</p>
                )}
                {members.map((m) => {
                  const selected: string[] = params.distribution_user_ids || [];
                  const checked = selected.includes(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const next = v
                            ? [...selected, m.id]
                            : selected.filter((id) => id !== m.id);
                          updateParams("distribution_user_ids", next);
                        }}
                      />
                      <span>{m.name}</span>
                      {m.role === "admin" && (
                        <span className="text-[10px] text-muted-foreground">(admin)</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

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

      {config.actionType === "transfer_to_agent" && (
        <div className="space-y-4 border border-border rounded-lg p-3 bg-muted/30">
          <p className="text-[11px] text-muted-foreground font-poppins">
            Encerra o bot e entrega a conversa a um atendente humano. A automação é finalizada imediatamente após a transferência.
          </p>

          <div>
            <Label className="font-poppins text-sm">Atendente</Label>
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
                <SelectValue placeholder="Selecione o atendente" />
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
              Se automático, atribui ao primeiro disponível por round-robin.
            </p>
          </div>

          <div>
            <Label className="font-poppins text-sm">Mensagem de transição (opcional)</Label>
            <Textarea
              className="mt-1.5 min-h-[80px] text-sm font-poppins"
              placeholder="Ex: Vou passar você para um de nossos atendentes. Em breve entrarão em contato!"
              value={params.transfer_message || ""}
              onChange={(e) => updateParams("transfer_message", e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Enviada via WhatsApp antes de encerrar o bot.
            </p>
          </div>
        </div>
      )}

      {config.actionType === "create_note" && (
        <div>
          <Label className="font-poppins text-sm">Conteúdo da nota</Label>
          <Textarea
            className="mt-1.5 min-h-[100px] text-sm font-poppins"
            placeholder="Ex: Lead qualificado pela automação. Interesse em produto X."
            value={params.content || ""}
            onChange={(e) => updateParams("content", e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Variáveis disponíveis: {"{{lead.name}}"}, {"{{lead.phone}}"}, {"{{org.name}}"}
          </p>
        </div>
      )}

      {config.actionType === "set_lead_status" && (
        <div>
          <Label className="font-poppins text-sm">Status</Label>
          <Select
            value={params.status || "won"}
            onValueChange={(v) => updateParams("status", v)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="won">Ganho</SelectItem>
              <SelectItem value="lost">Perdido</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Fecha o negócio no CRM. Não dispara automações adicionais.
          </p>
        </div>
      )}

      {config.actionType === "internal_notification" && (
        <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/30">
          <p className="text-[11px] text-muted-foreground font-poppins">
            Envia uma mensagem WhatsApp para o celular cadastrado do membro da equipe selecionado.
          </p>
          <div>
            <Label className="font-poppins text-sm">Membro da equipe</Label>
            <Select
              value={params.member_id || "all"}
              onValueChange={(v) => updateParams("member_id", v === "all" ? "" : v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecione o membro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os admins</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-poppins text-sm">Mensagem</Label>
            <Textarea
              className="mt-1.5 min-h-[80px] text-sm font-poppins"
              placeholder="Ex: Lead {{lead.name}} respondeu e está aguardando atendimento."
              value={params.message || ""}
              onChange={(e) => updateParams("message", e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Variáveis: {"{{lead.name}}"}, {"{{lead.phone}}"}, {"{{org.name}}"}
            </p>
          </div>
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
            Envia um evento de conversão para a Meta Conversions API .
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
