import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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

function resolveApiUrl(): string {
  const env = import.meta.env.VITE_API_URL as string;
  if (env) return env;
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:3000';
    return `${protocol}//${hostname.replace('-web.', '-api.')}`;
  }
  return 'http://localhost:3000';
}

const OAUTH_REDIRECT_URI = `${resolveApiUrl()}/meta/oauth/callback`;
const OAUTH_SCOPES = ["leads_retrieval", "pages_read_engagement", "pages_manage_ads"].join(",");

export function useMetaOAuth() {
  const [account, setAccount] = useState<MetaAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const { profile, orgId } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const organizationId = profile?.organization_id || orgId;

  // Handle OAuth redirect result
  useEffect(() => {
    const metaParam = searchParams.get("meta");
    if (!metaParam) return;

    if (metaParam === "connected") {
      toast({ title: "Meta conectado com sucesso!" });
    } else if (metaParam === "error") {
      const reason = searchParams.get("reason") || "unknown";
      toast({ title: "Erro ao conectar Meta", description: `Motivo: ${reason}`, variant: "destructive" });
    }

    const newParams = new URLSearchParams(searchParams);
    newParams.delete("meta");
    newParams.delete("reason");
    setSearchParams(newParams, { replace: true });
  }, [searchParams]);

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
    setAccount(null);
    toast({ title: "Conta Meta desconectada" });
  }

  return { account, loading, initiateOAuth, disconnectMeta, refetch: () => {} };
}
