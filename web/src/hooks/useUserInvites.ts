import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface InviteUserData {
  email: string;
  name: string;
  role: 'admin' | 'seller';
  forceResend?: boolean;
}

type InviteUserResult = {
  error?: string;
  code?: string;
  success?: boolean;
  data?: any;
  inviteUrl?: string;
  invitationId?: string;
};

export function useUserInvites() {
  const [loading, setLoading] = useState(false);
  const { user, profile, orgId } = useAuth();
  const { toast } = useToast();

  const inviteUser = async (userData: InviteUserData): Promise<InviteUserResult> => {
    if (!user) {
      toast({ title: 'Erro', description: 'Usuário não autenticado', variant: 'destructive' });
      return { error: 'Usuário não autenticado' };
    }

    const organizationId = profile?.organization_id || orgId;
    if (!organizationId) {
      toast({ title: 'Erro', description: 'Você não pertence a nenhuma organização', variant: 'destructive' });
      return { error: 'Sem organização' };
    }

    setLoading(true);
    try {
      const { data: inviteResult, error: inviteError } = await supabase.functions.invoke('invite-user', {
        body: {
          email: userData.email,
          name: userData.name,
          role: userData.role,
          organizationId,
          invitedByClerkUserId: user.id,
          forceResend: userData.forceResend === true,
        },
      });

      if (inviteError && !inviteResult?.code) {
        toast({
          title: 'Erro ao criar convite',
          description: inviteError.message || 'Erro ao enviar convite',
          variant: 'destructive',
        });
        return { error: inviteError.message };
      }

      if (inviteResult?.success) {
        toast({
          title: '✅ Convite enviado!',
          description: `O convite foi enviado para o email ${userData.email}.`,
        });
        return {
          success: true,
          inviteUrl: inviteResult.inviteUrl,
          invitationId: inviteResult.invitationId,
        };
      }

      // Erros estruturados (já membro / convite pendente)
      return {
        error: inviteResult?.error || 'Erro desconhecido',
        code: inviteResult?.code,
        invitationId: inviteResult?.invitationId,
      };
    } catch (error: any) {
      toast({
        title: 'Erro inesperado',
        description: error.message || 'Ocorreu um erro ao enviar o convite',
        variant: 'destructive',
      });
      return { error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const resendInvitation = async (invitationId: string) => {
    const organizationId = profile?.organization_id || orgId;
    if (!organizationId) return { success: false, error: 'Sem organização' };

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-invitation', {
        body: { action: 'resend', invitationId, organizationId },
      });
      if (error || !data?.success) {
        toast({ title: 'Erro', description: data?.error || error?.message || 'Erro ao reenviar', variant: 'destructive' });
        return { success: false, error: data?.error || error?.message };
      }
      toast({ title: 'Convite reenviado', description: 'O link foi atualizado e enviado novamente.' });
      return { success: true, inviteUrl: data.inviteUrl };
    } finally {
      setLoading(false);
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    const organizationId = profile?.organization_id || orgId;
    if (!organizationId) return { success: false, error: 'Sem organização' };

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-invitation', {
        body: { action: 'revoke', invitationId, organizationId },
      });
      if (error || !data?.success) {
        toast({ title: 'Erro', description: data?.error || error?.message || 'Erro ao revogar', variant: 'destructive' });
        return { success: false };
      }
      toast({ title: 'Convite revogado', description: 'O convite não pode mais ser utilizado.' });
      return { success: true };
    } finally {
      setLoading(false);
    }
  };

  return {
    inviteUser,
    resendInvitation,
    revokeInvitation,
    loading,
  };
}
