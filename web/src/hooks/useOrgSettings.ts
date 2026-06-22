import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface OrgSettings {
  inbox_enabled: boolean;
}

export function useOrgSettings() {
  const { orgId } = useAuth();
  const [settings, setSettings] = useState<OrgSettings>({ inbox_enabled: true });
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!orgId) return;
    try {
      const { data } = await supabase
        .from('organizations')
        .select('inbox_enabled')
        .eq('id', orgId)
        .single();

      if (data) {
        setSettings({ inbox_enabled: data.inbox_enabled ?? true });
      }
    } catch (err) {
      console.error('Error fetching org settings:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateInboxEnabled = useCallback(async (enabled: boolean) => {
    if (!orgId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return new Error('No session');

    const res = await supabase.functions.invoke('update-sensitive-settings', {
      body: { table: 'organizations', updates: { inbox_enabled: enabled } },
    });

    if (res.error) return res.error;
    setSettings(prev => ({ ...prev, inbox_enabled: enabled }));
    return null;
  }, [orgId]);

  return { settings, loading, updateInboxEnabled, refetch: fetchSettings };
}
