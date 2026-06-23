import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApi } from '@/hooks/useApi';

export interface TransferSeller {
  id: string;
  name: string;
  role: string;
  open_conversation_count: number;
}

export function useConversationTransfer(orgId: string | null) {
  const queryClient = useQueryClient();
  const api = useApi();
  const [sellers, setSellers] = useState<TransferSeller[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const fetchSellers = useCallback(async () => {
    if (!orgId) return;
    setLoadingSellers(true);
    try {
      const data = await api.users.list() as any[];
      const eligible = data
        .filter((u) => u.role === 'seller' || u.role === 'admin')
        .map((u) => ({
          id: u.id,
          name: u.name || u.full_name || u.fullName || '',
          role: u.role,
          open_conversation_count: u.openConversationCount || u.open_conversation_count || 0,
        }));
      setSellers(eligible);
    } catch (err: any) {
      toast.error('Erro ao carregar vendedores: ' + (err.message ?? ''));
    } finally {
      setLoadingSellers(false);
    }
  }, [orgId, api]);

  const transferConversation = useCallback(
    async (conversationId: string, toUserId: string, note?: string): Promise<boolean> => {
      setTransferring(true);
      try {
        await api.conversations.transfer(conversationId, toUserId, note);
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['inbox'] });
        toast.success('Conversa transferida com sucesso');
        return true;
      } catch (err: any) {
        toast.error('Erro ao transferir: ' + (err.message ?? ''));
        return false;
      } finally {
        setTransferring(false);
      }
    },
    [queryClient, api],
  );

  return { sellers, loadingSellers, fetchSellers, transferConversation, transferring };
}
