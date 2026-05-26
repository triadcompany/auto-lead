import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

// Proxy for Meta Graph API calls — keeps access tokens server-side.
// Routes:
//   GET ?action=pages              → list pages with leads access
//   GET ?action=forms&page_id=X    → list lead forms for a page

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const orgId = url.searchParams.get("org_id");

  if (!orgId || !action) {
    return new Response(
      JSON.stringify({ error: "Missing org_id or action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Load access token for org
  const { data: account, error: accError } = await supabase
    .from("meta_accounts")
    .select("access_token")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (accError || !account) {
    return new Response(
      JSON.stringify({ error: "Meta account not connected for this organization" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = account.access_token;

  try {
    if (action === "pages") {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&access_token=${token}`
      );
      const data = await res.json();

      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ pages: data.data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "forms") {
      const pageId = url.searchParams.get("page_id");
      if (!pageId) {
        return new Response(
          JSON.stringify({ error: "Missing page_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get page access token
      const pageRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${token}`
      );
      const pageData = await pageRes.json();
      const pageToken = pageData.access_token || token;

      const formsRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?fields=id,name,status&access_token=${pageToken}`
      );
      const formsData = await formsRes.json();

      if (formsData.error) {
        return new Response(
          JSON.stringify({ error: formsData.error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ forms: formsData.data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "form_fields") {
      const formId = url.searchParams.get("form_id");
      if (!formId) {
        return new Response(
          JSON.stringify({ error: "Missing form_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(
        `https://graph.facebook.com/v19.0/${formId}?fields=questions&access_token=${token}`
      );
      const data = await res.json();

      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const questions = (data.questions || []).map((q: any) => ({
        key: q.key || q.type,
        label: q.label || q.type,
        type: q.type,
      }));

      return new Response(
        JSON.stringify({ fields: questions }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[meta-graph-proxy] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
