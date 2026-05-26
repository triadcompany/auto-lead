import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-n8n-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ingestSecret = Deno.env.get("N8N_INGEST_SECRET");

    // Validate HMAC signature sent by N8N
    if (ingestSecret) {
      const signature = req.headers.get("x-n8n-signature");
      if (!signature) {
        return new Response(
          JSON.stringify({ error: "Missing x-n8n-signature header" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.clone().text();
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(ingestSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
      const expected = "sha256=" + Array.from(new Uint8Array(mac))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (signature !== expected) {
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const payload = await req.json();
    const { integration_id, lead_data } = payload;

    if (!integration_id || !lead_data) {
      return new Response(
        JSON.stringify({ error: "Missing integration_id or lead_data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Load integration config
    const { data: integration, error: intError } = await supabase
      .from("meta_integrations")
      .select("*, meta_accounts(organization_id)")
      .eq("id", integration_id)
      .eq("status", "active")
      .single();

    if (intError || !integration) {
      console.error("Integration not found or inactive:", intError);
      return new Response(
        JSON.stringify({ error: "Integration not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = integration.organization_id;
    const fieldMapping: Record<string, string> = integration.field_mapping || {};

    // Apply field mapping: Meta field name → CRM field name
    const mappedData: Record<string, string> = {};
    for (const [metaField, crmField] of Object.entries(fieldMapping)) {
      if (lead_data[metaField] !== undefined) {
        mappedData[crmField] = lead_data[metaField];
      }
    }

    // Resolve seller: use configured seller or fall back to first org member
    let sellerId = integration.seller_id;
    if (!sellerId) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", orgId)
        .limit(1);
      sellerId = profiles?.[0]?.id || null;
    }

    if (!sellerId) {
      return new Response(
        JSON.stringify({ error: "No sellers found for organization" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        organization_id: orgId,
        stage_id: integration.stage_id,
        seller_id: sellerId,
        created_by: sellerId,
        source: "meta_lead_ads",
        name: mappedData.name || lead_data.full_name || lead_data.name || "Lead Meta",
        phone: mappedData.phone || lead_data.phone_number || lead_data.phone || "",
        email: mappedData.email || lead_data.email || null,
        interest: mappedData.interest || null,
        observations: mappedData.observations || null,
      })
      .select()
      .single();

    if (leadError || !lead) {
      console.error("Error creating lead:", leadError);
      return new Response(
        JSON.stringify({ error: "Failed to create lead", details: leadError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_lead_at
    await supabase
      .from("meta_integrations")
      .update({ last_lead_at: new Date().toISOString() })
      .eq("id", integration_id);

    // Fire automation trigger
    try {
      await fetch(`${supabaseUrl}/functions/v1/automation-trigger`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          organization_id: orgId,
          trigger_type: "lead_created",
          entity_type: "lead",
          entity_id: lead.id,
          context: {
            lead_name: lead.name,
            lead_phone: lead.phone,
            lead_email: lead.email,
            source: "meta_lead_ads",
            stage_id: lead.stage_id,
            meta_integration_id: integration_id,
            meta_campaign_name: integration.campaign_name,
            meta_form_id: integration.meta_form_id,
          },
        }),
      });
    } catch (err) {
      console.error("[ingest-meta-lead] Failed to fire automation trigger:", err);
    }

    console.log(`[ingest-meta-lead] Lead ${lead.id} created for org ${orgId} via integration ${integration_id}`);

    return new Response(
      JSON.stringify({ success: true, lead_id: lead.id }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ingest-meta-lead] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
