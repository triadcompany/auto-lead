import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface MetaIntegration {
  id: string;
  pixel_id: string;
  access_token: string;
  track_lead_qualificado: boolean;
  track_lead_super_qualificado: boolean;
  track_lead_comprou: boolean;
  track_lead_veio_loja: boolean;
  is_active: boolean;
  test_mode: boolean;
}

interface MetaEventLog {
  id: string;
  event_name: string;
  event_id: string;
  success: boolean;
  error_message: string | null;
  created_at: string;
  lead_id: string;
}

export function useMetaIntegration() {
  const { profile, orgId: authOrgId } = useAuth();
  const metaOrgId = profile?.organization_id || authOrgId;
  const [config, setConfig] = useState<MetaIntegration | null>(null);
  const [recentEvents, setRecentEvents] = useState<MetaEventLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (metaOrgId) {
      loadConfig();
      loadRecentEvents();
    } else {
      setLoading(false);
    }
  }, [metaOrgId]);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("meta_integrations")
        .select("*")
        .eq("organization_id", metaOrgId)
        .maybeSingle();

      if (error) throw error;
      setConfig(data);
    } catch (error: any) {
      console.error("Error loading Meta integration:", error);
      toast.error("Erro ao carregar configurações do Meta Pixel");
    } finally {
      setLoading(false);
    }
  };

  const loadRecentEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("meta_events_log")
        .select("*")
        .eq("organization_id", metaOrgId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentEvents(data || []);
    } catch (error: any) {
      console.error("Error loading Meta events log:", error);
    }
  };

  const saveConfig = async (updates: Partial<MetaIntegration>) => {
    try {
      if (config?.id) {
        // Update
        const { error } = await supabase
          .from("meta_integrations")
          .update(updates)
          .eq("id", config.id);

        if (error) throw error;
      } else {
        // Insert - pixel_id e access_token são obrigatórios na criação
        if (!updates.pixel_id || !updates.access_token) {
          toast.error("Pixel ID e Access Token são obrigatórios");
          return;
        }

        const { error } = await supabase
          .from("meta_integrations")
          .insert([{
            pixel_id: updates.pixel_id,
            access_token: updates.access_token,
            organization_id: metaOrgId!,
            created_by: profile?.id!,
            track_lead_qualificado: updates.track_lead_qualificado ?? true,
            track_lead_super_qualificado: updates.track_lead_super_qualificado ?? true,
            track_lead_comprou: updates.track_lead_comprou ?? true,
            track_lead_veio_loja: updates.track_lead_veio_loja ?? true,
            is_active: updates.is_active ?? true,
            test_mode: updates.test_mode ?? false,
          }]);

        if (error) throw error;
      }

      toast.success("Configurações salvas com sucesso!");
      await loadConfig();
    } catch (error: any) {
      console.error("Error saving Meta integration:", error);
      toast.error("Erro ao salvar configurações");
    }
  };

  const testConnection = async () => {
    if (!config?.pixel_id || !config?.access_token) {
      toast.error("Configure o Pixel ID e Access Token primeiro");
      return;
    }

    try {
      // Testar conexão fazendo uma chamada à API do Meta
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${config.pixel_id}?access_token=${config.access_token}&fields=id,name`
      );

      const data = await response.json();

      if (response.ok && data.id) {
        toast.success(`Conexão OK! Pixel: ${data.name || data.id}`);
      } else {
        const errorMsg = data.error?.message || "Desconhecido";
        const errorCode = data.error?.code || "";
        
        if (errorCode === 100 || errorMsg.includes("permission")) {
          toast.error("Token sem permissões necessárias. Certifique-se de que o token tem: ads_management e business_management", { duration: 6000 });
        } else {
          toast.error(`Erro na conexão: ${errorMsg}`);
        }
      }
    } catch (error: any) {
      toast.error("Erro ao testar conexão com Meta");
      console.error("Test connection error:", error);
    }
  };

  return {
    config,
    recentEvents,
    loading,
    saveConfig,
    testConnection,
    refreshEvents: loadRecentEvents,
  };
}
