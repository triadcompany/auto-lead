import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface LeadDistributionSettings {
  id: string;
  organization_id: string;
  is_auto_distribution_enabled: boolean;
  mode: 'manual' | 'auto';
  manual_receiver_id?: string;
  rr_cursor: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LeadDistributionRule {
  id: string;
  distribution_setting_id: string;
  start_time: string;
  end_time: string;
  assigned_user_id: string;
  days_of_week: number[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadDistributionUser {
  id: string;
  distribution_setting_id: string;
  user_id: string;
  is_active: boolean;
  order_position: number;
  created_at: string;
}

export const useLeadDistribution = () => {
  const { user, profile, orgId: authOrgId } = useAuth();
  const ldOrgId = profile?.organization_id || authOrgId;
  const [settings, setSettings] = useState<LeadDistributionSettings | null>(null);
  const [rules, setRules] = useState<LeadDistributionRule[]>([]);
  const [users, setUsers] = useState<LeadDistributionUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && ldOrgId) {
      fetchDistributionSettings();
    } else {
      setLoading(false);
    }
  }, [user, ldOrgId]);

  const fetchDistributionSettings = async () => {
    try {
      setLoading(true);

      // Buscar configurações
      const { data: settingsData, error: settingsError } = await supabase
        .from('lead_distribution_settings')
        .select('*')
        .eq('organization_id', ldOrgId)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError;
      }

      if (settingsData) {
        setSettings(settingsData as LeadDistributionSettings);

        // Buscar regras
        const { data: rulesData, error: rulesError } = await supabase
          .from('lead_distribution_rules')
          .select('*')
          .eq('distribution_setting_id', settingsData.id)
          .eq('is_active', true)
          .order('start_time');

        if (rulesError) throw rulesError;
        setRules(rulesData || []);

        // Buscar usuários para round robin
        const { data: usersData, error: usersError } = await supabase
          .from('lead_distribution_users')
          .select('*')
          .eq('distribution_setting_id', settingsData.id)
          .eq('is_active', true)
          .order('order_position');

        if (usersError) throw usersError;
        setUsers(usersData || []);
      } else {
        setSettings(null);
        setRules([]);
        setUsers([]);
      }
    } catch (error) {
      console.error('Error fetching distribution settings:', error);
      toast.error('Erro ao carregar configurações de distribuição');
    } finally {
      setLoading(false);
    }
  };

  const createOrUpdateSettings = async (settingsData: Partial<LeadDistributionSettings>) => {
    try {
      if (!profile?.id) throw new Error('Profile not found');

      const payload = {
        ...settingsData,
        organization_id: profile.organization_id,
        created_by: profile.id,
      };

      let result;
      if (settings?.id) {
        const { data, error } = await supabase
          .from('lead_distribution_settings')
          .update(payload)
          .eq('id', settings.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from('lead_distribution_settings')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      setSettings(result);
      toast.success('Configurações salvas com sucesso');
      return result;
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
      throw error;
    }
  };

  const resetCursor = async () => {
    try {
      if (!ldOrgId) throw new Error('Organization not found');
      if (!profile?.organization_id) throw new Error('Profile not found');

      const { error } = await (supabase.rpc as any)('reset_distribution_cursor', {
        p_organization_id: profile.organization_id
      });

      if (error) throw error;

      await fetchDistributionSettings();
      toast.success('Cursor resetado com sucesso');
    } catch (error) {
      console.error('Error resetting cursor:', error);
      toast.error('Erro ao resetar cursor');
      throw error;
    }
  };

  const addRule = async (ruleData: Omit<LeadDistributionRule, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (!settings?.id) throw new Error('Settings not found');

      const { data, error } = await supabase
        .from('lead_distribution_rules')
        .insert({
          ...ruleData,
          distribution_setting_id: settings.id,
        })
        .select()
        .single();

      if (error) throw error;

      setRules(prev => [...prev, data]);
      toast.success('Regra adicionada com sucesso');
      return data;
    } catch (error) {
      console.error('Error adding rule:', error);
      toast.error('Erro ao adicionar regra');
      throw error;
    }
  };

  const updateRule = async (ruleId: string, ruleData: Partial<LeadDistributionRule>) => {
    try {
      const { data, error } = await supabase
        .from('lead_distribution_rules')
        .update(ruleData)
        .eq('id', ruleId)
        .select()
        .single();

      if (error) throw error;

      setRules(prev => prev.map(rule => rule.id === ruleId ? data : rule));
      toast.success('Regra atualizada com sucesso');
      return data;
    } catch (error) {
      console.error('Error updating rule:', error);
      toast.error('Erro ao atualizar regra');
      throw error;
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('lead_distribution_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      setRules(prev => prev.filter(rule => rule.id !== ruleId));
      toast.success('Regra removida com sucesso');
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Erro ao remover regra');
      throw error;
    }
  };

  const addDistributionUser = async (userId: string, orderPosition: number) => {
    try {
      if (!settings?.id) throw new Error('Settings not found');

      const { data, error } = await supabase
        .from('lead_distribution_users')
        .insert({
          distribution_setting_id: settings.id,
          user_id: userId,
          order_position: orderPosition,
        })
        .select()
        .single();

      if (error) throw error;

      setUsers(prev => [...prev, data]);
      toast.success('Usuário adicionado à distribuição');
      return data;
    } catch (error) {
      console.error('Error adding distribution user:', error);
      toast.error('Erro ao adicionar usuário');
      throw error;
    }
  };

  const removeDistributionUser = async (distributionUserId: string) => {
    try {
      const { error } = await supabase
        .from('lead_distribution_users')
        .delete()
        .eq('id', distributionUserId);

      if (error) throw error;

      setUsers(prev => prev.filter(user => user.id !== distributionUserId));
      toast.success('Usuário removido da distribuição');
    } catch (error) {
      console.error('Error removing distribution user:', error);
      toast.error('Erro ao remover usuário');
      throw error;
    }
  };

  return {
    settings,
    rules,
    users,
    loading,
    createOrUpdateSettings,
    addRule,
    updateRule,
    deleteRule,
    addDistributionUser,
    removeDistributionUser,
    resetCursor,
    refreshSettings: fetchDistributionSettings,
  };
};