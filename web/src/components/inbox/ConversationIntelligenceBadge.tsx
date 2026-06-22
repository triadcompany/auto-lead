import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, AlertCircle, Info, Target, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface ConversationIntelligenceBadgeProps {
  conversationId: string;
  organizationId: string;
}

const sentimentConfig = {
  positive: { label: 'Positivo', icon: TrendingUp, color: 'text-green-600 dark:text-green-400' },
  neutral: { label: 'Neutro', icon: Minus, color: 'text-muted-foreground' },
  negative: { label: 'Negativo', icon: TrendingDown, color: 'text-red-600 dark:text-red-400' },
};

const urgencyConfig = {
  low: { label: 'Baixa', icon: Info, color: 'text-muted-foreground' },
  medium: { label: 'Média', icon: AlertCircle, color: 'text-amber-600 dark:text-amber-400' },
  high: { label: 'Alta', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400' },
};

export function ConversationIntelligenceBadge({
  conversationId,
  organizationId,
}: ConversationIntelligenceBadgeProps) {
  const { data: intelligence } = useQuery({
    queryKey: ['conversation-intelligence', conversationId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('conversation_intelligence')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId && !!organizationId,
    refetchInterval: 30000,
  });

  if (!intelligence) return null;

  const sentiment = sentimentConfig[intelligence.sentiment as keyof typeof sentimentConfig] || sentimentConfig.neutral;
  const urgency = urgencyConfig[intelligence.urgency_level as keyof typeof urgencyConfig] || urgencyConfig.low;
  const SentimentIcon = sentiment.icon;
  const UrgencyIcon = urgency.icon;
  const confidencePct = Math.round((intelligence.confidence || 0) * 100);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-border bg-muted/20 flex-wrap">
        <Brain className="h-3.5 w-3.5 text-primary/70 flex-shrink-0" />
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="h-5 text-[10px] gap-1 cursor-help bg-primary/5 border-primary/20 text-primary">
              {intelligence.intent_label || intelligence.last_detected_intent}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Intenção detectada: {intelligence.intent_label || intelligence.last_detected_intent}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className={cn(
                "h-5 text-[10px] cursor-help",
                confidencePct >= 70 ? "bg-green-500/10 text-green-700 dark:text-green-400" :
                confidencePct >= 40 ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" :
                "bg-red-500/10 text-red-700 dark:text-red-400"
              )}
            >
              {confidencePct}%
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Confiança: {confidencePct}%
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("flex items-center gap-0.5 cursor-help", sentiment.color)}>
              <SentimentIcon className="h-3 w-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Sentimento: {sentiment.label}
          </TooltipContent>
        </Tooltip>

        {intelligence.urgency_level !== 'low' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn("flex items-center gap-0.5 cursor-help", urgency.color)}>
                <UrgencyIcon className="h-3 w-3" />
                <span className="text-[10px] font-medium">{urgency.label}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Urgência: {urgency.label}
            </TooltipContent>
          </Tooltip>
        )}

        {intelligence.is_qualified && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="h-5 text-[10px] gap-1 cursor-help bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" variant="outline">
                <Target className="h-3 w-3" />
                Qualificado
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              🎯 Lead qualificado com base nos critérios definidos
            </TooltipContent>
          </Tooltip>
        )}

        {intelligence.priority_level === 'high' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="h-5 text-[10px] gap-1 cursor-help bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" variant="outline">
                <Zap className="h-3 w-3" />
                Prioridade
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              ⚡ Prioridade alta — requer atenção imediata
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}