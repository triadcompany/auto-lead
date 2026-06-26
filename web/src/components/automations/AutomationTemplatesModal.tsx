import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Clock, Bell, TrendingUp, Shuffle, MessageSquare,
  ListOrdered, RefreshCw, CalendarCheck, Star, Instagram,
  FileCheck, UserCheck, Gift, Radio, Zap,
} from "lucide-react";

interface Template {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  name: string;
  description: string;
  trigger: string;
  steps: string[];
  badge: string;
  badgeColor: string;
  category: string;
}

const TEMPLATES: Template[] = [
  // ── Atendimento ──────────────────────────────────────────────────────────────
  {
    id: "welcome_business_hours",
    icon: Clock,
    iconColor: "text-teal-500",
    iconBg: "bg-teal-500/10",
    name: "Boas-vindas + Horário Comercial",
    description: "Detecta se o lead entrou em contato dentro ou fora do horário e envia a mensagem certa para cada situação.",
    trigger: "Primeira mensagem recebida",
    steps: ["Verificar horário comercial", "Dentro: boas-vindas + menu", "Fora: aviso de retorno"],
    badge: "Atendimento",
    badgeColor: "bg-teal-500/10 text-teal-600",
    category: "Atendimento",
  },
  {
    id: "welcome_sequence",
    icon: ListOrdered,
    iconColor: "text-cyan-500",
    iconBg: "bg-cyan-500/10",
    name: "Sequência de boas-vindas em 3 etapas",
    description: "Envia três mensagens progressivas: boas-vindas imediata, menu após 5 minutos e mensagem de engajamento após 1 hora.",
    trigger: "Primeira mensagem recebida",
    steps: ["Boas-vindas imediata", "Aguardar 5 min → menu de opções", "Aguardar 1h → engajamento"],
    badge: "Atendimento",
    badgeColor: "bg-teal-500/10 text-teal-600",
    category: "Atendimento",
  },
  {
    id: "qualification_flow",
    icon: UserCheck,
    iconColor: "text-violet-500",
    iconBg: "bg-violet-500/10",
    name: "Qualificação automática",
    description: "Envia perguntas de qualificação no primeiro contato, aguarda a resposta e encaminha para o vendedor certo.",
    trigger: "Primeira mensagem recebida",
    steps: ["Verificar horário", "Perguntas de qualificação", "Aguardar 30 min", "Atribuir responsável + notificar"],
    badge: "Atendimento",
    badgeColor: "bg-teal-500/10 text-teal-600",
    category: "Atendimento",
  },
  {
    id: "instagram_welcome",
    icon: Instagram,
    iconColor: "text-pink-500",
    iconBg: "bg-pink-500/10",
    name: "Lead do Instagram → Atendimento",
    description: "Quando um lead chega pelo Instagram, envia boas-vindas personalizadas, atribui responsável e notifica a equipe.",
    trigger: "Lead via Instagram",
    steps: ["Mensagem de boas-vindas Instagram", "Atribuir responsável", "Tag: instagram", "Notificar admins"],
    badge: "Atendimento",
    badgeColor: "bg-teal-500/10 text-teal-600",
    category: "Atendimento",
  },
  {
    id: "campaign_response",
    icon: Radio,
    iconColor: "text-indigo-500",
    iconBg: "bg-indigo-500/10",
    name: "Resposta a campanha → Atendente",
    description: "Quando um lead responde a um disparo, verifica o horário, envia mensagem de oferta e transfere para atendimento humano.",
    trigger: "Resposta a campanha",
    steps: ["Verificar horário comercial", "Mensagem de oferta", "Transferir para atendente"],
    badge: "Atendimento",
    badgeColor: "bg-teal-500/10 text-teal-600",
    category: "Atendimento",
  },

  // ── Follow-up ────────────────────────────────────────────────────────────────
  {
    id: "followup_24h",
    icon: MessageSquare,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
    name: "Follow-up 24h após contato",
    description: "Envia boas-vindas e, após 24 horas sem resposta, faz acompanhamento automático para reengajar o lead.",
    trigger: "Primeira mensagem recebida",
    steps: ["Enviar boas-vindas", "Aguardar 24h", "Verificar horário", "Lembrete ou mover etapa"],
    badge: "Follow-up",
    badgeColor: "bg-blue-500/10 text-blue-600",
    category: "Follow-up",
  },
  {
    id: "reactivate_cold",
    icon: RefreshCw,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
    name: "Reativar lead frio",
    description: "Sequência de reativação para leads que pararam de responder: duas tentativas com 3 dias de intervalo, depois marca como perdido.",
    trigger: "Tag adicionada (lead-frio)",
    steps: ["Verificar horário", "1ª tentativa de reativação", "Aguardar 3 dias", "Última tentativa → marcar como perdido"],
    badge: "Follow-up",
    badgeColor: "bg-blue-500/10 text-blue-600",
    category: "Follow-up",
  },
  {
    id: "proposal_followup",
    icon: FileCheck,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-500/10",
    name: "Follow-up de proposta enviada",
    description: "Após o lead entrar na etapa de proposta, aguarda 48h e faz acompanhamento. Sem resposta em 3 dias, envia mensagem de urgência.",
    trigger: "Lead movido no Kanban",
    steps: ["Aguardar 48h", "Verificar horário", "Follow-up da proposta", "Aguardar 3 dias → urgência"],
    badge: "Follow-up",
    badgeColor: "bg-blue-500/10 text-blue-600",
    category: "Follow-up",
  },
  {
    id: "meeting_reminder",
    icon: CalendarCheck,
    iconColor: "text-green-500",
    iconBg: "bg-green-500/10",
    name: "Confirmação + lembrete de reunião",
    description: "Quando a tag 'reuniao-agendada' é adicionada, confirma o agendamento e envia lembrete automático na véspera.",
    trigger: "Tag adicionada (reuniao-agendada)",
    steps: ["Mensagem de confirmação", "Aguardar 23 horas", "Lembrete na véspera", "Criar nota"],
    badge: "Follow-up",
    badgeColor: "bg-blue-500/10 text-blue-600",
    category: "Follow-up",
  },

  // ── Vendas ───────────────────────────────────────────────────────────────────
  {
    id: "notify_new_lead",
    icon: Bell,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
    name: "Novo lead → Notificar equipe",
    description: "Assim que um lead é criado, atribui ao responsável e envia notificação pelo WhatsApp para os admins.",
    trigger: "Lead criado",
    steps: ["Atribuir responsável", "Notificar admins via WhatsApp", "Boas-vindas ao lead"],
    badge: "Gestão",
    badgeColor: "bg-orange-500/10 text-orange-600",
    category: "Vendas",
  },
  {
    id: "deal_won_capi",
    icon: TrendingUp,
    iconColor: "text-green-500",
    iconBg: "bg-green-500/10",
    name: "Venda Fechada → Meta CAPI",
    description: "Quando um lead é movido para 'Ganho' no Kanban, dispara Purchase no Meta CAPI e envia mensagem de parabéns.",
    trigger: "Lead movido no Kanban",
    steps: ["Evento Purchase no Meta CAPI", "Mensagem de parabéns", "Criar nota", "Marcar como Ganho"],
    badge: "Vendas + CAPI",
    badgeColor: "bg-green-500/10 text-green-600",
    category: "Vendas",
  },
  {
    id: "post_sale_nps",
    icon: Star,
    iconColor: "text-yellow-500",
    iconBg: "bg-yellow-500/10",
    name: "NPS e satisfação pós-venda",
    description: "Três dias após a venda, envia pesquisa de satisfação (0 a 10) e registra o feedback no histórico do lead.",
    trigger: "Lead movido no Kanban",
    steps: ["Aguardar 3 dias", "Verificar horário", "Pesquisa NPS (0–10)", "Criar nota com resultado"],
    badge: "Vendas",
    badgeColor: "bg-green-500/10 text-green-600",
    category: "Vendas",
  },
  {
    id: "client_onboarding",
    icon: Gift,
    iconColor: "text-purple-500",
    iconBg: "bg-purple-500/10",
    name: "Onboarding de novo cliente",
    description: "Após o fechamento, conduz o cliente por uma jornada de onboarding com mensagens progressivas ao longo de 8 dias.",
    trigger: "Lead movido no Kanban",
    steps: ["Boas-vindas imediata", "Aguardar 1 dia → dicas de uso", "Aguardar 7 dias → check-in", "Criar nota de conclusão"],
    badge: "Vendas",
    badgeColor: "bg-green-500/10 text-green-600",
    category: "Vendas",
  },

  // ── Testes A/B ───────────────────────────────────────────────────────────────
  {
    id: "ab_test_welcome",
    icon: Shuffle,
    iconColor: "text-pink-500",
    iconBg: "bg-pink-500/10",
    name: "A/B Test – Mensagem de boas-vindas",
    description: "Divide os novos contatos em dois grupos para testar versões diferentes de boas-vindas e descobrir qual converte melhor.",
    trigger: "Primeira mensagem recebida",
    steps: ["Dividir 50% A / 50% B", "Grupo A: mensagem direta", "Grupo B: mensagem curiosa", "Tag automática p/ rastrear"],
    badge: "Teste A/B",
    badgeColor: "bg-pink-500/10 text-pink-600",
    category: "Teste A/B",
  },
  {
    id: "urgency_vs_value",
    icon: Zap,
    iconColor: "text-rose-500",
    iconBg: "bg-rose-500/10",
    name: "A/B Test – Urgência vs. Valor",
    description: "Testa urgência (prazo/escassez) contra proposta de valor. Rastreia com tags e atribui responsável após 2 dias.",
    trigger: "Lead criado",
    steps: ["Dividir 50% A / 50% B", "A: mensagem com urgência + prazo", "B: mensagem com proposta de valor", "Tag + aguardar 2 dias → atribuir"],
    badge: "Teste A/B",
    badgeColor: "bg-pink-500/10 text-pink-600",
    category: "Teste A/B",
  },
];

const CATEGORIES = ["Todos", "Atendimento", "Follow-up", "Vendas", "Teste A/B"];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (templateId: string) => Promise<void>;
}

export function AutomationTemplatesModal({ open, onClose, onCreate }: Props) {
  const [creating, setCreating] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("Todos");

  const filtered = activeCategory === "Todos"
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === activeCategory);

  const handleCreate = async (templateId: string) => {
    setCreating(templateId);
    try {
      await onCreate(templateId);
      onClose();
    } finally {
      setCreating(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-poppins text-xl">Templates de Automação</DialogTitle>
          <p className="text-sm text-muted-foreground font-poppins">
            {TEMPLATES.length} templates prontos para começar. Personalize depois.
          </p>
        </DialogHeader>

        {/* Filtro por categoria */}
        <div className="flex gap-2 flex-wrap shrink-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-poppins font-medium transition-colors border ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {cat}
              {cat !== "Todos" && (
                <span className="ml-1.5 opacity-60">
                  {TEMPLATES.filter((t) => t.category === cat).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 space-y-3 pr-1 -mr-1">
          {filtered.map((tpl) => {
            const Icon = tpl.icon;
            const isLoading = creating === tpl.id;
            return (
              <div
                key={tpl.id}
                className="flex gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors"
              >
                <div className={`shrink-0 p-3 rounded-xl ${tpl.iconBg} h-fit mt-0.5`}>
                  <Icon className={`h-5 w-5 ${tpl.iconColor}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-poppins font-semibold text-sm text-foreground">{tpl.name}</span>
                    <Badge className={`text-xs font-poppins ${tpl.badgeColor} border-0`}>{tpl.badge}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-poppins mb-2 leading-relaxed">{tpl.description}</p>
                  <div className="text-xs text-muted-foreground font-poppins mb-2">
                    <span className="font-medium text-foreground">Gatilho:</span> {tpl.trigger}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tpl.steps.map((step, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full font-poppins text-muted-foreground"
                      >
                        <span className="text-[10px] font-bold text-foreground/50">{i + 1}</span>
                        {step}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 self-center">
                  <Button
                    size="sm"
                    className="btn-gradient text-white font-poppins whitespace-nowrap"
                    disabled={!!creating}
                    onClick={() => handleCreate(tpl.id)}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Usar"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
