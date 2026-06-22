import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUnreadCount(): number {
  const { orgId, isAdmin, profile } = useAuth();

  const { data } = useQuery({
    queryKey: ['unread-count', orgId, isAdmin, profile?.id],
    enabled: !!orgId,
    refetchInterval: 30_000,
    staleTime: 15_000,
    queryFn: async () => {
      if (!orgId) return 0;

      let query = supabase
        .from('conversations')
        .select('unread_count')
        .eq('organization_id', orgId)
        .gt('unread_count', 0);

      if (!isAdmin && profile?.id) {
        query = query.eq('assigned_to', profile.id);
      }

      const { data, error } = await query;
      if (error) return 0;
      return (data ?? []).reduce((sum, c) => sum + (c.unread_count || 0), 0);
    },
  });

  return data ?? 0;
}
