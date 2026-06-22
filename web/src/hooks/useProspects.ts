import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Prospect {
  id: string;
  cnpj: string;
  company_name: string | null;
  trade_name: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
  main_activity: string | null;
  raw_data: any;
  created_at: string;
  updated_at: string;
}

interface ProspectInsert {
  cnpj: string;
  company_name?: string | null;
  trade_name?: string | null;
  owner_name?: string | null;
  owner_phone?: string | null;
  owner_email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  main_activity?: string | null;
  raw_data?: any;
}

export function useProspects() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchingCnpj, setSearchingCnpj] = useState(false);
  const { profile, orgId: authOrgId } = useAuth();
  const prospectOrgId = profile?.organization_id || authOrgId;
  const { toast } = useToast();

  const fetchProspects = async () => {
    if (!prospectOrgId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('organization_id', prospectOrgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProspects(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar prospects:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os prospects',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const searchCnpj = async (cnpj: string) => {
    if (!prospectOrgId) return null;

    try {
      setSearchingCnpj(true);
      
      const { data, error } = await supabase.functions.invoke('cnpj-lookup', {
        body: { cnpj },
      });

      if (error) throw error;

      if (!data.success) {
        toast({
          title: 'Erro',
          description: data.error || 'Erro ao consultar CNPJ',
          variant: 'destructive',
        });
        return null;
      }

      return data.data;
    } catch (error: any) {
      console.error('Erro ao consultar CNPJ:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível consultar o CNPJ',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSearchingCnpj(false);
    }
  };

  const addProspect = async (prospectData: ProspectInsert) => {
    if (!prospectOrgId) return null;

    try {
      const insertData = {
        cnpj: prospectData.cnpj,
        company_name: prospectData.company_name,
        trade_name: prospectData.trade_name,
        owner_name: prospectData.owner_name,
        owner_phone: prospectData.owner_phone,
        owner_email: prospectData.owner_email,
        address: prospectData.address,
        city: prospectData.city,
        state: prospectData.state,
        status: prospectData.status,
        main_activity: prospectData.main_activity,
        raw_data: prospectData.raw_data,
        organization_id: prospectOrgId,
        created_by: profile?.id || '',
      };

      const { data, error } = await supabase
        .from('prospects')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'CNPJ já cadastrado',
            description: 'Este CNPJ já existe na sua lista de prospecção',
            variant: 'destructive',
          });
          return null;
        }
        throw error;
      }

      toast({
        title: 'Sucesso',
        description: 'Prospect adicionado à lista',
      });

      setProspects((prev) => [data as unknown as Prospect, ...prev]);
      return data;
    } catch (error: any) {
      console.error('Erro ao adicionar prospect:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o prospect',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateProspect = async (id: string, updates: Partial<Prospect>) => {
    try {
      const { data, error } = await supabase
        .from('prospects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Prospect atualizado',
      });

      setProspects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...data } : p))
      );
      return data;
    } catch (error: any) {
      console.error('Erro ao atualizar prospect:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o prospect',
        variant: 'destructive',
      });
      return null;
    }
  };

  const deleteProspect = async (id: string) => {
    try {
      const { error } = await supabase.from('prospects').delete().eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Prospect removido da lista',
      });

      setProspects((prev) => prev.filter((p) => p.id !== id));
      return true;
    } catch (error: any) {
      console.error('Erro ao deletar prospect:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o prospect',
        variant: 'destructive',
      });
      return false;
    }
  };

  useEffect(() => {
    if (prospectOrgId) {
      fetchProspects();
    } else {
      setLoading(false);
    }
  }, [prospectOrgId]);

  return {
    prospects,
    loading,
    searchingCnpj,
    searchCnpj,
    addProspect,
    updateProspect,
    deleteProspect,
    refreshProspects: fetchProspects,
  };
}
