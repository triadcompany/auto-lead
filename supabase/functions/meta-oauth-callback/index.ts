import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const appId = Deno.env.get("META_APP_ID")!;
  const appSecret = Deno.env.get("META_APP_SECRET")!;
  const redirectUri = Deno.env.get("META_REDIRECT_URI")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // contains org_id as base64 JSON
  const errorParam = url.searchParams.get("error");

  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://app.autolead.com.br";

  if (errorParam) {
    return Response.redirect(`${frontendUrl}/settings?tab=integrations&meta=error&reason=${errorParam}`);
  }

  if (!code || !state) {
    return Response.redirect(`${frontendUrl}/settings?tab=integrations&meta=error&reason=missing_params`);
  }

  let orgId: string;
  try {
    const decoded = JSON.parse(atob(state));
    orgId = decoded.org_id;
    if (!orgId) throw new Error("no org_id");
  } catch {
    return Response.redirect(`${frontendUrl}/settings?tab=integrations&meta=error&reason=invalid_state`);
  }

  try {
    // Exchange code for short-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Token exchange error:", tokenData.error);
      return Response.redirect(`${frontendUrl}/settings?tab=integrations&meta=error&reason=token_exchange`);
    }

    // Exchange short-lived for long-lived token (~60 days)
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&client_id=${appId}&` +
      `client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
    );
    const longTokenData = await longTokenRes.json();

    if (longTokenData.error) {
      console.error("Long-lived token error:", longTokenData.error);
      return Response.redirect(`${frontendUrl}/settings?tab=integrations&meta=error&reason=long_token`);
    }

    // Fetch user info
    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${longTokenData.access_token}`
    );
    const meData = await meRes.json();

    const expiresAt = longTokenData.expires_in
      ? new Date(Date.now() + longTokenData.expires_in * 1000).toISOString()
      : null;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Upsert meta_accounts (one per org)
    const { error: upsertError } = await supabase
      .from("meta_accounts")
      .upsert(
        {
          organization_id: orgId,
          meta_user_id: meData.id,
          meta_user_name: meData.name,
          access_token: longTokenData.access_token,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" }
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return Response.redirect(`${frontendUrl}/settings?tab=integrations&meta=error&reason=db`);
    }

    return Response.redirect(`${frontendUrl}/settings?tab=integrations&meta=connected`);
  } catch (err) {
    console.error("[meta-oauth-callback] Unexpected error:", err);
    return Response.redirect(`${frontendUrl}/settings?tab=integrations&meta=error&reason=unexpected`);
  }
});
