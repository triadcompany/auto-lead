import React from "react";
import {
  Zap,
  MessageSquare,
  Clock,
  GitBranch,
  GitMerge,
  MessageSquareReply,
  UserCheck,
  Tag,
  MoveRight,
  PenLine,
  BarChart3,
  Webhook,
  Mail,
  XCircle,
  UserPlus,
  Reply,
  MessageCircle,
  Trophy,
  ThumbsDown,
  Globe,
  Timer,
  HeadphonesIcon,
  StickyNote,
  CheckCircle,
} from "lucide-react";

interface BlockItem {
  type: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  config?: Record<string, unknown>;
}

interface BlockCategory {
  category: string;
  accent: string;
  items: BlockItem[];
}

const blocks: BlockCategory[] = [
  {
    category: "Gatilhos",
    accent: "text-amber-500",
    items: [
      {
        type: "trigger",
        label: "Primeira Mensagem",
        desc: "Lead escreve pela 1ª vez",
        icon: MessageCircle,
        color: "text-amber-500 bg-amber-500/10",
        config: { triggerType: "first_message", useKeyword: false, channel: "all" },
      },
      {
        type: "trigger",
        label: "Lead movido no Kanban",
        desc: "Card arrastado para etapa",
        icon: MoveRight,
        color: "text-amber-500 bg-amber-500/10",
        config: { triggerType: "deal_stage_changed" },
      },
      {
        type: "trigger",
        label: "Lead criado",
        desc: "Novo lead entra no CRM",
        icon: UserPlus,
        color: "text-amber-500 bg-amber-500/10",
        config: { triggerType: "lead_created" },
      },
      {
        type: "trigger",
        label: "Tag adicionada",
        desc: "Tag específica aplicada",
        icon: Tag,
        color: "text-amber-500 bg-amber-500/10",
        config: { triggerType: "tag_added", tag: "" },
      },
      {
        type: "trigger",
        label: "Resposta a Campanha",
        desc: "Lead responde a disparo",
        icon: Reply,
        color: "text-amber-500 bg-amber-500/10",
        config: { triggerType: "broadcast_response" },
      },
      {
        type: "trigger",
        label: "Lead ganho",
        desc: "Venda fechada",
        icon: Trophy,
        color: "text-amber-500 bg-amber-500/10",
        config: { triggerType: "lead_won" },
      },
      {
        type: "trigger",
        label: "Lead perdido",
        desc: "Oportunidade perdida",
        icon: ThumbsDown,
        color: "text-amber-500 bg-amber-500/10",
        config: { triggerType: "lead_lost" },
      },
      {
        type: "trigger",
        label: "Lead inativo",
        desc: "Sem atividade por X dias",
        icon: Timer,
        color: "text-amber-500 bg-amber-500/10",
        config: { triggerType: "lead_inactive", inactive_days: 7 },
      },
      {
        type: "trigger",
        label: "Responsável atribuído",
        desc: "Vendedor designado ao lead",
        icon: UserCheck,
        color: "text-amber-500 bg-amber-500/10",
        config: { triggerType: "owner_assigned" },
      },
      {
        type: "trigger",
        label: "Webhook recebido",
        desc: "Chamada de sistema externo",
        icon: Globe,
        color: "text-amber-500 bg-amber-500/10",
        config: { triggerType: "webhook_received" },
      },
    ],
  },
  {
    category: "WhatsApp",
    accent: "text-blue-500",
    items: [
      {
        type: "message",
        label: "Enviar Mensagem",
        desc: "Texto, imagem, áudio, arquivo",
        icon: MessageSquare,
        color: "text-blue-500 bg-blue-500/10",
      },
      {
        type: "wait_for_reply",
        label: "Esperar Resposta",
        desc: "Pausa até o lead responder",
        icon: MessageSquareReply,
        color: "text-cyan-500 bg-cyan-500/10",
      },
      {
        type: "reply_router",
        label: "Rotear por Resposta",
        desc: "N saídas por palavra/botão",
        icon: GitMerge,
        color: "text-violet-500 bg-violet-500/10",
      },
      {
        type: "delay",
        label: "Aguardar",
        desc: "Espera X min / h / dias",
        icon: Clock,
        color: "text-slate-500 bg-slate-500/10",
      },
      {
        type: "action",
        label: "Transferir para Atendente",
        desc: "Encerra bot e atribui a humano",
        icon: HeadphonesIcon,
        color: "text-blue-500 bg-blue-500/10",
        config: { actionType: "transfer_to_agent", params: {} },
      },
    ],
  },
  {
    category: "CRM",
    accent: "text-emerald-500",
    items: [
      {
        type: "action",
        label: "Mover Etapa",
        desc: "Move lead no pipeline",
        icon: MoveRight,
        color: "text-emerald-500 bg-emerald-500/10",
        config: { actionType: "move_stage", params: {} },
      },
      {
        type: "action",
        label: "Adicionar / Remover Tag",
        desc: "Aplica ou remove tag",
        icon: Tag,
        color: "text-emerald-500 bg-emerald-500/10",
        config: { actionType: "add_tag", params: { tag: "" } },
      },
      {
        type: "action",
        label: "Atribuir Responsável",
        desc: "Atribui a vendedor",
        icon: UserCheck,
        color: "text-emerald-500 bg-emerald-500/10",
        config: { actionType: "assign_owner", params: {} },
      },
      {
        type: "action",
        label: "Atualizar Lead",
        desc: "Altera campos do lead",
        icon: PenLine,
        color: "text-emerald-500 bg-emerald-500/10",
        config: { actionType: "update_lead", params: {} },
      },
      {
        type: "action",
        label: "Criar Nota",
        desc: "Registra anotação no histórico",
        icon: StickyNote,
        color: "text-emerald-500 bg-emerald-500/10",
        config: { actionType: "create_note", params: { content: "" } },
      },
      {
        type: "action",
        label: "Marcar como Ganho / Perdido",
        desc: "Fecha o negócio no CRM",
        icon: CheckCircle,
        color: "text-emerald-500 bg-emerald-500/10",
        config: { actionType: "set_lead_status", params: { status: "won" } },
      },
    ],
  },
  {
    category: "Integrações",
    accent: "text-orange-500",
    items: [
      {
        type: "action",
        label: "Meta CAPI",
        desc: "Evento de conversão",
        icon: BarChart3,
        color: "text-orange-500 bg-orange-500/10",
        config: { actionType: "send_meta_event", params: { event_name: "Lead", currency: "BRL" } },
      },
      {
        type: "action",
        label: "Webhook HTTP",
        desc: "POST para sistema externo",
        icon: Webhook,
        color: "text-orange-500 bg-orange-500/10",
        config: { actionType: "webhook", params: { url: "", method: "POST" } },
      },
      {
        type: "action",
        label: "Enviar E-mail",
        desc: "E-mail para lead ou equipe",
        icon: Mail,
        color: "text-orange-500 bg-orange-500/10",
        config: { actionType: "send_email", params: {} },
      },
    ],
  },
  {
    category: "Lógica",
    accent: "text-purple-500",
    items: [
      {
        type: "condition",
        label: "Condição (Se/Então)",
        desc: "Bifurca por critério",
        icon: GitBranch,
        color: "text-purple-500 bg-purple-500/10",
      },
      {
        type: "action",
        label: "Encerrar Automação",
        desc: "Para o fluxo para este lead",
        icon: XCircle,
        color: "text-red-500 bg-red-500/10",
        config: { actionType: "end_automation", params: {} },
      },
    ],
  },
];

export function BlocksSidebar() {
  const onDragStart = (event: React.DragEvent, item: BlockItem) => {
    event.dataTransfer.setData("application/reactflow-type", item.type);
    event.dataTransfer.setData("application/reactflow-label", item.label);
    if (item.config) {
      event.dataTransfer.setData("application/reactflow-config", JSON.stringify(item.config));
    }
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="w-60 border-r border-border bg-card flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-poppins font-semibold text-sm text-foreground">Blocos</h3>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {blocks.map((cat) => (
          <div key={cat.category}>
            <p className={`text-[10px] font-poppins font-bold uppercase tracking-widest mb-2 ${cat.accent}`}>
              {cat.category}
            </p>
            <div className="space-y-1.5">
              {cat.items.map((item, idx) => (
                <div
                  key={`${item.type}-${item.label}-${idx}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, item)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-border bg-background hover:bg-accent cursor-grab active:cursor-grabbing transition-colors group"
                >
                  <div className={`p-1.5 rounded-md flex-shrink-0 ${item.color}`}>
                    <item.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-poppins font-medium leading-tight">{item.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight truncate">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
