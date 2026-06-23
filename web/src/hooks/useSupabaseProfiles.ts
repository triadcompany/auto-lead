import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';

export interface Profile {
  id: string;
  user_id: string;
  clerk_user_id?: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  role: 'admin' | 'seller';
  created_at: string;
  updated_at: string;
}

export interface UserInvitation {
  id: string;
  organization_id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'seller';
  invited_by: string | null;
  status: string | null;
  created_at: string | null;
  token: string | null;
  expires_at: string | null;
  accepted_at: string | null;
}

export function useSupabaseProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin, user, profile: currentProfile, orgId: authOrgId } = useAuth();
  const { toast } = useToast();
  const api = useApi();

  const fetchProfiles = async () => {
    const organizationId = authOrgId || currentProfile?.organization_id;
    if (!organizationId) {
      setProfiles([]);
      setInvitations([]);
      setLoading(false);
      return;
    }

    try {
      const data = await api.users.list() as any[];

      const profilesList: Profile[] = data.map((u: any) => ({
        id: u.id,
        user_id: u.clerkUserId || u.clerk_user_id || u.id,
        clerk_user_id: u.clerkUserId || u.clerk_user_id,
        name: u.name,
        email: u.email,
        avatar_url: u.avatarUrl || u.avatar_url || null,
        role: u.role || 'seller',
        created_at: u.createdAt || u.created_at,
        updated_at: u.updatedAt || u.updated_at,
      }));

      setProfiles(profilesList);
    } catch (err) {
      console.error('Error in fetchProfiles:', err);
      toast({ title: "Erro", description: "Erro ao carregar usuários", variant: "destructive" });
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, [isAdmin, user, authOrgId, currentProfile?.organization_id]);

  const updateProfile = async (profileId: string, updates: Partial<Profile>) => {
    try {
      const { role, name, avatar_url } = updates;

      if (name !== undefined || avatar_url !== undefined) {
        await api.users.updateProfile(profileId, {
          ...(name !== undefined && { name }),
          ...(avatar_url !== undefined && { avatar_url }),
        });
      }

      if (role !== undefined) {
        await api.users.updateRole(profileId, role);
      }

      setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, ...updates } : p));
      toast({ title: 'Sucesso', description: 'Usuário atualizado com sucesso' });
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error);
      toast({ title: 'Erro', description: error?.message || 'Erro ao atualizar usuário', variant: 'destructive' });
    }
  };

  const deleteProfile = async (profileId: string) => {
    try {
      await api.users.delete(profileId);
      setProfiles(prev => prev.filter(p => p.id !== profileId));
      toast({ title: "Usuário removido", description: "O usuário foi removido desta organização." });
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      toast({ title: "Erro", description: "Erro ao excluir usuário", variant: "destructive" });
    }
  };

  const deleteInvitation = async (invitationId: string) => {
    setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    toast({ title: "Sucesso", description: "Convite cancelado com sucesso" });
  };

  return {
    profiles,
    invitations,
    loading,
    updateProfile,
    deleteProfile,
    deleteInvitation,
    refreshProfiles: fetchProfiles,
  };
}
