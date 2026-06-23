import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';

interface OrgSettings {
  inbox_enabled: boolean;
}

export function useOrgSettings() {
  const { orgId } = useAuth();
  const api = useApi();
  const [settings, setSettings] = useState<OrgSettings>({ inbox_enabled: true });
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!orgId) return;
    try {
      const org = await api.organizations.me() as any;
      setSettings({ inbox_enabled: org?.inboxEnabled ?? true });
    } catch (err) {
      console.error('Error fetching org settings:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId, api]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateInboxEnabled = useCallback(async (enabled: boolean) => {
    if (!orgId) return null;
    try {
      await api.organizations.update(orgId, { inbox_enabled: enabled });
      setSettings(prev => ({ ...prev, inbox_enabled: enabled }));
      return null;
    } catch (err) {
      return err;
    }
  }, [orgId, api]);

  return { settings, loading, updateInboxEnabled, refetch: fetchSettings };
}
