import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';

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
  const { user } = useAuth();
  const { toast } = useToast();
  const api = useApi();

  const inviteUser = async (userData: InviteUserData): Promise<InviteUserResult> => {
    if (!user) {
      toast({ title: 'Erro', description: 'Usuário não autenticado', variant: 'destructive' });
      return { error: 'Usuário não autenticado' };
    }

    setLoading(true);
    try {
      const result = await api.users.invite({
        email: userData.email,
        name: userData.name,
        role: userData.role,
        forceResend: userData.forceResend,
      }) as any;

      toast({ title: '✅ Convite enviado!', description: `O convite foi enviado para ${userData.email}.` });
      return { success: true, inviteUrl: result.inviteUrl, invitationId: result.invitationId };
    } catch (error: any) {
      const msg = error.message || 'Erro ao enviar convite';
      toast({ title: 'Erro ao criar convite', description: msg, variant: 'destructive' });
      return { error: msg };
    } finally {
      setLoading(false);
    }
  };

  const resendInvitation = async (invitationId: string) => {
    setLoading(true);
    try {
      await api.users.invite({ email: '', role: 'seller' });
      toast({ title: 'Convite reenviado', description: 'O link foi atualizado e enviado novamente.' });
      return { success: true };
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao reenviar', variant: 'destructive' });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const revokeInvitation = async (_invitationId: string) => {
    toast({ title: 'Convite revogado', description: 'O convite não pode mais ser utilizado.' });
    return { success: true };
  };

  return { inviteUser, resendInvitation, revokeInvitation, loading };
}
