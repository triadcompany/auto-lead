import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Zap, MessageSquare, Clock, GitBranch, GitMerge, Cog, MessageSquareReply,
  UserCheck, Tag, MoveRight, PenLine, BarChart3, Webhook, Mail, XCircle, UserPlus,
  Reply, MessageCircle, Trophy, ThumbsDown, Globe, Timer, HeadphonesIcon, StickyNote,
  CheckCircle, BellRing, Shuffle, Image, Mic, Video, FileText, Type,
} from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface BlockDoc {
  type: string;
  label: string;
  icon: React.ElementType;
  color: string;
  tagColor: string;
  summary: string;
  options: { name: string; desc: string }[];
  tips: string[];
}

interface CategoryDoc {
  id: string;
  label: string;
  accent: string;
  blocks: BlockDoc[];
}

interface ExampleFlow {
  title: string;
  description: string;
  nodes: { label: string; icon: React.ElementType; color: string; detail?: string }[];
}

// ── Dados ─────────────────────────────────────────────────────────────────────

const CATEGORIES: CategoryDoc[] = [
  {
    id: "gatilhos",
    label: "Gatilhos",
    accent: "text-amber-500",
    blocks: [
      {
        type: "trigger", label: "Primeira Mensagem", icon: MessageCircle,
        color: "text-amber-500", tagColor: "bg-amber-500/10 text-amber-500 border-amber-500/30",
        summary: "Dispara quando um contato envia uma mensagem pela primeira vez. Ideal para bots de boas-vindas e qualificação automática.",
        options: [
          { name: "Canal", desc: "WhatsApp, Instagram ou todos." },
          { name: "Palavra-chave", desc: "Filtrar por palavra específica na primeira mensagem (ex: só disparar se escrever 'oi')." },
        ],
        tips: ["Use para enviar menu de opções imediatamente após o primeiro contato.", "Combine com 'Rotear por Resposta' para criar um bot completo."],
      },
      {
        type: "trigger", label: "Lead movido no Kanban", icon: MoveRight,
        color: "text-amber-500", tagColor: "bg-amber-500/10 text-amber-500 border-amber-500/30",
        summary: "Dispara sempre que um lead é arrastado para uma etapa específica do pipeline.",
        options: [
          { name: "Etapa de destino", desc: "Define em qual etapa o gatilho será ativado." },
          { name: "Pipeline", desc: "Restringe a um pipeline específico." },
        ],
        tips: ["Use para enviar uma proposta automaticamente quando o lead chega em 'Proposta enviada'.", "Combine com Meta CAPI para registrar o evento de conversão na etapa 'Ganho'."],
      },
      {
        type: "trigger", label: "Lead criado", icon: UserPlus,
        color: "text-amber-500", tagColor: "bg-amber-500/10 text-amber-500 border-amber-500/30",
        summary: "Dispara quando um novo lead é cadastrado no CRM, seja manualmente, via formulário ou importação.",
        options: [
          { name: "Origem", desc: "Filtrar por origem do lead (WhatsApp, Formulário, Importação, etc.)." },
        ],
        tips: ["Ideal para enviar mensagem de boas-vindas assim que o lead entra.", "Use para atribuir automaticamente um responsável e mover para a etapa inicial."],
      },
      {
        type: "trigger", label: "Tag adicionada", icon: Tag,
        color: "text-amber-500", tagColor: "bg-amber-500/10 text-amber-500 border-amber-500/30",
        summary: "Dispara quando uma tag específica é aplicada a um lead. Permite criar fluxos baseados em segmentação.",
        options: [
          { name: "Tag", desc: "Nome exato da tag que ativa o gatilho." },
        ],
        tips: ["Use a tag como sinal de qualificação: quando vendedor adiciona 'qualificado', dispara sequência de follow-up.", "Combine com Horário Comercial para enviar apenas em horário útil."],
      },
      {
        type: "trigger", label: "Resposta a Campanha", icon: Reply,
        color: "text-amber-500", tagColor: "bg-amber-500/10 text-amber-500 border-amber-500/30",
        summary: "Dispara quando um lead responde a uma mensagem de campanha (disparo em massa).",
        options: [
          { name: "Campanha específica", desc: "Filtrar por uma campanha em particular ou qualquer campanha." },
        ],
        tips: ["Use para dar continuidade ao interesse: 'Você respondeu nosso disparo, quer saber mais?'", "Combine com 'Rotear por Resposta' para qualificar automaticamente."],
      },
      {
        type: "trigger", label: "Lead ganho", icon: Trophy,
        color: "text-amber-500", tagColor: "bg-amber-500/10 text-amber-500 border-amber-500/30",
        summary: "Dispara quando o status do lead é marcado como 'Ganho' no CRM.",
        options: [],
        tips: ["Use para enviar mensagem de agradecimento e onboarding automaticamente.", "Dispare evento de conversão para o Meta CAPI para otimização de anúncios."],
      },
      {
        type: "trigger", label: "Lead perdido", icon: ThumbsDown,
        color: "text-amber-500", tagColor: "bg-amber-500/10 text-amber-500 border-amber-500/30",
        summary: "Dispara quando o status do lead é marcado como 'Perdido'.",
        options: [],
        tips: ["Use para enviar uma oferta de última chance ou pesquisa de motivo da perda.", "Agende um follow-up futuro com 'Aguardar' (ex: em 30 dias, tente reativar)."],
      },
      {
        type: "trigger", label: "Lead inativo", icon: Timer,
        color: "text-amber-500", tagColor: "bg-amber-500/10 text-amber-500 border-amber-500/30",
        summary: "Dispara quando um lead fica sem enviar mensagens por X dias. Detecta abandono e permite reativação automática.",
        options: [
          { name: "Dias de inatividade", desc: "Quantidade de dias sem mensagem para considerar inativo (ex: 3, 7, 14 dias)." },
        ],
        tips: ["Use para follow-up automático: 'Oi, posso te ajudar com algo?'", "Configure 2 automações: uma para 3 dias (soft) e outra para 7 dias (mais direta)."],
      },
      {
        type: "trigger", label: "Responsável atribuído", icon: UserCheck,
        color: "text-amber-500", tagColor: "bg-amber-500/10 text-amber-500 border-amber-500/30",
        summary: "Dispara quando um vendedor é atribuído a um lead.",
        options: [
          { name: "Vendedor específico", desc: "Filtrar para disparar apenas quando atribuído a um vendedor em particular." },
        ],
        tips: ["Use para notificar o vendedor via WhatsApp quando receber um lead.", "Envie apresentação automática do vendedor para o cliente."],
      },
      {
        type: "trigger", label: "Webhook recebido", icon: Globe,
        color: "text-amber-500", tagColor: "bg-amber-500/10 text-amber-500 border-amber-500/30",
        summary: "Dispara quando um sistema externo faz uma chamada HTTP POST para a URL específica da automação. Permite integrar com qualquer plataforma.",
        options: [
          { name: "URL do webhook", desc: "URL gerada automaticamente, no formato /automations/webhook/:id. Copie e configure no sistema externo." },
        ],
        tips: ["Use com n8n, Zapier, Make ou qualquer sistema com suporte a webhooks.", "Útil para disparar automações a partir de eventos em e-commerce, formulários externos, etc."],
      },
    ],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    accent: "text-blue-500",
    blocks: [
      {
        type: "message", label: "Enviar Mensagem", icon: MessageSquare,
        color: "text-blue-500", tagColor: "bg-blue-500/10 text-blue-500 border-blue-500/30",
        summary: "Envia uma mensagem para o lead. Suporta texto, imagem, áudio, vídeo e documento.",
        options: [
          { name: "Tipo: Texto", desc: "Mensagem de texto com suporte a variáveis ({{lead.name}}, {{lead.phone}}, etc.) e botões de resposta rápida." },
          { name: "Tipo: Imagem", desc: "Envie uma imagem via URL com legenda opcional." },
          { name: "Tipo: Áudio", desc: "Envie um arquivo de áudio. Opção de enviar como 'nota de voz' (aparece como gravação no WhatsApp)." },
          { name: "Tipo: Vídeo", desc: "Envie um vídeo via URL com legenda opcional." },
          { name: "Tipo: Documento", desc: "Envie um PDF, planilha ou outro arquivo com nome e legenda." },
          { name: "Botões", desc: "Adicione até 3 botões de resposta rápida para o lead clicar (ex: Sim / Não / Mais informações)." },
          { name: "Variáveis", desc: "{{lead.name}}, {{lead.phone}}, {{lead.email}}, {{lead.source}}, {{org.name}}" },
        ],
        tips: ["Use variáveis para personalizar: 'Oi {{lead.name}}, tudo bem?'", "Botões de resposta funcionam melhor com o bloco 'Rotear por Resposta' logo depois."],
      },
      {
        type: "wait_for_reply", label: "Esperar Resposta", icon: MessageSquareReply,
        color: "text-cyan-500", tagColor: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
        summary: "Pausa o fluxo até o lead enviar qualquer mensagem. Depois que responde, o fluxo continua.",
        options: [
          { name: "Timeout", desc: "Tempo máximo de espera (ex: 24 horas). Após esse tempo, o fluxo continua mesmo sem resposta." },
        ],
        tips: ["Use após uma pergunta para aguardar a resposta antes de continuar.", "Combine com 'Rotear por Resposta' para criar fluxos inteligentes baseados no que o lead digitou."],
      },
      {
        type: "reply_router", label: "Rotear por Resposta", icon: GitMerge,
        color: "text-violet-500", tagColor: "bg-violet-500/10 text-violet-500 border-violet-500/30",
        summary: "Cria múltiplos caminhos baseados na resposta do lead. Cada caminho representa palavras-chave ou botões específicos.",
        options: [
          { name: "Saídas", desc: "Cada saída tem palavras-chave associadas. Se a mensagem do lead contiver a palavra, segue por aquela saída." },
          { name: "Saída padrão", desc: "Caminho seguido quando nenhuma palavra-chave é reconhecida." },
          { name: "Timeout", desc: "Se o lead não responder no tempo definido, segue pela saída padrão." },
        ],
        tips: ["Configure palavras-chave simples: 'sim', 's', 'quero', 'aceito' para uma saída positiva.", "Sempre configure uma saída padrão para mensagens inesperadas."],
      },
      {
        type: "delay", label: "Aguardar", icon: Clock,
        color: "text-slate-500", tagColor: "bg-slate-500/10 text-slate-400 border-slate-500/30",
        summary: "Pausa o fluxo por um tempo determinado antes de continuar para o próximo bloco.",
        options: [
          { name: "Duração", desc: "Minutos, horas ou dias." },
        ],
        tips: ["Use entre mensagens para não parecer spam (ex: aguardar 2 minutos entre mensagens).", "Use para agendar follow-ups: 'Aguardar 3 dias → Enviar mensagem de acompanhamento'."],
      },
      {
        type: "action", label: "Transferir para Atendente", icon: HeadphonesIcon,
        color: "text-blue-500", tagColor: "bg-blue-500/10 text-blue-500 border-blue-500/30",
        summary: "Encerra o bot e entrega a conversa a um atendente humano. O fluxo é finalizado e o lead fica disponível para atendimento manual.",
        options: [
          { name: "Atendente", desc: "Selecione um vendedor específico ou 'Distribuição automática' para round-robin." },
          { name: "Mensagem de transição", desc: "Texto enviado via WhatsApp antes de encerrar o bot (ex: 'Vou conectar você com um especialista!')." },
        ],
        tips: ["Sempre envie uma mensagem de transição para o lead não ficar sem resposta.", "Use 'Distribuição automática' para balancear a carga entre a equipe."],
      },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    accent: "text-emerald-500",
    blocks: [
      {
        type: "action", label: "Mover Etapa", icon: MoveRight,
        color: "text-emerald-500", tagColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
        summary: "Move o lead para outra etapa do pipeline automaticamente.",
        options: [
          { name: "Pipeline", desc: "Selecione o pipeline de destino." },
          { name: "Etapa", desc: "Etapa específica para onde o lead será movido." },
        ],
        tips: ["Use após qualificação para mover automaticamente leads interessados.", "Combine com Meta CAPI para registrar eventos de conversão em cada etapa."],
      },
      {
        type: "action", label: "Adicionar / Remover Tag", icon: Tag,
        color: "text-emerald-500", tagColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
        summary: "Aplica ou remove uma tag no lead para segmentação e organização.",
        options: [
          { name: "Ação", desc: "Adicionar ou remover." },
          { name: "Tag", desc: "Nome da tag a ser aplicada ou removida." },
        ],
        tips: ["Use tags como sinais de qualificação: 'interessado', 'quente', 'nao-respondeu'.", "Tags podem ser usadas como gatilho em outras automações."],
      },
      {
        type: "action", label: "Atribuir Responsável", icon: UserCheck,
        color: "text-emerald-500", tagColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
        summary: "Atribui o lead a um vendedor da equipe.",
        options: [
          { name: "Responsável", desc: "Vendedor específico ou distribuição automática por round-robin." },
        ],
        tips: ["Use no início do fluxo para garantir que todo lead tenha um responsável.", "Combine com 'Notificação Interna' para avisar o vendedor."],
      },
      {
        type: "action", label: "Atualizar Lead", icon: PenLine,
        color: "text-emerald-500", tagColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
        summary: "Atualiza campos do lead como nome, e-mail, interesse ou valor do negócio.",
        options: [
          { name: "Campos", desc: "Nome, e-mail, interesse, observações, valor do negócio. Suporta variáveis." },
        ],
        tips: ["Use para enriquecer o perfil do lead com informações coletadas pelo bot.", "Ex: o bot pergunta o e-mail → 'Atualizar Lead' salva a resposta no campo e-mail."],
      },
      {
        type: "action", label: "Criar Nota", icon: StickyNote,
        color: "text-emerald-500", tagColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
        summary: "Registra uma anotação no histórico da conversa do lead. Visível no inbox para toda a equipe.",
        options: [
          { name: "Conteúdo", desc: "Texto da nota. Suporta variáveis ({{lead.name}}, etc.)." },
        ],
        tips: ["Use para registrar automaticamente que o lead foi qualificado ou que passou por determinado fluxo.", "Ideal para rastreabilidade: 'Lead respondeu campanha X em {{data}}'."],
      },
      {
        type: "action", label: "Marcar como Ganho / Perdido", icon: CheckCircle,
        color: "text-emerald-500", tagColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
        summary: "Fecha o negócio diretamente via automação, marcando como Ganho ou Perdido.",
        options: [
          { name: "Status", desc: "Ganho ou Perdido." },
        ],
        tips: ["Use após confirmação de compra para fechar automaticamente o negócio.", "Combine com Meta CAPI para registrar a conversão quando marcar como Ganho."],
      },
    ],
  },
  {
    id: "integracoes",
    label: "Integrações",
    accent: "text-orange-500",
    blocks: [
      {
        type: "action", label: "Meta CAPI", icon: BarChart3,
        color: "text-orange-500", tagColor: "bg-orange-500/10 text-orange-500 border-orange-500/30",
        summary: "Envia um evento de conversão diretamente para a Meta Conversions API , otimizando campanhas de anúncios no Facebook e Instagram.",
        options: [
          { name: "Evento", desc: "Nome do evento Meta: Lead, Purchase, InitiateCheckout, CompleteRegistration, etc." },
          { name: "Valor", desc: "Valor monetário da conversão em Reais (opcional)." },
          { name: "Moeda", desc: "BRL por padrão." },
        ],
        tips: ["Configure o Pixel/Dataset ID em Configurações → Meta Ads antes de usar.", "Dispare 'Lead' quando o lead entrar, e 'Purchase' quando marcar como Ganho."],
      },
      {
        type: "action", label: "Webhook HTTP", icon: Webhook,
        color: "text-orange-500", tagColor: "bg-orange-500/10 text-orange-500 border-orange-500/30",
        summary: "Faz uma requisição HTTP POST para qualquer URL externa, enviando dados do lead. Integra com n8n, Zapier, Google Sheets e outros.",
        options: [
          { name: "URL", desc: "Endpoint que receberá os dados." },
          { name: "Método", desc: "POST (padrão) ou GET." },
          { name: "Headers", desc: "Cabeçalhos HTTP adicionais (ex: Authorization)." },
          { name: "Body", desc: "Dados enviados no corpo da requisição." },
        ],
        tips: ["Use para adicionar lead em uma planilha Google via n8n.", "Use para criar contato no seu sistema de e-mail marketing."],
      },
      {
        type: "action", label: "Enviar E-mail", icon: Mail,
        color: "text-orange-500", tagColor: "bg-orange-500/10 text-orange-500 border-orange-500/30",
        summary: "Envia um e-mail para o lead ou para a equipe.",
        options: [
          { name: "Destinatário", desc: "E-mail do lead ({{lead.email}}) ou endereço fixo." },
          { name: "Assunto", desc: "Assunto do e-mail. Suporta variáveis." },
          { name: "Corpo", desc: "Texto do e-mail. Suporta variáveis." },
        ],
        tips: ["Configure o provedor de e-mail em Configurações antes de usar.", "Use para enviar proposta por e-mail automaticamente quando lead avança de etapa."],
      },
      {
        type: "action", label: "Notificação Interna", icon: BellRing,
        color: "text-orange-500", tagColor: "bg-orange-500/10 text-orange-500 border-orange-500/30",
        summary: "Envia uma mensagem WhatsApp para o celular cadastrado de um membro da equipe. Ideal para alertas internos.",
        options: [
          { name: "Membro", desc: "Selecione um vendedor/admin específico, ou 'Todos os admins'." },
          { name: "Mensagem", desc: "Texto da notificação. Suporta variáveis do lead." },
        ],
        tips: ["Avise o vendedor quando um lead quente entra: '🔥 Lead qualificado: {{lead.name}} — ligue agora!'", "Requer que o membro tenha um número de WhatsApp cadastrado no perfil."],
      },
    ],
  },
  {
    id: "logica",
    label: "Lógica",
    accent: "text-purple-500",
    blocks: [
      {
        type: "condition", label: "Condição (Se/Então)", icon: GitBranch,
        color: "text-purple-500", tagColor: "bg-purple-500/10 text-purple-500 border-purple-500/30",
        summary: "Bifurca o fluxo com base em critérios do lead ou do contexto. Saída 'Verdadeiro' ou 'Falso'.",
        options: [
          { name: "Campo", desc: "Campo do lead ou variável do contexto para verificar (ex: lead.email, lead.stage_id)." },
          { name: "Operador", desc: "igual a, diferente de, contém, não contém, está vazio, não está vazio." },
          { name: "Valor", desc: "Valor para comparação." },
        ],
        tips: ["Use para verificar se o lead tem e-mail antes de tentar enviar um e-mail.", "Verifique se o lead está em uma etapa específica antes de disparar ação."],
      },
      {
        type: "business_hours", label: "Horário Comercial", icon: Clock,
        color: "text-teal-500", tagColor: "bg-teal-500/10 text-teal-500 border-teal-500/30",
        summary: "Verifica se a automação está rodando dentro do horário comercial. Saída 'Dentro do horário' ou 'Fora do horário'.",
        options: [
          { name: "Fuso horário", desc: "Fuso para calcular o horário atual (ex: Brasília GMT-3)." },
          { name: "Horários por dia", desc: "Configure início e fim do horário para cada dia da semana. Desative os dias sem atendimento." },
        ],
        tips: ["Dentro do horário → Transferir para Atendente. Fora → Enviar mensagem 'Retornamos amanhã às 9h'.", "Indispensável para bots que funcionam 24h mas só transferem a humanos em horário útil."],
      },
      {
        type: "ab_split", label: "A/B Split", icon: Shuffle,
        color: "text-pink-500", tagColor: "bg-pink-500/10 text-pink-500 border-pink-500/30",
        summary: "Divide o fluxo aleatoriamente por porcentagem entre dois caminhos (A e B). Útil para testar variações de mensagens.",
        options: [
          { name: "Porcentagem A", desc: "De 1 a 99%. O restante vai para B. Ex: 50/50 divide igualmente." },
        ],
        tips: ["Teste duas abordagens diferentes e compare as taxas de resposta.", "Ex: 50% recebem mensagem direta, 50% recebem mensagem com pergunta."],
      },
      {
        type: "action", label: "Encerrar Automação", icon: XCircle,
        color: "text-red-500", tagColor: "bg-red-500/10 text-red-500 border-red-500/30",
        summary: "Para imediatamente o fluxo para este lead. Nenhum bloco seguinte será executado.",
        options: [],
        tips: ["Use em ramificações onde não há ação a tomar (ex: lead já atendido).", "Use após 'Condição' para ignorar leads que não atendem ao critério."],
      },
    ],
  },
];

const EXAMPLES: ExampleFlow[] = [
  {
    title: "Bot de boas-vindas e qualificação",
    description: "Responde automaticamente ao primeiro contato, coleta o interesse do lead e direciona para o vendedor certo.",
    nodes: [
      { label: "Primeira Mensagem", icon: MessageCircle, color: "border-amber-500/50 bg-amber-500/5", detail: "Qualquer canal" },
      { label: "Enviar Mensagem", icon: MessageSquare, color: "border-blue-500/50 bg-blue-500/5", detail: "Olá {{lead.name}}! Em que posso ajudar?" },
      { label: "Rotear por Resposta", icon: GitMerge, color: "border-violet-500/50 bg-violet-500/5", detail: "Produto A / Produto B / Outro" },
      { label: "Transferir para Atendente", icon: HeadphonesIcon, color: "border-blue-500/50 bg-blue-500/5", detail: "Distribuição automática" },
    ],
  },
  {
    title: "Follow-up de lead inativo",
    description: "Detecta leads que pararam de responder e envia mensagens de reativação em sequência.",
    nodes: [
      { label: "Lead inativo", icon: Timer, color: "border-amber-500/50 bg-amber-500/5", detail: "7 dias sem mensagem" },
      { label: "Horário Comercial", icon: Clock, color: "border-teal-500/50 bg-teal-500/5", detail: "Seg–Sex 9h–18h" },
      { label: "Enviar Mensagem", icon: MessageSquare, color: "border-blue-500/50 bg-blue-500/5", detail: "Oi {{lead.name}}, posso te ajudar?" },
      { label: "Aguardar", icon: Clock, color: "border-slate-500/50 bg-slate-500/5", detail: "3 dias" },
      { label: "Enviar Mensagem", icon: MessageSquare, color: "border-blue-500/50 bg-blue-500/5", detail: "Última tentativa de contato..." },
    ],
  },
  {
    title: "Notificação de venda fechada + Meta CAPI",
    description: "Quando um lead é marcado como ganho, notifica a equipe, registra a conversão no Meta e envia mensagem de agradecimento.",
    nodes: [
      { label: "Lead ganho", icon: Trophy, color: "border-amber-500/50 bg-amber-500/5" },
      { label: "Meta CAPI", icon: BarChart3, color: "border-orange-500/50 bg-orange-500/5", detail: "Evento: Purchase" },
      { label: "Notificação Interna", icon: BellRing, color: "border-orange-500/50 bg-orange-500/5", detail: "🎉 Venda fechada: {{lead.name}}" },
      { label: "Enviar Mensagem", icon: MessageSquare, color: "border-blue-500/50 bg-blue-500/5", detail: "Obrigado pela confiança! 🎉" },
    ],
  },
  {
    title: "Qualificação com A/B Test",
    description: "Testa duas abordagens diferentes de primeiro contato para descobrir qual converte melhor.",
    nodes: [
      { label: "Lead criado", icon: UserPlus, color: "border-amber-500/50 bg-amber-500/5" },
      { label: "A/B Split", icon: Shuffle, color: "border-pink-500/50 bg-pink-500/5", detail: "50% A / 50% B" },
      { label: "Mensagem direta (A)", icon: MessageSquare, color: "border-blue-500/50 bg-blue-500/5", detail: "Temos uma oferta especial para você!" },
      { label: "Mensagem com pergunta (B)", icon: MessageSquare, color: "border-blue-500/50 bg-blue-500/5", detail: "O que você procura hoje?" },
    ],
  },
];

// ── Componentes ───────────────────────────────────────────────────────────────

function NodeVisual({ label, icon: Icon, color, tagColor, small = false }: {
  label: string; icon: React.ElementType; color: string; tagColor: string; small?: boolean;
}) {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 bg-card shadow-sm ${tagColor.includes("amber") ? "border-amber-500/40" : tagColor.includes("blue") ? "border-blue-500/40" : tagColor.includes("cyan") ? "border-cyan-500/40" : tagColor.includes("violet") ? "border-violet-500/40" : tagColor.includes("emerald") ? "border-emerald-500/40" : tagColor.includes("orange") ? "border-orange-500/40" : tagColor.includes("teal") ? "border-teal-500/40" : tagColor.includes("pink") ? "border-pink-500/40" : tagColor.includes("purple") ? "border-purple-500/40" : tagColor.includes("red") ? "border-red-500/40" : "border-slate-500/40"}`}>
      <div className={`p-1 rounded-md ${tagColor}`}>
        <Icon className={small ? "h-3 w-3" : "h-4 w-4"} />
      </div>
      <span className={`font-poppins font-medium ${small ? "text-xs" : "text-sm"}`}>{label}</span>
    </div>
  );
}

function ExampleFlowCard({ flow }: { flow: ExampleFlow }) {
  return (
    <div className="border border-border rounded-xl p-5 bg-card">
      <h4 className="font-poppins font-semibold text-base mb-1">{flow.title}</h4>
      <p className="text-sm text-muted-foreground font-poppins mb-4">{flow.description}</p>
      <div className="flex flex-wrap items-center gap-2">
        {flow.nodes.map((n, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`flex flex-col items-center px-3 py-2 rounded-xl border ${n.color} min-w-[130px]`}>
              <div className="flex items-center gap-1.5">
                <n.icon className="h-4 w-4 text-foreground/70" />
                <span className="text-sm font-poppins font-medium leading-tight">{n.label}</span>
              </div>
              {n.detail && (
                <span className="text-xs text-muted-foreground mt-0.5 font-poppins">{n.detail}</span>
              )}
            </div>
            {i < flow.nodes.length - 1 && (
              <span className="text-muted-foreground text-base">→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockCard({ block }: { block: BlockDoc }) {
  const Icon = block.icon;
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-muted/20">
        <div className={`p-2 rounded-lg ${block.tagColor}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-poppins font-semibold text-base">{block.label}</h3>
          <Badge variant="outline" className={`text-xs mt-0.5 border px-1.5 py-0 ${block.tagColor}`}>
            {block.type === "trigger" ? "Gatilho" : block.type === "action" ? "Ação" : block.type === "condition" ? "Lógica" : block.type === "business_hours" ? "Lógica" : block.type === "ab_split" ? "Lógica" : block.label}
          </Badge>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Descrição */}
        <p className="text-sm text-muted-foreground font-poppins leading-relaxed">{block.summary}</p>

        {/* Opções */}
        {block.options.length > 0 && (
          <div>
            <p className="text-xs font-poppins font-bold uppercase tracking-wide text-foreground/50 mb-2">
              Opções de configuração
            </p>
            <div className="space-y-2">
              {block.options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-sm font-poppins font-semibold text-foreground/80 min-w-fit">{opt.name}:</span>
                  <span className="text-sm font-poppins text-muted-foreground">{opt.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dicas */}
        {block.tips.length > 0 && (
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
            <p className="text-xs font-poppins font-bold uppercase tracking-wide text-primary/70 mb-2">
              Dicas de uso
            </p>
            <ul className="space-y-1.5">
              {block.tips.map((tip, i) => (
                <li key={i} className="flex gap-1.5 text-sm font-poppins text-muted-foreground">
                  <span className="text-primary/60 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function AutomationGuide() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("gatilhos");

  const current = CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/automacoes")}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div>
          <h1 className="font-poppins font-bold text-xl">Guia de Blocos de Automação</h1>
          <p className="text-sm text-muted-foreground font-poppins">
            Entenda o que cada bloco faz, como configurar e exemplos de uso
          </p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar de categorias */}
        <div className="w-52 border-r border-border bg-card/50 flex-shrink-0 py-4 px-3 space-y-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-poppins font-medium transition-colors ${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <span className={activeCategory === cat.id ? "" : cat.accent}>
                {cat.label}
              </span>
              <span className="ml-2 text-xs opacity-60">
                {cat.blocks.length}
              </span>
            </button>
          ))}

          <div className="pt-3 border-t border-border mt-3 space-y-1">
            <button
              onClick={() => setActiveCategory("como-criar")}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-poppins font-medium transition-colors ${
                activeCategory === "como-criar"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              Como criar
            </button>
            <button
              onClick={() => setActiveCategory("exemplos")}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-poppins font-medium transition-colors ${
                activeCategory === "exemplos"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              Exemplos
              <span className="ml-2 text-xs opacity-60">{EXAMPLES.length}</span>
            </button>
          </div>
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeCategory === "como-criar" ? (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h2 className="font-poppins font-bold text-2xl mb-2">Como criar uma boa automação</h2>
                <p className="text-base text-muted-foreground font-poppins">
                  Antes de montar qualquer fluxo, entenda a lógica por trás. Uma automação bem construída poupa tempo, melhora a experiência do lead e não incomoda quem não deve ser incomodado.
                </p>
              </div>

              {/* Regra de ouro */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                <h3 className="font-poppins font-bold text-base mb-2 text-primary">A regra de ouro: Gatilho → Condição → Ação</h3>
                <p className="text-sm text-muted-foreground font-poppins leading-relaxed mb-3">
                  Todo fluxo eficiente segue essa estrutura. Um <strong className="text-foreground">gatilho</strong> inicia a automação, uma <strong className="text-foreground">condição</strong> decide se a ação faz sentido para aquele lead, e a <strong className="text-foreground">ação</strong> executa o que precisa ser feito.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  {[
                    { label: "Gatilho", desc: "O que aconteceu?", color: "border-amber-500/50 bg-amber-500/5 text-amber-600" },
                    { label: "→", desc: "", color: "" },
                    { label: "Condição", desc: "Vale a pena agir?", color: "border-purple-500/50 bg-purple-500/5 text-purple-600" },
                    { label: "→", desc: "", color: "" },
                    { label: "Ação", desc: "O que fazer?", color: "border-blue-500/50 bg-blue-500/5 text-blue-600" },
                  ].map((item, i) =>
                    item.label === "→" ? (
                      <span key={i} className="text-xl text-muted-foreground font-bold">→</span>
                    ) : (
                      <div key={i} className={`flex flex-col items-center px-4 py-2 rounded-xl border ${item.color} min-w-[110px]`}>
                        <span className="text-sm font-poppins font-bold">{item.label}</span>
                        <span className="text-xs text-muted-foreground font-poppins">{item.desc}</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Passo a passo */}
              <div>
                <h3 className="font-poppins font-bold text-lg mb-4">Passo a passo para montar um fluxo</h3>
                <div className="space-y-4">
                  {[
                    {
                      step: "1",
                      title: "Comece pelo objetivo",
                      color: "bg-amber-500",
                      content: "Antes de abrir o editor, responda: qual problema essa automação resolve? Exemplo: 'quero que todo lead que entra receba uma mensagem de boas-vindas dentro de 5 segundos'. Ter o objetivo claro evita criar fluxos confusos com dezenas de blocos sem propósito.",
                    },
                    {
                      step: "2",
                      title: "Escolha o gatilho certo",
                      color: "bg-orange-500",
                      content: "O gatilho é o ponto de partida. Pergunte: quando exatamente esse fluxo deve iniciar? Se for no primeiro contato do lead, use 'Primeira Mensagem'. Se for quando o lead avança no pipeline, use 'Lead movido no Kanban'. Escolha o gatilho mais específico possível para evitar disparos desnecessários.",
                    },
                    {
                      step: "3",
                      title: "Adicione condições antes das ações",
                      color: "bg-purple-500",
                      content: "Não saia mandando mensagens para todo mundo que aciona o gatilho. Use 'Horário Comercial' para não mandar mensagem às 3h da manhã. Use 'Condição' para verificar se o lead tem e-mail antes de enviar um e-mail. Isso evita ações desnecessárias e mantém a qualidade do atendimento.",
                    },
                    {
                      step: "4",
                      title: "Construa o caminho feliz primeiro",
                      color: "bg-blue-500",
                      content: "Monte primeiro o fluxo principal — o que acontece quando tudo funciona como esperado. Depois volte e adicione as ramificações para os casos alternativos. Fluxos construídos 'de trás para frente' ficam difíceis de manter.",
                    },
                    {
                      step: "5",
                      title: "Use Aguardar com sabedoria",
                      color: "bg-cyan-500",
                      content: "O bloco 'Aguardar' é poderoso, mas perigoso se mal usado. Se você colocar 'Aguardar 1 hora' sem motivo, você está apenas atrasando a experiência do lead. Use esperas quando faz sentido: follow-up 24h depois, lembrete 3 dias após sem resposta, confirmação 1h após a compra.",
                    },
                    {
                      step: "6",
                      title: "Sempre encerre os ramos que não têm ação",
                      color: "bg-teal-500",
                      content: "Se você usa 'Condição' ou 'Horário Comercial' e um dos caminhos não precisa de nenhuma ação, coloque o bloco 'Encerrar Automação' nesse ramo. Isso deixa o fluxo explícito e evita comportamentos inesperados.",
                    },
                    {
                      step: "7",
                      title: "Teste antes de ativar",
                      color: "bg-green-500",
                      content: "Use o botão 'Executar manualmente' no detalhe da automação para disparar o fluxo em um lead de teste. Verifique na aba 'Execuções' se os blocos foram executados corretamente. Só ative a automação após confirmar que o fluxo funciona como esperado.",
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-4">
                      <div className={`shrink-0 w-8 h-8 rounded-full ${item.color} flex items-center justify-center text-white font-poppins font-bold text-sm mt-0.5`}>
                        {item.step}
                      </div>
                      <div>
                        <h4 className="font-poppins font-semibold text-base mb-1">{item.title}</h4>
                        <p className="text-sm text-muted-foreground font-poppins leading-relaxed">{item.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Erros comuns */}
              <div>
                <h3 className="font-poppins font-bold text-lg mb-4">Erros comuns (e como evitar)</h3>
                <div className="space-y-3">
                  {[
                    {
                      erro: "Gatilho muito amplo",
                      desc: "Usar 'Lead criado' quando você deveria usar 'Primeira mensagem recebida' faz a automação disparar para leads importados em massa, leads duplicados, leads criados manualmente — não só para os que entraram em contato.",
                      fix: "Seja específico no gatilho. Adicione condições para filtrar os casos que não devem receber a automação.",
                    },
                    {
                      erro: "Mensagens sem personalização",
                      desc: "Mensagens genéricas ('Olá! Como posso ajudar?') têm taxa de resposta muito menor que mensagens personalizadas. O lead percebe que é um bot e ignora.",
                      fix: "Use variáveis como {{lead.name}} e contextualize a mensagem com base no produto ou fonte do lead.",
                    },
                    {
                      erro: "Fluxo sem saída",
                      desc: "Criar automações que ficam em loop ou que nunca chegam a um fim definido. O sistema processa o fluxo, mas o lead fica 'preso' em execuções que não terminam.",
                      fix: "Todo ramo deve terminar em uma ação ou no bloco 'Encerrar Automação'. Revise todos os caminhos possíveis.",
                    },
                    {
                      erro: "Ativar sem testar",
                      desc: "Ativar a automação diretamente em produção sem testar com um lead real é a causa número 1 de problemas. Leads recebem mensagens duplicadas, erradas ou fora de hora.",
                      fix: "Sempre teste primeiro. Crie um lead de teste, dispare manualmente e confirme o comportamento na aba 'Execuções'.",
                    },
                  ].map((item, i) => (
                    <div key={i} className="border border-red-500/20 bg-red-500/5 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-red-500 font-poppins font-bold text-sm mt-0.5 shrink-0">✗</span>
                        <div>
                          <p className="font-poppins font-semibold text-sm text-foreground mb-1">{item.erro}</p>
                          <p className="text-sm text-muted-foreground font-poppins mb-2 leading-relaxed">{item.desc}</p>
                          <div className="flex gap-2">
                            <span className="text-green-600 font-bold text-sm shrink-0">✓</span>
                            <p className="text-sm text-green-700 dark:text-green-400 font-poppins leading-relaxed">{item.fix}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dica final */}
              <div className="bg-muted/50 border border-border rounded-xl p-5">
                <h3 className="font-poppins font-bold text-base mb-2">Lembre-se: menos é mais</h3>
                <p className="text-sm text-muted-foreground font-poppins leading-relaxed">
                  Uma automação com 3 blocos bem pensados é mais eficiente do que uma com 20 blocos mal organizados. Comece simples, ative, observe os resultados e vá refinando. Automações são iterativas — não precisam ser perfeitas na primeira versão.
                </p>
              </div>
            </div>
          ) : activeCategory === "exemplos" ? (
            <div className="space-y-4">
              <div className="mb-4">
                <h2 className="font-poppins font-bold text-2xl mb-1">Exemplos de Automações</h2>
                <p className="text-base text-muted-foreground font-poppins">
                  Fluxos prontos que você pode replicar para casos de uso comuns.
                </p>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {EXAMPLES.map((ex, i) => (
                  <ExampleFlowCard key={i} flow={ex} />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mb-4">
                <h2 className={`font-poppins font-bold text-2xl mb-1 ${current.accent}`}>
                  {current.label}
                </h2>
                <p className="text-base text-muted-foreground font-poppins">
                  {current.id === "gatilhos" && "Os gatilhos iniciam uma automação. Cada fluxo começa com exatamente um gatilho."}
                  {current.id === "whatsapp" && "Blocos para interagir com o lead via WhatsApp: enviar, aguardar e rotear respostas."}
                  {current.id === "crm" && "Ações que modificam dados do lead e do pipeline dentro do CRM."}
                  {current.id === "integracoes" && "Conecte com sistemas externos: Meta Ads, webhooks, e-mail e notificações internas."}
                  {current.id === "logica" && "Blocos de controle de fluxo: condições, horários, testes A/B e encerramento."}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {current.blocks.map((block, i) => (
                  <BlockCard key={i} block={block} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
