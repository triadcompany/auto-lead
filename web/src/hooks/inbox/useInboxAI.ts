import { useCallback, Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import { InboxThread, rpcUpdate } from './inboxUtils';

interface Params {
  orgId: string | null;
  clerkUserId: string;
  setThreads: Dispatch<SetStateAction<InboxThread[]>>;
}

export function useInboxAI({ orgId, clerkUserId, setThreads }: Params) {
  const toggleAiMode = useCallback(async (threadId: string, newMode: string) => {
    if (!orgId || !clerkUserId) return;

    const validModes = ['off', 'assisted', 'auto'];
    if (!validModes.includes(newMode)) {
      toast.error(`Valor inválido para modo IA: "${newMode}"`);
      return;
    }

    const updateData: { ai_mode: string; ai_state: string | null } = {
      ai_mode: newMode,
      ai_state: newMode === 'auto' ? 'ai_active' : null,
    };

    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, ...updateData } : t));

    try {
      await rpcUpdate(orgId, clerkUserId, threadId, updateData);
      const modeLabels: Record<string, string> = {
        off: 'IA desativada',
        assisted: 'IA Assistente ativada',
        auto: 'IA Autônoma ativada',
      };
      toast.success(modeLabels[newMode] || 'Modo alterado');
    } catch (err: any) {
      setThreads(prev =>
        prev.map(t => t.id === threadId ? { ...t, ai_mode: 'off', ai_state: null } : t)
      );
      toast.error(`Erro ao alterar modo da IA: ${err?.message || 'Erro desconhecido'}`);
    }
  }, [orgId, clerkUserId, setThreads]);

  const resumeAi = useCallback(async (threadId: string) => {
    if (!orgId || !clerkUserId) return;
    try {
      await rpcUpdate(orgId, clerkUserId, threadId, { ai_state: 'ai_active', ai_reply_count_since_last_lead: 0 });
      setThreads(prev =>
        prev.map(t => t.id === threadId ? { ...t, ai_state: 'ai_active', ai_reply_count_since_last_lead: 0 } : t)
      );
      toast.success('IA retomada');
    } catch (err: any) {
      toast.error('Erro ao retomar IA');
    }
  }, [orgId, clerkUserId, setThreads]);

  return { toggleAiMode, resumeAi };
}
