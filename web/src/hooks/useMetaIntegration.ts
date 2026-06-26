import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface MetaIntegration {
  id: string;
  pixelId: string;
  accessToken: string;
  trackLeadQualificado: boolean;
  trackLeadSuperQualificado: boolean;
  trackLeadComprou: boolean;
  trackLeadVeioLoja: boolean;
  isActive: boolean;
  testMode: boolean;
  // snake_case aliases kept for component compatibility
  pixel_id?: string;
  access_token?: string;
}

interface MetaEventLog {
  id: string;
  eventName: string;
  eventId: string;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
  leadId: string;
}

export function useMetaIntegration() {
  const { orgId: authOrgId, profile } = useAuth();
  const orgId = profile?.organization_id || authOrgId;
  const [config, setConfig] = useState<MetaIntegration | null>(null);
  const [recentEvents, setRecentEvents] = useState<MetaEventLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orgId) {
      loadConfig();
      loadRecentEvents();
    } else {
      setLoading(false);
    }
  }, [orgId]);

  const loadConfig = async () => {
    try {
      const integrations = await api.meta.integrations();
      const active = Array.isArray(integrations)
        ? (integrations.find((i: any) => i.isActive) || integrations[0] || null)
        : null;
      if (active) {
        setConfig({ ...active, pixel_id: active.pixelId, access_token: active.accessToken });
      } else {
        setConfig(null);
      }
    } catch (err: any) {
      console.error("Error loading Meta integration:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentEvents = async () => {
    try {
      const events = await api.meta.capiEvents();
      setRecentEvents(Array.isArray(events) ? events : []);
    } catch (err: any) {
      console.error("Error loading Meta events:", err);
    }
  };

  const saveConfig = async (updates: Partial<MetaIntegration> & { pixel_id?: string; access_token?: string }) => {
    try {
      const payload: Record<string, unknown> = { ...updates };
      if (updates.pixel_id) payload.pixelId = updates.pixel_id;
      if (updates.access_token) payload.accessToken = updates.access_token;
      delete payload.pixel_id;
      delete payload.access_token;

      if (config?.id) {
        await api.meta.updateIntegration(config.id, payload);
      } else {
        if (!payload.pixelId || !payload.accessToken) {
          toast.error("Pixel ID e Access Token são obrigatórios");
          return;
        }
        await api.meta.createIntegration({
          ...payload,
          trackLeadQualificado: payload.trackLeadQualificado ?? true,
          trackLeadSuperQualificado: payload.trackLeadSuperQualificado ?? true,
          trackLeadComprou: payload.trackLeadComprou ?? true,
          trackLeadVeioLoja: payload.trackLeadVeioLoja ?? true,
          isActive: payload.isActive ?? true,
          testMode: payload.testMode ?? false,
        });
      }
      toast.success("Configurações salvas com sucesso!");
      await loadConfig();
    } catch (err: any) {
      console.error("Error saving Meta integration:", err);
      toast.error("Erro ao salvar configurações");
    }
  };

  const testConnection = async () => {
    if (!config?.id) {
      toast.error("Configure o Pixel ID e Access Token primeiro");
      return;
    }
    try {
      const result = await api.meta.testConnection();
      if (result?.ok) {
        toast.success(`Conexão OK! Pixel: ${result.pixel_name}`);
      } else {
        toast.error(`Erro na conexão: ${result?.error || "Desconhecido"}`);
      }
    } catch (err: any) {
      toast.error("Erro ao testar conexão com Meta");
    }
  };

  return { config, recentEvents, loading, saveConfig, testConnection, refreshEvents: loadRecentEvents };
}
