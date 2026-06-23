import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';

export function useUnreadCount(): number {
  const { orgId, isAdmin, profile } = useAuth();
  const api = useApi();

  const { data } = useQuery({
    queryKey: ['unread-count', orgId, isAdmin, profile?.id],
    enabled: !!orgId,
    refetchInterval: 30_000,
    staleTime: 15_000,
    queryFn: async () => {
      if (!orgId) return 0;
      const conversations = await api.conversations.list({
        ...((!isAdmin && profile?.id) && { assigned_to: profile.id }),
        limit: 200,
      }) as any[];
      return conversations.reduce((sum: number, c: any) => sum + (c.unreadCount || c.unread_count || 0), 0);
    },
  });

  return data ?? 0;
}
