import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Send, X, Loader2, Lightbulb, ArrowRight, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { publishAutomationEvent, AI_EVENTS } from '@/services/automationEventBus';

interface AiSuggestion {
  intent: string;
  intent_label?: string;
  summary: string;
  suggested_reply: string;
  suggested_actions: string[];
  suggested_action_type: string | null;
  suggested_pipeline_id: string | null;
  suggested_stage_id: string | null;
  suggested_stage_name: string | null;
  suggested_reason: string | null;
  confidence: number;
  sentiment?: string;
  urgency_level?: string;
  current_stage_name: string | null;
  current_stage_id: string | null;
  lead_id: string | null;
  ai_interaction_id: string | null;
}

interface AiSuggestionPanelProps {
  conversationId: string;
  organizationId: string;
  aiMode: string;
  onUseSuggestion: (text: string) => void;
  onStageApplied?: () => void;
}

const intentLabels: Record<string, string> = {
  interest: 'Interesse',
  purchase_interest: 'Interesse de compra',
  question: 'Pergunta',
  objection: 'Objeção',
  complaint: 'Reclamação',
  closing: 'Fechamento',
  greeting: 'Saudação',
  no_interest: 'Sem interesse',
  scheduling: 'Agendamento',
  other: 'Outro',
  unknown: 'Indefinido',
};

export function AiSuggestionPanel({
  conversationId,
  organizationId,
  aiMode,
  onUseSuggestion,
  onStageApplied,
}: AiSuggestionPanelProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [editedReply, setEditedReply] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [applyingStage, setApplyingStage] = useState(false);
  const [stageApplied, setStageApplied] = useState(false);

  if (aiMode === 'off') return null;

  const handleAnalyze = async () => {
    setLoading(true);
    setSuggestion(null);
    setShowPanel(true);
    setStageApplied(false);

    try {
      const res = await supabase.functions.invoke('ai-analyze-conversation', {
        body: { conversation_id: conversationId, organization_id: organizationId },
      });

      if (res.error) throw new Error(res.error.message);
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);

      setSuggestion(data as AiSuggestion);
      setEditedReply(data.suggested_reply || '');
    } catch (err: any) {
      console.error('AI analysis error:', err);
      toast.error(err.message || 'Erro ao analisar conversa');
      setShowPanel(false);
    } finally {
      setLoading(false);
    }
  };

  const handleUse = () => {
    if (editedReply.trim()) {
      onUseSuggestion(editedReply.trim());
      setShowPanel(false);
      setSuggestion(null);
    }
  };

  const handleClose = () => {
    setShowPanel(false);
    setSuggestion(null);
    setStageApplied(false);
  };

  const handleApplyStage = async () => {
    if (!suggestion?.suggested_stage_id || !suggestion?.lead_id) return;
    setApplyingStage(true);

    try {
      // Update the lead's stage_id directly
      const { error: updateError } = await supabase
        .from('leads')
        .update({ stage_id: suggestion.suggested_stage_id } as any)
        .eq('id', suggestion.lead_id);

      if (updateError) throw updateError;

      const currentUser = (await supabase.auth.getUser()).data.user;

      // Log the action to ai_stage_actions
      await supabase.from('ai_stage_actions' as any).insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        lead_id: suggestion.lead_id,
        from_stage_id: suggestion.current_stage_id,
        from_stage_name: suggestion.current_stage_name,
        to_stage_id: suggestion.suggested_stage_id,
        to_stage_name: suggestion.suggested_stage_name,
        suggested_pipeline_id: suggestion.suggested_pipeline_id,
        suggested_reason: suggestion.suggested_reason,
        suggested_action_type: suggestion.suggested_action_type,
        ai_interaction_id: suggestion.ai_interaction_id,
        applied_by: currentUser?.id,
        applied_at: new Date().toISOString(),
        status: 'applied',
      });

      // ── PUBLISH EVENT TO EVENT BUS ──
      const eventName = suggestion.suggested_action_type === 'qualify'
        ? AI_EVENTS.LEAD_QUALIFIED_BY_AI
        : suggestion.suggested_action_type === 'followup'
          ? AI_EVENTS.LEAD_FOLLOWUP_NEEDED_BY_AI
          : AI_EVENTS.LEAD_STAGE_CHANGED_BY_AI;

      await publishAutomationEvent({
        organizationId,
        eventName,
        entityType: 'lead',
        entityId: suggestion.lead_id,
        conversationId,
        leadId: suggestion.lead_id,
        payload: {
          from_stage_id: suggestion.current_stage_id,
          from_stage_name: suggestion.current_stage_name,
          to_stage_id: suggestion.suggested_stage_id,
          to_stage_name: suggestion.suggested_stage_name,
          pipeline_id: suggestion.suggested_pipeline_id,
          reason: suggestion.suggested_reason,
          confidence: suggestion.confidence,
          applied_by_profile_id: currentUser?.id,
          action_type: suggestion.suggested_action_type,
        },
        source: 'ai',
        sourceAiInteractionId: suggestion.ai_interaction_id || undefined,
        idempotencyParts: [
          conversationId,
          suggestion.suggested_stage_id,
        ],
      });

      setStageApplied(true);
      toast.success(`Etapa atualizada para "${suggestion.suggested_stage_name}"`);
      onStageApplied?.();
    } catch (err: any) {
      console.error('Error applying stage:', err);
      toast.error(err.message || 'Erro ao aplicar etapa');
    } finally {
      setApplyingStage(false);
    }
  };

  return (
    <>
      {/* Trigger button */}
      {!showPanel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAnalyze}
          disabled={loading}
          className="h-7 text-xs gap-1 text-primary hover:text-primary"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Sugerir resposta (IA)
        </Button>
      )}

      {/* Suggestion panel */}
      {showPanel && (
        <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary">Sugestão da IA</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Analisando conversa...</span>
            </div>
          ) : suggestion ? (
            <>
              {/* Intent + confidence */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] h-5">
                  <Lightbulb className="h-3 w-3 mr-1" />
                  {suggestion.intent_label || intentLabels[suggestion.intent] || suggestion.intent}
                </Badge>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] h-5",
                    suggestion.confidence >= 0.7 ? "bg-green-500/10 text-green-700" :
                    suggestion.confidence >= 0.4 ? "bg-yellow-500/10 text-yellow-700" :
                    "bg-red-500/10 text-red-700"
                  )}
                >
                  {Math.round(suggestion.confidence * 100)}% confiança
                </Badge>
                {suggestion.sentiment && suggestion.sentiment !== 'neutral' && (
                  <Badge variant="secondary" className={cn(
                    "text-[10px] h-5",
                    suggestion.sentiment === 'positive' ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-700"
                  )}>
                    {suggestion.sentiment === 'positive' ? '😊 Positivo' : '😟 Negativo'}
                  </Badge>
                )}
                {suggestion.urgency_level && suggestion.urgency_level !== 'low' && (
                  <Badge variant="secondary" className={cn(
                    "text-[10px] h-5",
                    suggestion.urgency_level === 'high' ? "bg-red-500/10 text-red-700" : "bg-amber-500/10 text-amber-700"
                  )}>
                    ⚡ {suggestion.urgency_level === 'high' ? 'Alta' : 'Média'}
                  </Badge>
                )}
              </div>

              {/* Summary */}
              <p className="text-xs text-muted-foreground italic">
                {suggestion.summary}
              </p>

              {/* Editable reply */}
              <Textarea
                value={editedReply}
                onChange={(e) => setEditedReply(e.target.value)}
                className="min-h-[60px] max-h-[100px] text-sm resize-none bg-background"
                placeholder="Edite a sugestão antes de usar..."
              />

              {/* Stage suggestion section */}
              {suggestion.suggested_stage_id && suggestion.lead_id && (
                <div className="border border-border rounded-lg p-3 bg-background space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] h-5 bg-primary/5 text-primary border-primary/20">
                      <ArrowRight className="h-3 w-3 mr-1" />
                      Sugestão de etapa
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Mover para:</span>
                    <span className="font-medium">
                      {suggestion.current_stage_name && (
                        <>
                          <span className="text-muted-foreground">{suggestion.current_stage_name}</span>
                          <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                        </>
                      )}
                      <span className="text-primary font-semibold">{suggestion.suggested_stage_name}</span>
                    </span>
                  </div>

                  {suggestion.suggested_reason && (
                    <p className="text-[11px] text-muted-foreground">
                      💡 {suggestion.suggested_reason}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    {stageApplied ? (
                      <Badge variant="secondary" className="text-[10px] h-6 bg-green-500/10 text-green-700">
                        <Check className="h-3 w-3 mr-1" />
                        Aplicada
                      </Badge>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          onClick={handleApplyStage}
                          disabled={applyingStage}
                          className="h-7 text-xs gap-1"
                        >
                          {applyingStage ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Aplicar etapa
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => setSuggestion(s => s ? { ...s, suggested_stage_id: null } : null)}
                        >
                          Ignorar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Stage reason when no suggestion */}
              {!suggestion.suggested_stage_id && suggestion.suggested_reason && (
                <p className="text-[10px] text-muted-foreground italic">
                  ℹ️ Etapa: {suggestion.suggested_reason}
                </p>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleUse} className="h-7 text-xs gap-1">
                  <Send className="h-3 w-3" />
                  Usar resposta
                </Button>
                <Button variant="ghost" size="sm" onClick={handleAnalyze} className="h-7 text-xs">
                  Regenerar
                </Button>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  Nenhuma ação é executada automaticamente
                </span>
              </div>
            </>
          ) : null}
        </div>
      )}
    </>
  );
}
