import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Build Evolution API request for a single recipient
function buildSendPayload(
  recipient: Record<string, any>,
  campaign: Record<string, any>,
  evolutionBaseUrl: string,
): { sendUrl: string; sendBody: Record<string, any> } {
  const phone = recipient.phone.replace(/\D/g, "");
  const payload = campaign.payload as Record<string, any>;
  const payloadType = campaign.payload_type as string;
  const campaignButtons = campaign.buttons as
    | Array<{ label: string; value: string }>
    | null;

  const renderText = (tpl: string) => {
    let t = tpl.replace(/\{\{nome\}\}/gi, recipient.name || "");
    const vars = (recipient.variables || {}) as Record<string, any>;
    for (const [k, v] of Object.entries(vars)) {
      t = t.replace(new RegExp(`\\{\\{${k}\\}\\}`, "gi"), String(v ?? ""));
    }
    return t;
  };

  if (payloadType === "interactive" && campaignButtons?.length) {
    // sendButtons nao funciona em conexoes QR-code (nao-oficial): mensagem
    // chega como "view-once" no desktop e nem aparece no celular.
    // Enviamos como texto numerado; respostas continuam sendo capturadas.
    const text = renderText(payload.text || "");
    const optionsText = campaignButtons
      .slice(0, 3)
      .map((b, i) => `${i + 1}. ${b.label}`)
      .join("\n");
    const fullText = `${text}\n\n${optionsText}\n\n_Responda com o número da opção desejada._`;
    return {
      sendUrl: `${evolutionBaseUrl}/message/sendText/${campaign.instance_name}`,
      sendBody: { number: phone, text: fullText },
    };
  }
  if (payloadType === "text" || payloadType === "interactive") {
    return {
      sendUrl: `${evolutionBaseUrl}/message/sendText/${campaign.instance_name}`,
      sendBody: { number: phone, text: renderText(payload.text || "") },
    };
  }
  if (payloadType === "image") {
    return {
      sendUrl: `${evolutionBaseUrl}/message/sendMedia/${campaign.instance_name}`,
      sendBody: {
        number: phone,
        mediatype: "image",
        media: payload.media_url,
        caption: payload.caption || "",
      },
    };
  }
  if (payloadType === "audio") {
    return {
      sendUrl: `${evolutionBaseUrl}/message/sendWhatsAppAudio/${campaign.instance_name}`,
      sendBody: { number: phone, audio: payload.audio_url, encoding: true },
    };
  }
  if (payloadType === "document") {
    return {
      sendUrl: `${evolutionBaseUrl}/message/sendMedia/${campaign.instance_name}`,
      sendBody: {
        number: phone,
        mediatype: "document",
        media: payload.media_url,
        fileName: payload.file_name || "documento",
        caption: payload.caption || "",
      },
    };
  }
  return {
    sendUrl: `${evolutionBaseUrl}/message/sendText/${campaign.instance_name}`,
    sendBody: { number: phone, text: "[mídia não suportada]" },
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const evolutionBaseUrl = Deno.env.get("EVOLUTION_BASE_URL");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!evolutionApiKey || !evolutionBaseUrl) {
      return respond(
        { error: "EVOLUTION_API_KEY ou EVOLUTION_BASE_URL não configurados" },
        500,
      );
    }

    const { campaign_id } = await req.json();
    if (!campaign_id) return respond({ error: "campaign_id é obrigatório" }, 400);

    // Fresh campaign state on every invocation
    const { data: campaign, error: cErr } = await supabase
      .from("broadcast_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (cErr || !campaign) return respond({ error: "Campanha não encontrada" }, 404);

    if (campaign.status !== "running") {
      return respond({ ok: true, skipped: true, reason: campaign.status });
    }

    const settings = campaign.settings as Record<string, any>;

    // ─── Time window (only checked when explicitly configured) ───────────────
    const windowStart: string | undefined = settings.windowStart;
    const windowEnd: string | undefined = settings.windowEnd;
    if (windowStart && windowEnd) {
      const utcOffset: number = settings.utcOffset ?? -3;
      const nowUtc = new Date();
      const lh = (nowUtc.getUTCHours() + utcOffset + 24) % 24;
      const lm = nowUtc.getUTCMinutes();
      const cur = `${String(lh).padStart(2, "0")}:${String(lm).padStart(2, "0")}`;
      if (cur < windowStart || cur >= windowEnd) {
        console.log(`[broadcast-worker] Outside window (${cur}), retry in 15min`);
        scheduleReInvoke(supabaseUrl, supabaseServiceKey, campaign_id, 15 * 60);
        return respond({ ok: true, outside_window: true });
      }
    }

    // ─── Rate limit (DB-based, survives across invocations) ──────────────────
    const limitPerHour: number = settings.limitPerHour || 500;
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count: sentLastHour } = await supabase
      .from("broadcast_recipients")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign_id)
      .eq("status", "sent")
      .gte("sent_at", oneHourAgo);

    if ((sentLastHour ?? 0) >= limitPerHour) {
      console.log(`[broadcast-worker] Rate limit (${sentLastHour}/${limitPerHour}/h), retry in 5min`);
      scheduleReInvoke(supabaseUrl, supabaseServiceKey, campaign_id, 5 * 60);
      return respond({ ok: true, rate_limited: true });
    }

    // ─── Fetch next batch of pending recipients ───────────────────────────────
    // batchSize controls how many messages are processed per invocation.
    // Higher = faster throughput; lower = more responsive pause/cancel.
    const batchSize: number = settings.batchSize || 10;

    const { data: recipients, error: rErr } = await supabase
      .from("broadcast_recipients")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (rErr) {
      console.error("[broadcast-worker] DB error:", rErr);
      return respond({ error: "DB error fetching recipients" }, 500);
    }

    if (!recipients || recipients.length === 0) {
      await supabase
        .from("broadcast_campaigns")
        .update({ status: "completed" })
        .eq("id", campaign_id);
      console.log(`[broadcast-worker] Campaign ${campaign_id} completed`);
      return respond({ ok: true, completed: true });
    }

    // Reserve the batch atomically before any sends
    await supabase
      .from("broadcast_recipients")
      .update({ status: "sending" })
      .in("id", recipients.map((r: { id: string }) => r.id));

    // ─── Process batch in background (keeps response time fast) ──────────────
    const minDelay: number = settings.minDelay ?? 1;
    const maxDelay: number = settings.maxDelay ?? 5;

    const processBatch = async () => {
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];

        // Abort early if campaign was paused/canceled mid-batch
        if (i > 0 && i % 5 === 0) {
          const { data: fresh } = await supabase
            .from("broadcast_campaigns")
            .select("status")
            .eq("id", campaign_id)
            .single();
          if (fresh?.status !== "running") {
            console.log(`[broadcast-worker] Campaign stopped mid-batch (${fresh?.status})`);
            // Release remaining 'sending' back to 'pending' so they can resume later
            const remaining = recipients.slice(i).map((r: { id: string }) => r.id);
            await supabase
              .from("broadcast_recipients")
              .update({ status: "pending" })
              .in("id", remaining);
            return;
          }
        }

        try {
          const { sendUrl, sendBody } = buildSendPayload(
            recipient,
            campaign,
            evolutionBaseUrl,
          );

          const res = await fetch(sendUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: evolutionApiKey,
            },
            body: JSON.stringify(sendBody),
          });

          const resData = await res.json();

          if (!res.ok) {
            await supabase
              .from("broadcast_recipients")
              .update({
                status: "failed",
                error: JSON.stringify(resData).substring(0, 500),
              })
              .eq("id", recipient.id);
            console.error(`[broadcast-worker] Failed ${recipient.phone} (${res.status}):`, resData);
          } else {
            const messageId = resData?.key?.id || resData?.messageId || null;
            await supabase
              .from("broadcast_recipients")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
                message_id: messageId,
              })
              .eq("id", recipient.id);
          }
        } catch (err) {
          await supabase
            .from("broadcast_recipients")
            .update({ status: "failed", error: String(err).substring(0, 500) })
            .eq("id", recipient.id);
          console.error(`[broadcast-worker] Exception for ${recipient.phone}:`, err);
        }

        // Delay between messages — skip after the last one in the batch
        if (i < recipients.length - 1 && maxDelay > 0) {
          const delay = minDelay + Math.random() * Math.max(0, maxDelay - minDelay);
          await sleep(delay * 1000);
        }
      }

      // Batch done — re-invoke immediately for the next batch (no inter-batch delay)
      scheduleReInvoke(supabaseUrl, supabaseServiceKey, campaign_id, 0);
    };

    // deno-lint-ignore no-explicit-any
    if (typeof (globalThis as any).EdgeRuntime !== "undefined") {
      // deno-lint-ignore no-explicit-any
      (globalThis as any).EdgeRuntime.waitUntil(processBatch());
    } else {
      processBatch().catch(console.error);
    }

    return respond({ ok: true, campaign_id, batch_size: recipients.length });
  } catch (err) {
    console.error("[broadcast-worker] Unhandled error:", err);
    return respond({ error: String(err) }, 500);
  }
});

// Re-invokes the worker after `delaySecs`. Use delay=0 for immediate re-invoke.
function scheduleReInvoke(
  supabaseUrl: string,
  serviceKey: string,
  campaignId: string,
  delaySecs: number,
) {
  const invoke = async () => {
    if (delaySecs > 0) await sleep(delaySecs * 1000);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/broadcast-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      if (!res.ok) {
        console.error(`[broadcast-worker] Re-invoke failed (${res.status}):`, await res.text());
      }
    } catch (err) {
      console.error("[broadcast-worker] Re-invoke error:", err);
    }
  };

  // deno-lint-ignore no-explicit-any
  if (typeof (globalThis as any).EdgeRuntime !== "undefined") {
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime.waitUntil(invoke());
  } else {
    invoke().catch(console.error);
  }
}
