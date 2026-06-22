import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface MetaAccount {
  id: string;
  meta_user_id: string;
  meta_user_name: string | null;
  token_expires_at: string | null;
  created_at: string;
}

const META_APP_ID = import.meta.env.VITE_META_APP_ID as string;
const OAUTH_REDIRECT_URI = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-oauth-callback`;
const OAUTH_SCOPES = ["leads_retrieval", "pages_read_engagement", "pages_manage_ads"].join(",");

export function useMetaOAuth() {
  const [account, setAccount] = useState<MetaAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const { profile, orgId } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const organizationId = profile?.organization_id || orgId;

  useEffect(() => {
    if (organizationId) fetchAccount();
  }, [organizationId]);

  // Handle OAuth redirect result
  useEffect(() => {
    const metaParam = searchParams.get("meta");
    if (!metaParam) return;

    if (metaParam === "connected") {
      toast({ title: "Meta conectado com sucesso!" });
      fetchAccount();
    } else if (metaParam === "error") {
      const reason = searchParams.get("reason") || "unknown";
      toast({
        title: "Erro ao conectar Meta",
        description: `Motivo: ${reason}`,
        variant: "destructive",
      });
    }

    // Remove meta params from URL
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("meta");
    newParams.delete("reason");
    setSearchParams(newParams, { replace: true });
  }, [searchParams]);

  async function fetchAccount() {
    if (!organizationId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("meta_accounts")
        .select("id, meta_user_id, meta_user_name, token_expires_at, created_at")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (error) throw error;
      setAccount(data);
    } catch (err) {
      console.error("[useMetaOAuth] fetchAccount error:", err);
    } finally {
      setLoading(false);
    }
  }

  function initiateOAuth() {
    if (!organizationId) return;
    const state = btoa(JSON.stringify({ org_id: organizationId }));
    const url =
      `https://www.facebook.com/v19.0/dialog/oauth?` +
      `client_id=${META_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}` +
      `&scope=${OAUTH_SCOPES}` +
      `&state=${state}` +
      `&response_type=code`;
    window.location.href = url;
  }

  async function disconnectMeta() {
    if (!organizationId || !account) return;
    try {
      const { error } = await supabase
        .from("meta_accounts")
        .delete()
        .eq("organization_id", organizationId);
      if (error) throw error;
      setAccount(null);
      toast({ title: "Conta Meta desconectada" });
    } catch (err) {
      toast({ title: "Erro ao desconectar", variant: "destructive" });
    }
  }

  return { account, loading, initiateOAuth, disconnectMeta, refetch: fetchAccount };
}
