import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, Bell, TrendingUp, Shuffle, MessageSquare } from "lucide-react";

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
}

const TEMPLATES: Template[] = [
  {
    id: "welcome_business_hours",
    icon: Clock,
    iconColor: "text-teal-500",
    iconBg: "bg-teal-500/10",
    name: "Boas-vindas + Horário Comercial",
    description: "Detecta automaticamente se o lead entrou em contato dentro ou fora do horário e envia a mensagem certa para cada situação.",
    trigger: "Primeira mensagem recebida",
    steps: ["Verificar horário comercial", "Dentro: boas-vindas + menu de opções", "Fora: aviso com horário de retorno"],
    badge: "Atendimento",
    badgeColor: "bg-teal-500/10 text-teal-600",
  },
  {
    id: "followup_24h",
    icon: MessageSquare,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
    name: "Follow-up 24h após contato",
    description: "Envia uma mensagem inicial e, após 24 horas sem resposta, faz um acompanhamento automático para reengajar o lead.",
    trigger: "Primeira mensagem recebida",
    steps: ["Enviar boas-vindas", "Aguardar 24 horas", "Verificar horário comercial", "Enviar lembrete ou mover etapa"],
    badge: "Follow-up",
    badgeColor: "bg-blue-500/10 text-blue-600",
  },
  {
    id: "notify_new_lead",
    icon: Bell,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
    name: "Novo lead → Notificar equipe",
    description: "Assim que um lead é criado, atribui automaticamente ao responsável e envia notificação pelo WhatsApp para os admins.",
    trigger: "Lead criado",
    steps: ["Atribuir responsável (round-robin)", "Notificar admins via WhatsApp", "Enviar boas-vindas ao lead"],
    badge: "Gestão",
    badgeColor: "bg-orange-500/10 text-orange-600",
  },
  {
    id: "deal_won_capi",
    icon: TrendingUp,
    iconColor: "text-green-500",
    iconBg: "bg-green-500/10",
    name: "Venda Fechada → Meta CAPI",
    description: "Quando um lead é movido para 'Ganho' no Kanban, dispara automaticamente o evento de Purchase no Meta CAPI e envia mensagem de parabéns.",
    trigger: "Lead movido no Kanban",
    steps: ["Disparar evento Purchase no Meta CAPI", "Enviar mensagem de parabéns", "Criar nota no histórico", "Marcar lead como Ganho"],
    badge: "Vendas + CAPI",
    badgeColor: "bg-green-500/10 text-green-600",
  },
  {
    id: "ab_test_welcome",
    icon: Shuffle,
    iconColor: "text-pink-500",
    iconBg: "bg-pink-500/10",
    name: "A/B Test – Mensagem de boas-vindas",
    description: "Divide os novos contatos em dois grupos e envia versões diferentes de boas-vindas para descobrir qual converte melhor.",
    trigger: "Primeira mensagem recebida",
    steps: ["Dividir 50% → Grupo A / 50% → Grupo B", "Grupo A: mensagem direta e objetiva", "Grupo B: mensagem curiosa e aberta", "Tag automática para rastrear resultados"],
    badge: "Teste A/B",
    badgeColor: "bg-pink-500/10 text-pink-600",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (templateId: string) => Promise<void>;
}

export function AutomationTemplatesModal({ open, onClose, onCreate }: Props) {
  const [creating, setCreating] = useState<string | null>(null);

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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-poppins text-xl">Templates de Automação</DialogTitle>
          <p className="text-sm text-muted-foreground font-poppins">
            Escolha um template pronto para começar. Você poderá personalizar depois.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 mt-2">
          {TEMPLATES.map((tpl) => {
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

                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-xs text-muted-foreground font-poppins">
                      <span className="font-medium text-foreground">Gatilho:</span> {tpl.trigger}
                    </div>
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
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Usar template"}
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
