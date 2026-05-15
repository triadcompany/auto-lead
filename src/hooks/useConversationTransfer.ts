import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TransferSeller {
  id: string;
  name: string;
  role: string;
  open_conversation_count: number;
}

export function useConversationTransfer(orgId: string | null) {
  const queryClient = useQueryClient();
  const [sellers, setSellers] = useState<TransferSeller[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const fetchSellers = useCallback(async () => {
    if (!orgId) return;
    setLoadingSellers(true);
    try {
      const { data, error } = await (supabase as any).rpc('get_org_profiles', {
        p_org_id: orgId,
        p_role: null,
      });
      if (error) throw error;
      // Exclude pre_sales — only sellers and admins can receive transfers
      const eligible = ((data ?? []) as TransferSeller[]).filter(
        (u) => u.role === 'seller' || u.role === 'admin',
      );
      setSellers(eligible);
    } catch (err: any) {
      toast.error('Erro ao carregar vendedores: ' + (err.message ?? ''));
    } finally {
      setLoadingSellers(false);
    }
  }, [orgId]);

  const transferConversation = useCallback(
    async (conversationId: string, toUserId: string, note?: string): Promise<boolean> => {
      setTransferring(true);
      try {
        const { data, error } = await (supabase as any).rpc('transfer_conversation', {
          p_conversation_id: conversationId,
          p_to_user_id: toUserId,
          p_note: note ?? null,
        });

        if (error) throw error;

        const result = data as {
          success: boolean;
          error?: string;
          intro_message?: string;
          instance_name?: string;
          contact_phone?: string;
          organization_id?: string;
        };

        if (!result.success) throw new Error(result.error ?? 'Erro ao transferir');

        // Send the intro message via whatsapp-send edge function
        if (result.intro_message && result.instance_name && result.contact_phone) {
          await supabase.functions.invoke('whatsapp-send', {
            body: {
              organization_id: result.organization_id,
              text: result.intro_message,
              instance_name: result.instance_name,
              phone: result.contact_phone,
            },
          });
        }

        // Refresh conversations in inbox
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
    [queryClient],
  );

  return { sellers, loadingSellers, fetchSellers, transferConversation, transferring };
}
