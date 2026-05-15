import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Clone request so we can read body multiple times
    const bodyText = await req.text();
    let parsedBody: any = {};
    try { parsedBody = JSON.parse(bodyText); } catch { /* not JSON */ }

    const event = parsedBody.event || parsedBody.action || "unknown";
    const instanceName = parsedBody.instance || parsedBody.instanceName || "unknown";

    // Extract remoteJid for logging
    const msgData = parsedBody.data || {};
    const msgArray = Array.isArray(msgData) ? msgData : [msgData];
    const firstMsg = msgArray[0] || {};
    const remoteJid = firstMsg?.key?.remoteJid || firstMsg?.remoteJid || null;

    // ──── PRE-AUTH LOGGING: Always log the event, even before token validation ────
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get("token");
    const tokenHeader = req.headers.get("x-webhook-secret");

    // Find integration by instance name to get per-org webhook_token
    const { data: integration } = await supabase
      .from("whatsapp_integrations")
      .select("id, organization_id, status, webhook_token, instance_name")
      .eq("instance_name", instanceName)
      .maybeSingle();

    const orgId = integration?.organization_id || null;
    const expectedToken = integration?.webhook_token || null;

    // ──── TOKEN VALIDATION (per-org token from DB) ────
    let authStatus = "ok";
    const globalSecret = Deno.env.get("EVOLUTION_WEBHOOK_SECRET");

    if (expectedToken) {
      if (tokenParam !== expectedToken && tokenHeader !== expectedToken) {
        if (globalSecret && (tokenParam === globalSecret || tokenHeader === globalSecret)) {
          authStatus = "ok_global_fallback";
        } else {
          authStatus = tokenParam ? "invalid_token" : "missing_token";
        }
      }
    } else if (globalSecret) {
      if (tokenParam !== globalSecret && tokenHeader !== globalSecret) {
        authStatus = tokenParam ? "invalid_token" : "missing_token";
      }
    }

    // Log EVERY event with auth status
    await logWebhookEvent(supabase, {
      instance_name: instanceName,
      event_type: event,
      remote_jid: remoteJid,
      detected_organization_id: orgId,
      processing_result: authStatus === "ok" || authStatus === "ok_global_fallback" ? "processing" : "auth_rejected",
      error_message: authStatus !== "ok" && authStatus !== "ok_global_fallback" ? `Auth failed: ${authStatus}` : null,
      auth_status: authStatus,
      payload: { event, instanceName, remoteJid, hasData: !!parsedBody.data },
    });

    // Update diagnostic fields on integration
    if (integration) {
      const diagUpdate: Record<string, unknown> = {
        last_webhook_event_at: new Date().toISOString(),
      };
      if (authStatus !== "ok" && authStatus !== "ok_global_fallback") {
        diagUpdate.last_webhook_error = `Auth failed: ${authStatus} at ${new Date().toISOString()}`;
      } else {
        diagUpdate.last_webhook_error = null;
      }
      await supabase.from("whatsapp_integrations").update(diagUpdate).eq("id", integration.id);
    }

    // If auth failed, attempt auto-repair then reject
    if (authStatus !== "ok" && authStatus !== "ok_global_fallback") {
      console.warn(`[evolution-webhook] Auth failed: ${authStatus} for instance=${instanceName}`);

      if (integration && expectedToken) {
        await attemptWebhookAutoRepair(supabaseUrl, integration.instance_name, expectedToken);
      }

      return respond({ ok: false, error: "unauthorized", auth_status: authStatus }, 401);
    }

    if (!integration) {
      console.log("[evolution-webhook] Unknown instance:", instanceName);
      return respond({ ok: true, message: "unknown instance" });
    }

    // ── CONNECTION UPDATE ──
    if (event === "CONNECTION_UPDATE" || event === "connection.update") {
      return await handleConnectionUpdate(supabase, parsedBody, integration);
    }

    // ── QR CODE UPDATE ──
    if (event === "QRCODE_UPDATED" || event === "qrcode.updated") {
      return await handleQrCodeUpdate(supabase, parsedBody, integration);
    }

    // ── MESSAGES (inbound + outbound) ──
    if (event === "MESSAGES_UPSERT" || event === "messages.upsert") {
      return await handleMessages(supabase, parsedBody, orgId!, instanceName);
    }

    // ── MESSAGE STATUS UPDATES ──
    if (event === "MESSAGES_UPDATE" || event === "messages.update") {
      return await handleMessageStatusUpdate(supabase, parsedBody, orgId!);
    }

    return respond({ ok: true });
  } catch (err) {
    console.error("[evolution-webhook] Error:", err);
    return respond({ ok: true });
  }
});

// ── AUTO-REPAIR: Re-register webhook URL in Evolution with correct per-org token ──
async function attemptWebhookAutoRepair(supabaseUrl: string, instanceName: string, token: string) {
  const evolutionBaseUrl = Deno.env.get("EVOLUTION_BASE_URL");
  const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
  if (!evolutionBaseUrl || !evolutionApiKey) {
    console.warn("[evolution-webhook] Cannot auto-repair: missing EVOLUTION_BASE_URL or EVOLUTION_API_KEY");
    return;
  }

  const correctUrl = `${supabaseUrl}/functions/v1/evolution-webhook?token=${encodeURIComponent(token)}`;
  console.log(`[evolution-webhook] AUTO-REPAIR: Updating webhook for instance=${instanceName}`);

  const endpoints = [
    { url: `${evolutionBaseUrl}/webhook/set/${instanceName}`, method: "POST" },
    { url: `${evolutionBaseUrl}/instance/update/${instanceName}`, method: "PUT" },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
        body: JSON.stringify({
          webhook: {
            url: correctUrl,
            enabled: true,
            webhookByEvents: true,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED", "MESSAGES_UPDATE"],
          },
        }),
      });
      const text = await res.text();
      console.log(`[evolution-webhook] AUTO-REPAIR ${ep.method}: HTTP ${res.status} | ${text.substring(0, 200)}`);
      if (res.ok) {
        console.log("[evolution-webhook] AUTO-REPAIR: Webhook URL fixed! Next event should succeed.");
        return;
      }
    } catch (err) {
      console.error(`[evolution-webhook] AUTO-REPAIR error (${ep.method}):`, err);
    }
  }
  console.warn("[evolution-webhook] AUTO-REPAIR: Could not update webhook via any endpoint");
}

// ── CONNECTION UPDATE handler ──
async function handleConnectionUpdate(supabase: any, body: any, integration: any) {
  const state = body.data?.state || body.state;
  let newStatus = "disconnected";
  let connectedAt: string | null = null;
  let phoneNumber: string | null = null;

  if (state === "open") {
    newStatus = "connected";
    connectedAt = new Date().toISOString();
    const rawPhone = body.data?.phoneNumber || body.data?.wid?.user || body.data?.owner || null;
    phoneNumber = rawPhone ? String(rawPhone).replace(/[^\d]/g, "") : null;
  } else if (state === "connecting") {
    newStatus = "qr_pending";
  } else if (state === "close") {
    newStatus = "disconnected";
  }

  // ──── Cross-org phone uniqueness guard ────
  // If a phone is now reported as connected and the SAME phone is already
  // connected on a DIFFERENT organization, we refuse to mark this one as
  // connected, tear down our Evolution instance, and mark our row as failed.
  if (newStatus === "connected" && phoneNumber) {
    const { data: dupe } = await supabase
      .from("whatsapp_integrations")
      .select("organization_id")
      .eq("phone_number", phoneNumber)
      .eq("status", "connected")
      .neq("organization_id", integration.organization_id)
      .maybeSingle();

    if (dupe) {
      console.warn(
        `[evolution-webhook] BLOCKED dupe phone=${phoneNumber} already on org=${dupe.organization_id}, refusing to connect on org=${integration.organization_id}`,
      );

      // Best-effort: logout + delete the instance on Evolution to free the WA session
      const evolutionBaseUrl = Deno.env.get("EVOLUTION_BASE_URL");
      const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
      if (evolutionBaseUrl && evolutionApiKey) {
        try {
          await fetch(`${evolutionBaseUrl}/instance/logout/${integration.instance_name}`, {
            method: "DELETE",
            headers: { apikey: evolutionApiKey },
          });
        } catch (e) {
          console.error("[evolution-webhook] dupe-guard logout failed:", e);
        }
        try {
          await fetch(`${evolutionBaseUrl}/instance/delete/${integration.instance_name}`, {
            method: "DELETE",
            headers: { apikey: evolutionApiKey },
          });
        } catch (e) {
          console.error("[evolution-webhook] dupe-guard delete failed:", e);
        }
      }

      await supabase
        .from("whatsapp_integrations")
        .update({
          status: "failed",
          is_active: false,
          qr_code_data: null,
          connected_at: null,
          phone_number: null,
          last_webhook_error: `Duplicate phone ${phoneNumber} already connected on org ${dupe.organization_id}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);

      return respond({ ok: false, status: "duplicate_phone" }, 409);
    }
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (connectedAt) {
    updateData.connected_at = connectedAt;
    updateData.qr_code_data = null;
    updateData.last_disconnected_at = null;
  }
  if (phoneNumber) updateData.phone_number = phoneNumber;
  if (newStatus === "disconnected") {
    updateData.qr_code_data = null;
    updateData.connected_at = null;
    updateData.phone_number = null;
    updateData.last_disconnected_at = new Date().toISOString();
  }

  await supabase
    .from("whatsapp_integrations")
    .update(updateData)
    .eq("id", integration.id);

  console.log(`[evolution-webhook] Connection updated: ${newStatus}`);
  return respond({ ok: true, status: newStatus });
}

// ── QR CODE UPDATE handler ──
async function handleQrCodeUpdate(supabase: any, body: any, integration: any) {
  const qrCode = body.data?.qrcode?.base64 || body.data?.base64 || null;
  if (qrCode) {
    await supabase
      .from("whatsapp_integrations")
      .update({ qr_code_data: qrCode, status: "qr_pending", updated_at: new Date().toISOString() })
      .eq("id", integration.id);
    console.log("[evolution-webhook] QR code updated");
  }
  return respond({ ok: true });
}

// ── MESSAGE STATUS UPDATE handler (delivered/read) ──
async function handleMessageStatusUpdate(supabase: any, body: any, orgId: string) {
  console.log("[evolution-webhook] Message status update received");
  return respond({ ok: true });
}

// ── Generate a unique trace_id ──
function generateTraceId(): string {
  return `tr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// ── MESSAGES handler (inbound + outbound) ──
async function handleMessages(supabase: any, body: any, orgId: string, instanceName: string) {
  const messages = body.data || [];
  const msgArray = Array.isArray(messages) ? messages : [messages];

  for (const msg of msgArray) {
    const isFromMe = msg.key?.fromMe === true;
    const remoteJid: string = msg.key?.remoteJid || "";
    const isGroup = remoteJid.endsWith("@g.us");
    // For groups: conversation key is the group JID (without @g.us); sender comes from `participant`
    const phone = isGroup
      ? remoteJid.replace("@g.us", "")
      : remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "");
    if (!phone) continue;

    // Group sender info (only meaningful for inbound group messages)
    const participantJid: string = msg.key?.participant || msg.participant || "";
    const senderPhone = participantJid
      ? participantJid.replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/\D/g, "")
      : (isFromMe ? "" : phone.replace(/\D/g, ""));
    const senderName = msg.pushName || msg.notifyName || msg.senderName || msg.profileName || null;

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || null;
    const isAudio = !!msg.message?.audioMessage;
    const isImage = !!msg.message?.imageMessage;
    const isVideo = !!msg.message?.videoMessage;
    const isDocument = !!msg.message?.documentMessage;
    const isSticker = !!msg.message?.stickerMessage;
    const mediaType = isImage ? "imagem"
      : isVideo ? "vídeo"
      : isAudio ? "áudio"
      : isDocument ? "documento"
      : isSticker ? "sticker"
      : null;
    const messageType = isAudio ? "audio" : isImage ? "image" : isVideo ? "video" : isDocument ? "document" : "text";
    const mediaCaption = msg.message?.imageMessage?.caption
      || msg.message?.videoMessage?.caption
      || msg.message?.documentMessage?.caption
      || null;
    const audioDurationMs = isAudio ? (msg.message?.audioMessage?.seconds || 0) * 1000 : null;
    const audioMimetype = isAudio ? (msg.message?.audioMessage?.mimetype || "audio/ogg") : null;
    const displayBody = text || (mediaType
      ? (mediaCaption ? `📎 (${mediaType}) ${mediaCaption}` : `📎 (${mediaType})`)
      : null);

    if (!displayBody) {
      console.log(`[evolution-webhook] Empty message from ${phone} — ignored`);
      continue;
    }

    const normalizedPhone = phone.replace(/[\s\-\+\(\)]/g, "");
    const now = new Date().toISOString();
    const pushName = msg.pushName || msg.notifyName || msg.senderName || msg.profileName || "";
    // For groups: prefix preview with sender name (e.g. "Thiago: Bom dia")
    const previewBase = (isGroup && !isFromMe && (senderName || senderPhone))
      ? `${senderName || senderPhone}: ${displayBody}`
      : displayBody;
    const messagePreview = previewBase.substring(0, 100);
    const externalMessageId = msg.key?.id || null;
    const direction = isFromMe ? "outbound" : "inbound";

    // Generate trace_id for this inbound message
    const traceId = !isFromMe ? generateTraceId() : "";

    if (!isFromMe) {
      console.log(`[INBOUND] trace_id=${traceId} org_id=${orgId} phone_raw=${phone} phone_normalized=${normalizedPhone} channel=whatsapp message_id=${externalMessageId} message_text=${(text || displayBody || "").substring(0, 80)} timestamp=${now}`);
    }

    // ── 1) UPSERT into conversations table ──
    let conversationId: string | null = null;

    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id, unread_count, contact_name, contact_name_source, profile_picture_url, profile_picture_updated_at")
      .eq("organization_id", orgId)
      .eq("instance_name", instanceName)
      .eq("contact_phone", normalizedPhone)
      .maybeSingle();

    const convUpdate: Record<string, unknown> = {
      last_message_at: now,
      last_message_preview: messagePreview,
    };

    if (existingConv) {
      conversationId = existingConv.id;
      if (!isFromMe) {
        convUpdate.unread_count = (existingConv.unread_count || 0) + 1;
      }
      if (isGroup) {
        // For groups, NEVER overwrite contact_name with the sender's pushName.
        convUpdate.is_group = true;
        const groupSubject =
          (typeof body?.data?.subject === "string" && body.data.subject) ||
          (typeof msg?.subject === "string" && msg.subject) ||
          null;
        if (groupSubject) {
          convUpdate.group_name = groupSubject;
          convUpdate.contact_name = groupSubject;
          convUpdate.contact_name_source = "whatsapp_group";
        } else if (
          !existingConv.contact_name ||
          existingConv.contact_name_source === "whatsapp" ||
          existingConv.contact_name_source === "group_fallback"
        ) {
          // Replace participant pushName / placeholder with a neutral fallback.
          const fallback = `Grupo (${normalizedPhone.slice(-4)})`;
          convUpdate.contact_name = fallback;
          convUpdate.contact_name_source = "group_fallback";
        }
      } else if (!isFromMe && pushName && pushName !== normalizedPhone) {
        // For 1:1 chats, pushName ONLY represents the contact when the
        // message is inbound. Outbound messages carry the user's own
        // profile name and must NOT overwrite the contact name.
        const currentName = existingConv.contact_name || "";
        const nameSource = existingConv.contact_name_source || "whatsapp";
        const nameIsPhoneOrEmpty = !currentName || currentName === normalizedPhone || currentName === phone;
        if (nameIsPhoneOrEmpty || nameSource === "whatsapp") {
          convUpdate.contact_name = pushName;
          convUpdate.contact_name_source = "whatsapp";
        }
      }
      await supabase.from("conversations").update(convUpdate).eq("id", conversationId);

      // For groups: if we still don't have the real subject, fetch it from Evolution (background).
      if (isGroup && existingConv.contact_name_source !== "whatsapp_group" && convUpdate.contact_name_source !== "whatsapp_group") {
        fetchAndSaveGroupName(supabase, instanceName, remoteJid, conversationId)
          .catch((e: unknown) => console.error("[evolution-webhook] group name fetch error:", e));
      }

      if (!isFromMe) {
        const picUpdatedAt = existingConv.profile_picture_updated_at;
        // Groups refresh sooner (~6h) since WhatsApp picture URLs expire in ~24h.
        const ttlMs = isGroup ? 6 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        const needsRefresh = !existingConv.profile_picture_url ||
          !picUpdatedAt ||
          (Date.now() - new Date(picUpdatedAt).getTime()) > ttlMs;
        if (needsRefresh) {
          // For groups, use the full JID; for individuals, the normalized phone.
          const target = isGroup ? remoteJid : normalizedPhone;
          fetchAndSaveProfilePicture(supabase, instanceName, target, conversationId, isGroup);
        }
      }
    } else {
      const inlineGroupSubject = isGroup
        ? ((typeof body?.data?.subject === "string" && body.data.subject) ||
           (typeof msg?.subject === "string" && msg.subject) ||
           null)
        : null;
      const groupFallback = isGroup ? `Grupo (${normalizedPhone.slice(-4)})` : null;
      const groupSubject = inlineGroupSubject || groupFallback;
      // For new 1:1 conversations: only persist pushName as contact_name
      // when it actually came from the contact (inbound message).
      const initialContactName = isGroup
        ? groupSubject
        : (!isFromMe && pushName ? pushName : null);
      const initialContactNameSource = isGroup
        ? (inlineGroupSubject ? "whatsapp_group" : "group_fallback")
        : (!isFromMe && pushName ? "whatsapp" : null);
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({
          organization_id: orgId,
          instance_name: instanceName,
          contact_phone: normalizedPhone,
          contact_name: initialContactName,
          contact_name_source: initialContactNameSource,
          last_message_at: now,
          last_message_preview: messagePreview,
          unread_count: isFromMe ? 0 : 1,
          assigned_to: null,
          is_group: isGroup,
          group_name: isGroup ? groupSubject : null,
        })
        .select("id")
        .single();

      conversationId = newConv?.id || null;
      console.log(`[evolution-webhook] Conversation created for ${normalizedPhone}: ${conversationId} (group=${isGroup})`);

      if (conversationId && !isFromMe && !isGroup) {
        fetchAndSaveProfilePicture(supabase, instanceName, normalizedPhone, conversationId);
      }
      if (conversationId && isGroup && !inlineGroupSubject) {
        fetchAndSaveGroupName(supabase, instanceName, remoteJid, conversationId)
          .catch((e: unknown) => console.error("[evolution-webhook] group name fetch error:", e));
      }
    }

    // ── 2) Save message ──
    if (conversationId && externalMessageId) {
      const { data: existingMsg } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("external_message_id", externalMessageId)
        .maybeSingle();

      if (!existingMsg) {
        let mediaUrl: string | null = null;
        if (isAudio && !isFromMe) {
          mediaUrl = await downloadAndUploadMedia(supabase, instanceName, externalMessageId, orgId, conversationId!);
        }

        await supabase.from("messages").insert({
          organization_id: orgId,
          conversation_id: conversationId,
          direction,
          body: displayBody,
          external_message_id: externalMessageId,
          message_type: messageType,
          media_url: mediaUrl,
          mime_type: audioMimetype,
          duration_ms: audioDurationMs,
          sender_name: !isFromMe ? (senderName || null) : null,
          sender_phone: !isFromMe ? (senderPhone || null) : null,
        });
      }
    } else if (conversationId) {
      await supabase.from("messages").insert({
        organization_id: orgId,
        conversation_id: conversationId,
        direction,
        body: displayBody,
        sender_name: !isFromMe ? (senderName || null) : null,
        sender_phone: !isFromMe ? (senderPhone || null) : null,
      });
    }

    // ── 3) AI AUTO: Enqueue job if ai_mode=auto + inbound ──
    if (!isFromMe && conversationId) {
      // Reset reply counter on every inbound
      await supabase.from("conversations")
        .update({ ai_reply_count_since_last_lead: 0 })
        .eq("id", conversationId);

      const { data: convCheck } = await supabase
        .from("conversations")
        .select("ai_mode, ai_state")
        .eq("id", conversationId)
        .single();

      console.log(`[evolution-webhook] AUTO check: conv=${conversationId} ai_mode=${convCheck?.ai_mode} ai_state=${convCheck?.ai_state}`);

      if (convCheck?.ai_mode === "auto" && convCheck?.ai_state !== "human_active") {
        // ════════════════════════════════════════════
        //  CHECK AUTONOMOUS RULES before enqueue
        // ════════════════════════════════════════════
        let shouldActivate = true;
        let skipReason = "";

        try {
          const { data: agentProfile } = await supabase
            .from("ai_agent_profiles")
            .select("autonomous_rules")
            .eq("organization_id", orgId)
            .eq("is_active", true)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();

          const rules = (agentProfile?.autonomous_rules as any) || { mode: "all" };

          if (rules.mode && rules.mode !== "all") {
            if (rules.mode === "unassigned_only") {
              const { data: convAssign } = await supabase
                .from("conversations")
                .select("assigned_to")
                .eq("id", conversationId)
                .single();
              if (convAssign?.assigned_to) {
                shouldActivate = false;
                skipReason = "assigned_lead (unassigned_only mode)";
              }
            } else if (rules.mode === "traffic_only" || rules.mode === "organic_only") {
              const { data: convLead } = await supabase
                .from("conversations")
                .select("lead_id")
                .eq("id", conversationId)
                .single();

              if (convLead?.lead_id) {
                const { data: lead } = await supabase
                  .from("leads")
                  .select("source")
                  .eq("id", convLead.lead_id)
                  .single();

                const source = (lead?.source || "").toLowerCase();
                const isTraffic = source.includes("meta") || source.includes("google") || source.includes("ads") || source.includes("tráfego");

                if (rules.mode === "traffic_only" && !isTraffic) {
                  shouldActivate = false;
                  skipReason = "organic_lead (traffic_only mode)";
                } else if (rules.mode === "organic_only" && isTraffic) {
                  shouldActivate = false;
                  skipReason = "traffic_lead (organic_only mode)";
                }
              }
            }
          }
        } catch (ruleErr) {
          console.error("[evolution-webhook] Autonomous rules check error:", ruleErr);
        }

        if (shouldActivate) {
          const idempotencyKey = `${orgId}:${conversationId}:${externalMessageId || now}`;

          await supabase.from("ai_auto_reply_jobs").insert({
            organization_id: orgId,
            conversation_id: conversationId,
            inbound_message_id: externalMessageId || "unknown",
            idempotency_key: idempotencyKey,
          });

          console.log(`[evolution-webhook] AI auto-reply job enqueued for conv=${conversationId}`);
          invokeAutoReplyWorker();
        } else {
          console.log(`[evolution-webhook] AI auto-reply SKIPPED for conv=${conversationId}: ${skipReason}`);
        }
      }
    }

    // ── 4) Inbound-specific: threads, lead matching, first-message event ──
    if (!isFromMe && conversationId) {
      // Thread management
      const { data: existingThread } = await supabase
        .from("whatsapp_threads")
        .select("id")
        .eq("organization_id", orgId)
        .eq("contact_phone", normalizedPhone)
        .maybeSingle();

      let threadId = existingThread?.id || null;

      if (existingThread) {
        await supabase.from("whatsapp_threads").update({
          last_message_at: now,
          last_message_preview: messagePreview,
          unread_count: supabase.rpc ? 1 : 1,
        }).eq("id", existingThread.id);
      } else {
        const { data: newThread } = await supabase
          .from("whatsapp_threads")
          .insert({
            organization_id: orgId,
            instance_name: instanceName,
            contact_phone: normalizedPhone,
            contact_name: pushName || null,
            status: "open",
            last_message_at: now,
            last_message_preview: messagePreview,
            unread_count: 1,
            routing_bucket: containsAdMarker(text || "") ? "traffic" : "non_traffic",
            first_message_text: (text || "").substring(0, 500),
            first_message_at: now,
          })
          .select("id")
          .single();

        threadId = newThread?.id || null;
        console.log(`[evolution-webhook] Thread created for ${normalizedPhone}: ${threadId}`);
      }

      await supabase.from("whatsapp_messages").insert({
        organization_id: orgId,
        instance_name: instanceName,
        thread_id: threadId,
        direction: "inbound",
        phone: normalizedPhone,
        message_text: text || displayBody,
        status: "delivered",
        external_message_id: externalMessageId,
        metadata: { pushName, timestamp: msg.messageTimestamp },
      });

      console.log(`[evolution-webhook] Inbound message saved: phone=${normalizedPhone} conv=${conversationId} thread=${threadId}`);

      // ── 5) Lead matching & engagement ──
      const phoneVariants = [
        normalizedPhone,
        normalizedPhone.startsWith("55") ? normalizedPhone.substring(2) : `55${normalizedPhone}`,
      ];

      let leadId: string | null = null;
      for (const variant of phoneVariants) {
        const { data: lead } = await supabase
          .from("leads")
          .select("id")
          .eq("organization_id", orgId)
          .eq("phone", variant)
          .maybeSingle();
        if (lead) { leadId = lead.id; break; }
      }

      if (leadId) {
        await supabase.from("leads").update({
          updated_at: now,
        }).eq("id", leadId);

        // Link conversation to existing lead (if not already linked)
        if (conversationId) {
          const { data: convForLink } = await supabase
            .from("conversations")
            .select("lead_id")
            .eq("id", conversationId)
            .single();

          if (!convForLink?.lead_id) {
            await supabase.from("conversations")
              .update({ lead_id: leadId })
              .eq("id", conversationId);
            console.log(`[evolution-webhook] Linked conversation ${conversationId} to existing lead ${leadId}`);
          }
        }

        await wakePausedRuns(supabase, orgId, leadId, now);
        console.log(`[evolution-webhook] Linked to lead ${leadId}`);
      }

      // ── 5b) Broadcast response attribution ──
      await matchBroadcastResponse(supabase, orgId, normalizedPhone, instanceName, externalMessageId, text || displayBody, msg);

      // ── 6) Publish inbound_first_message event to Event Bus ──
      const eventPublished = await publishFirstMessageEvent(
        supabase, orgId, normalizedPhone, pushName,
        text || displayBody, conversationId, "whatsapp", traceId
      );

      // Only run legacy keyword lead creation if Event Bus did NOT fire
      if (!eventPublished && !leadId) {
        await handleAdKeywordLead(supabase, orgId, normalizedPhone, pushName, externalMessageId, conversationId);
      } else if (eventPublished) {
        console.log(`[evolution-webhook] Event Bus handled first-message for ${normalizedPhone} — skipping legacy handleAdKeywordLead`);
      }

      // ── 7) Auto-create lead if still no lead linked ──
      if (!leadId && conversationId) {
        // Re-check if lead was created by handleAdKeywordLead or event bus
        const { data: convAfter } = await supabase
          .from("conversations")
          .select("lead_id")
          .eq("id", conversationId)
          .single();

        if (!convAfter?.lead_id) {
          leadId = await autoCreateLeadAndOpportunity(
            supabase, orgId, normalizedPhone, pushName, text || displayBody, conversationId, instanceName
          );
        } else {
          leadId = convAfter.lead_id;
        }
      }
    } else if (isFromMe) {
      // ── Outbound from WhatsApp ──
      if (conversationId && externalMessageId) {
        const { data: existingOutMsg } = await supabase
          .from("messages")
          .select("id, ai_generated")
          .eq("conversation_id", conversationId)
          .eq("external_message_id", externalMessageId)
          .maybeSingle();

        const isAiMessage = existingOutMsg?.ai_generated === true;

        if (!isAiMessage) {
          const { data: convForHuman } = await supabase
            .from("conversations")
            .select("ai_mode")
            .eq("id", conversationId)
            .single();

          if (convForHuman?.ai_mode === "auto") {
            await supabase.from("conversations")
              .update({ ai_state: "human_active" })
              .eq("id", conversationId);
            console.log(`[evolution-webhook] Human sent message — ai_state set to human_active for conv=${conversationId}`);
          }
        } else {
          console.log(`[evolution-webhook] Outbound is AI-generated — skipping human takeover for conv=${conversationId}`);
        }
      }

      console.log(`[evolution-webhook] Outbound message saved: phone=${normalizedPhone} conv=${conversationId}`);
    }
  }

  await invokeWorker();
  return respond({ ok: true });
}

// ── Helper: Match inbound message to broadcast recipient (response attribution) ──
async function matchBroadcastResponse(
  supabase: any, orgId: string, phone: string, instanceName: string,
  externalMessageId: string | null, messageText: string, rawMsg?: any
) {
  try {
    // Detect button response: Evolution sends buttonResponseMessage or buttonsResponseMessage
    let buttonValue: string | null = null;
    if (rawMsg) {
      const btnResp = rawMsg.message?.buttonsResponseMessage
        || rawMsg.message?.buttonReplyMessage
        || rawMsg.message?.templateButtonReplyMessage;
      if (btnResp) {
        buttonValue = btnResp.selectedButtonId || btnResp.selectedId || btnResp.id || null;
      }
    }

    // Find the latest pending broadcast recipient for this phone
    const { data: recipients, error } = await supabase
      .from("broadcast_recipients")
      .select("id, campaign_id, sent_at, broadcast_campaigns!inner(id, instance_name, response_window_hours, automation_id, organization_id)")
      .eq("organization_id", orgId)
      .eq("phone", phone)
      .eq("response_received", false)
      .in("status", ["sent", "delivered", "read"])
      .order("sent_at", { ascending: false })
      .limit(10);

    if (error || !recipients || recipients.length === 0) return;

    const now = new Date();
    for (const r of recipients) {
      const campaign = r.broadcast_campaigns;
      if (!campaign) continue;
      if (campaign.instance_name !== instanceName) continue;
      const sentAt = new Date(r.sent_at);
      const windowMs = (campaign.response_window_hours || 24) * 3600000;
      if (now.getTime() - sentAt.getTime() > windowMs) continue;

      // Found a match — mark as responded with inbound context
      await supabase.from("broadcast_recipients").update({
        response_received: true,
        response_at: now.toISOString(),
        response_message_id: externalMessageId || null,
        inbound_text: messageText || null,
        inbound_button_value: buttonValue || null,
      }).eq("id", r.id);

      console.log(`[evolution-webhook] Broadcast response matched: recipient=${r.id} campaign=${r.campaign_id} phone=${phone} button=${buttonValue || "none"}`);

      // Trigger automation if configured
      if (campaign.automation_id) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const triggerPayload = {
          organization_id: orgId,
          trigger_type: "broadcast_response",
          entity_type: "broadcast_recipient",
          entity_id: r.id,
          context: {
            campaign_id: r.campaign_id,
            recipient_id: r.id,
            recipient_phone: phone,
            inbound_message_text: messageText,
            inbound_button_value: buttonValue,
            instance_name: instanceName,
            automation_id: campaign.automation_id,
          },
        };
        fetch(`${supabaseUrl}/functions/v1/automation-trigger`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify(triggerPayload),
        }).catch(err => console.error(`[evolution-webhook] Broadcast automation trigger error:`, err));
      }

      // Only match one recipient (the most recent pending)
      break;
    }
  } catch (err) {
    console.error("[evolution-webhook] matchBroadcastResponse error:", err);
  }
}

// ── Helper: Invoke ai-auto-reply worker (fire-and-forget) ──
function invokeAutoReplyWorker() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(`${supabaseUrl}/functions/v1/ai-auto-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({}),
  }).catch(err => console.error("[evolution-webhook] Failed to invoke ai-auto-reply:", err));
}

// ── Helper: Fetch profile picture from Evolution API ──
// Falls back to `group/findGroupInfos` for groups when the chat endpoint fails.
// Only writes `profile_picture_updated_at` when a URL was obtained, so failed
// lookups retry on the next inbound message instead of waiting the TTL window.
async function fetchAndSaveProfilePicture(
  supabase: any,
  instanceName: string,
  phone: string,
  conversationId: string,
  isGroup = false,
) {
  try {
    const evolutionBaseUrl = Deno.env.get("EVOLUTION_BASE_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionBaseUrl || !evolutionApiKey) return;

    let pictureUrl: string | null = null;

    try {
      const res = await fetch(`${evolutionBaseUrl}/chat/fetchProfilePictureUrl/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
        body: JSON.stringify({ number: phone }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({} as any));
        pictureUrl = data?.profilePictureUrl || data?.pictureUrl || data?.imgUrl || null;
      } else {
        console.log(`[evolution-webhook] Profile picture fetch failed for ${phone}: ${res.status}`);
      }
    } catch (innerErr) {
      console.log(`[evolution-webhook] Profile picture fetch error for ${phone}:`, innerErr);
    }

    // Group fallback: try findGroupInfos which sometimes returns `pictureUrl`.
    if (!pictureUrl && isGroup) {
      try {
        const url = `${evolutionBaseUrl}/group/findGroupInfos/${instanceName}?groupJid=${encodeURIComponent(phone)}`;
        const res = await fetch(url, {
          method: "GET",
          headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({} as any));
          const node = Array.isArray(data) ? data[0] : data;
          pictureUrl = node?.pictureUrl || node?.profilePictureUrl || node?.profilePicUrl || null;
        }
      } catch (gErr) {
        console.log(`[evolution-webhook] Group picture fallback error for ${phone}:`, gErr);
      }
    }

    if (pictureUrl) {
      await supabase
        .from("conversations")
        .update({
          profile_picture_url: pictureUrl,
          profile_picture_updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
      console.log(`[evolution-webhook] Profile picture saved for ${phone}`);
    } else {
      console.log(`[evolution-webhook] No picture available for ${phone} (will retry next message)`);
    }
  } catch (err) {
    console.log(`[evolution-webhook] Profile picture fetch error for ${phone}:`, err);
  }
}

// ── Helper: Fetch group name (subject) from Evolution API ──
async function fetchAndSaveGroupName(
  supabase: any,
  instanceName: string,
  groupJid: string,
  conversationId: string,
): Promise<void> {
  try {
    const evolutionBaseUrl = Deno.env.get("EVOLUTION_BASE_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionBaseUrl || !evolutionApiKey) return;

    const url = `${evolutionBaseUrl}/group/findGroupInfos/${instanceName}?groupJid=${encodeURIComponent(groupJid)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
    });
    if (!res.ok) {
      console.warn(`[evolution-webhook] findGroupInfos failed for ${groupJid}: ${res.status}`);
      return;
    }
    const data = await res.json().catch(() => ({} as any));
    const node = Array.isArray(data) ? data[0] : data;
    const subject: string | null = node?.subject || node?.name || node?.groupSubject || null;
    if (subject) {
      await supabase
        .from("conversations")
        .update({
          group_name: subject,
          contact_name: subject,
          contact_name_source: "whatsapp_group",
        })
        .eq("id", conversationId);
      console.log(`[evolution-webhook] Group name saved: "${subject}" for conv ${conversationId}`);
    } else {
      console.log(`[evolution-webhook] No subject in findGroupInfos response for ${groupJid}`);
    }
  } catch (err) {
    console.error(`[evolution-webhook] fetchAndSaveGroupName error for ${groupJid}:`, err);
  }
}
// Returns true if event was published (= eligible first_message automations exist).
//
// Dedup strategy (two-tier):
//   • Non-keyword automations (has_keyword_trigger=false): global whatsapp_first_touch.
//     Inserted here BEFORE publishing to prevent race conditions on rapid messages.
//   • Keyword automations (has_keyword_trigger=true): per-automation automation_first_contacts.
//     NOT inserted here — the event-dispatcher inserts it only after keyword match,
//     so contacts whose first message misses the keyword can still trigger the automation later.
async function publishFirstMessageEvent(
  supabase: any,
  orgId: string,
  phone: string,
  pushName: string,
  messageBody: string,
  conversationId: string | null,
  channel: string,
  traceId: string,
): Promise<boolean> {
  try {
    // ── Load all active first_message automations (with dedup-strategy flag) ──
    const { data: automations } = await supabase
      .from("automations")
      .select("id, has_keyword_trigger")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .eq("trigger_type", "first_message");

    if (!automations || automations.length === 0) {
      console.log(`[FIRST_TOUCH_DECISION] trace_id=${traceId} will_fire_first_message_event=false reason=no_active_first_message_automations`);
      return false;
    }

    const noKeywordAutomations = automations.filter((a: any) => !a.has_keyword_trigger);
    const keywordAutomations   = automations.filter((a: any) =>  a.has_keyword_trigger);

    // ── Dedup: non-keyword automations use global whatsapp_first_touch ──
    let noKeywordEligible = noKeywordAutomations.length > 0;
    if (noKeywordEligible) {
      const { data: existing } = await supabase
        .from("whatsapp_first_touch")
        .select("id")
        .eq("organization_id", orgId)
        .eq("phone", phone)
        .maybeSingle();

      console.log(`[FIRST_TOUCH_CHECK] trace_id=${traceId} org_id=${orgId} phone_normalized=${phone} exists_before=${!!existing}`);

      if (existing) {
        noKeywordEligible = false; // global dedup already fired for this contact
      } else {
        // Pre-insert now to prevent race condition on rapid successive messages
        const { error: ftInsertErr } = await supabase.from("whatsapp_first_touch").insert({
          organization_id: orgId,
          phone,
          first_message_id: traceId,
        });
        if (ftInsertErr) {
          if (ftInsertErr.code === "23505") {
            console.log(`[FIRST_TOUCH_DECISION] trace_id=${traceId} first_touch_race_condition=true — no-keyword automations excluded`);
            noKeywordEligible = false;
          } else {
            console.error(`[evolution-webhook] First-touch insert error:`, ftInsertErr);
            // Continue — event-dispatcher has fallback dedup
          }
        }
      }
    }

    // ── Dedup: keyword automations use per-automation automation_first_contacts ──
    // We only exclude automations that have ALREADY fired for this phone.
    // If none have fired yet, all keyword automations are eligible — the
    // event-dispatcher will do the actual keyword match and insert the record.
    let keywordEligibleCount = 0;
    if (keywordAutomations.length > 0) {
      const automationIds = keywordAutomations.map((a: any) => a.id);
      const { data: alreadyFired } = await supabase
        .from("automation_first_contacts")
        .select("automation_id")
        .eq("organization_id", orgId)
        .eq("phone", phone)
        .in("automation_id", automationIds);

      const firedIds = new Set((alreadyFired || []).map((r: any) => r.automation_id));
      keywordEligibleCount = keywordAutomations.filter((a: any) => !firedIds.has(a.id)).length;

      console.log(`[FIRST_TOUCH_CHECK] trace_id=${traceId} keyword_automations=${keywordAutomations.length} already_fired=${firedIds.size} eligible=${keywordEligibleCount}`);
    }

    if (!noKeywordEligible && keywordEligibleCount === 0) {
      console.log(`[FIRST_TOUCH_DECISION] trace_id=${traceId} will_fire_first_message_event=false reason=all_automations_already_deduped`);
      return false;
    }

    console.log(`[FIRST_TOUCH_DECISION] trace_id=${traceId} will_fire_first_message_event=true no_keyword_eligible=${noKeywordEligible} keyword_eligible=${keywordEligibleCount}`);

    // Publish event to Event Bus
    // Use per-message idempotency key so keyword automations can re-evaluate on each message.
    const idempotencyKey = `${orgId}:inbound.first_message:${phone}:${traceId}`;

    const { data: eventData, error: eventErr } = await supabase
      .from("automation_events")
      .insert({
        organization_id: orgId,
        event_name: "inbound.first_message",
        entity_type: "conversation",
        entity_id: conversationId || phone,
        conversation_id: conversationId,
        payload: {
          phone,
          contact_name: pushName || null,
          message_body: messageBody || "",
          channel,
          trace_id: traceId,
        },
        source: "system",
        idempotency_key: idempotencyKey,
        status: "pending",
      })
      .select("id")
      .single();

    if (eventErr) {
      if (eventErr.code === "23505") {
        console.log(`[EVENT_PUBLISH_SKIP] trace_id=${traceId} reason=idempotent_duplicate`);
      } else {
        console.error(`[EVENT_PUBLISH_SKIP] trace_id=${traceId} reason=db_error error=${eventErr.message}`);
      }
      return false;
    }

    const eventId = eventData?.id || "unknown";
    console.log(`[EVENT_PUBLISH] trace_id=${traceId} event_type=inbound.first_message event_id=${eventId} payload={org_id=${orgId}, phone=${phone}, channel=${channel}, message_text=${(messageBody || "").substring(0, 50)}}`);

    // Persist initial execution trace
    await supabase.from("automation_executions").insert({
      organization_id: orgId,
      trace_id: traceId,
      event_name: "inbound.first_message",
      automation_event_id: eventId,
      phone,
      channel,
      message_text: (messageBody || "").substring(0, 500),
      status: "event_published",
      debug_json: {
        first_touch_exists_before: false,
        event_published: true,
        event_id: eventId,
        active_automations_count: automations.length,
        timestamp: new Date().toISOString(),
      },
    }).catch(() => {}); // non-critical

    // Fire-and-forget: invoke event-dispatcher
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    fetch(`${supabaseUrl}/functions/v1/event-dispatcher`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({}),
    }).catch(() => {});

    return true;
  } catch (err) {
    console.error(`[EVENT_PUBLISH_SKIP] trace_id=${traceId} reason=exception error=${err}`);
    return false;
  }
}

// ── Helper: Check ad marker ──
function containsAdMarker(text: string): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized.includes("anuncio");
}

// ── Helper: Handle ad keyword lead with first-touch dedup + keyword rules ──
async function handleAdKeywordLead(
  supabase: any,
  orgId: string,
  phone: string,
  pushName: string,
  messageId: string | null,
  conversationId: string | null,
) {
  try {
    // 0) First-touch dedup
    const { data: existing } = await supabase
      .from("whatsapp_first_touch")
      .select("id")
      .eq("organization_id", orgId)
      .eq("phone", phone)
      .maybeSingle();

    if (existing) {
      console.log(`[evolution-webhook] First-touch already exists for ${phone} — skipping lead creation`);
      return;
    }

    // 1) Fetch keyword rules from automation_keyword_rules table (priority desc)
    const { data: keywordRules } = await supabase
      .from("automation_keyword_rules")
      .select("*")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("priority", { ascending: false });

    // 2) Also check legacy systems
    const { data: kwAutomation } = await supabase
      .from("automations")
      .select("id, is_active, trigger_event_name")
      .eq("organization_id", orgId)
      .eq("trigger_type", "inbound_message_keyword")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const { data: settings } = await supabase
      .from("organization_automation_settings")
      .select("meta_ads_keyword_enabled, meta_ads_pipeline_id, meta_ads_stage_id")
      .eq("organization_id", orgId)
      .maybeSingle();

    const legacyEnabled = settings?.meta_ads_keyword_enabled !== false;

    // 3) Get the message text
    let messageText = "";
    if (conversationId) {
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("body")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      messageText = lastMsg?.body || "";
    }

    const normalizedText = messageText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 4) Try matching keyword rules first
    let matchedRule: any = null;
    if (keywordRules && keywordRules.length > 0) {
      for (const rule of keywordRules) {
        if (!rule.create_lead) continue;
        const kw = (rule.keyword || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let matched = false;
        switch (rule.match_type) {
          case "equals": matched = normalizedText === kw; break;
          case "starts_with": matched = normalizedText.startsWith(kw); break;
          case "contains": default: matched = normalizedText.includes(kw); break;
        }
        if (matched) { matchedRule = rule; break; }
      }
    }

    // 5) If no keyword rule matched, fall back to legacy "anuncio" check
    if (!matchedRule) {
      const hasAnuncio = normalizedText.includes("anuncio");
      if (!hasAnuncio) {
        console.log(`[evolution-webhook] No keyword rule matched and no 'anuncio' detected for ${phone}`);
        return;
      }
      if (!kwAutomation?.is_active && !legacyEnabled) {
        console.log(`[evolution-webhook] Legacy keyword automation disabled for org ${orgId}`);
        return;
      }
    }

    // 6) Insert first-touch
    const { error: ftErr } = await supabase.from("whatsapp_first_touch").insert({
      organization_id: orgId,
      phone,
      first_message_id: messageId,
    });
    if (ftErr && ftErr.code === "23505") {
      console.log(`[evolution-webhook] First-touch race condition for ${phone} — skipping`);
      return;
    }

    // 7) Resolve pipeline + stage
    let pipelineId: string | null = null;
    let stageId: string | null = null;
    let leadSource = "Meta Ads";

    if (matchedRule) {
      pipelineId = matchedRule.pipeline_id;
      stageId = matchedRule.stage_id;
      leadSource = matchedRule.lead_source || "Meta Ads";
      console.log(`[evolution-webhook] Matched keyword rule: "${matchedRule.name}" (keyword="${matchedRule.keyword}", match_type=${matchedRule.match_type})`);
    } else if (kwAutomation) {
      const { data: flow } = await supabase
        .from("automation_flows")
        .select("nodes")
        .eq("automation_id", kwAutomation.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (flow?.nodes) {
        const actionNode = (flow.nodes as any[]).find(
          (n: any) => n.type === "action" && n.data?.config?.actionType === "create_lead"
        );
        if (actionNode?.data?.config?.params) {
          pipelineId = actionNode.data.config.params.pipeline_id || null;
          stageId = actionNode.data.config.params.stage_id || null;
        }
      }
    }

    // Fallback to legacy settings
    if (!pipelineId) pipelineId = settings?.meta_ads_pipeline_id || null;
    if (!stageId && pipelineId === settings?.meta_ads_pipeline_id) stageId = settings?.meta_ads_stage_id || null;

    // Resolve defaults
    if (!pipelineId) {
      const { data: defPipeline } = await supabase
        .from("pipelines")
        .select("id")
        .eq("organization_id", orgId)
        .eq("is_default", true)
        .eq("is_active", true)
        .maybeSingle();
      pipelineId = defPipeline?.id || null;

      if (!pipelineId) {
        const { data: anyPipeline } = await supabase
          .from("pipelines")
          .select("id")
          .eq("organization_id", orgId)
          .eq("is_active", true)
          .order("created_at")
          .limit(1)
          .maybeSingle();
        pipelineId = anyPipeline?.id || null;
      }
    }

    if (pipelineId && !stageId) {
      const { data: stagesData } = await supabase
        .from("pipeline_stages")
        .select("id, name, position")
        .eq("pipeline_id", pipelineId)
        .eq("is_active", true)
        .order("position");

      if (stagesData && stagesData.length > 0) {
        const novoLead = stagesData.find((s: any) =>
          s.name.toLowerCase().replace(/[^a-z]/g, "").includes("novo")
        );
        stageId = novoLead?.id || stagesData[0].id;
      }
    }

    // 8) Create lead
    const leadData: Record<string, unknown> = {
      organization_id: orgId,
      name: pushName || "Lead WhatsApp",
      phone,
      source: leadSource,
      observations: matchedRule
        ? `Keyword rule: ${matchedRule.name} (${matchedRule.keyword})`
        : "WhatsApp keyword: anuncio",
    };
    if (stageId) leadData.stage_id = stageId;

    const { data: newLead, error: adLeadErr } = await supabase
      .from("leads")
      .insert(leadData)
      .select("id")
      .single();

    if (adLeadErr) {
      console.error(`[evolution-webhook] Ad lead creation failed:`, adLeadErr);
    } else {
      const ruleInfo = matchedRule ? `rule="${matchedRule.name}"` : (kwAutomation?.id ? `automationId=${kwAutomation.id}` : "legacy");
      console.log(`[evolution-webhook] ✅ Ad lead auto-created: phone=${phone} lead=${newLead?.id} pipeline=${pipelineId} stage=${stageId} source=${leadSource} ${ruleInfo}`);

      // Link conversation to lead
      if (conversationId && newLead?.id) {
        await supabase
          .from("conversations")
          .update({ lead_id: newLead.id })
          .eq("id", conversationId);

        // Create opportunity in pipeline
        if (pipelineId) {
          await supabase.from("opportunities").insert({
            organization_id: orgId,
            lead_id: newLead.id,
            pipeline_id: pipelineId,
            stage_id: stageId,
            source: leadSource,
            source_detail: `Keyword: ${matchedRule?.keyword || 'anuncio'}`,
            status: "open",
          }).catch((e: any) => console.error("[evolution-webhook] Opportunity creation failed:", e));
        }

        // Apply distribution
        const isTraffic = leadSource.toLowerCase().includes("meta") || leadSource.toLowerCase().includes("ads");
        await applyLeadDistribution(supabase, orgId, newLead.id, conversationId, isTraffic ? "traffic" : "non_traffic");
      }

      // Log execution
      if (matchedRule) {
        await supabase.from("automation_logs").insert({
          organization_id: orgId,
          level: "info",
          message: `Lead criado por regra de palavra-chave: ${matchedRule.name}`,
          data: {
            phone,
            lead_id: newLead?.id,
            pipeline_id: pipelineId,
            stage_id: stageId,
            rule_id: matchedRule.id,
            keyword: matchedRule.keyword,
            match_type: matchedRule.match_type,
            lead_source: leadSource,
          },
        });
      } else if (kwAutomation) {
        await supabase.from("automation_logs").insert({
          organization_id: orgId,
          automation_id: kwAutomation.id,
          level: "info",
          message: `Lead criado automaticamente: ${pushName || phone}`,
          data: { phone, lead_id: newLead?.id, pipeline_id: pipelineId, stage_id: stageId },
        });
      }
    }
  } catch (err) {
    console.error(`[evolution-webhook] handleAdKeywordLead error:`, err);
  }
}

// ── Helper: respond ──
function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Content-Type": "application/json",
    },
  });
}

// ── Helper: Auto-create lead + opportunity for any inbound contact without a lead ──
async function autoCreateLeadAndOpportunity(
  supabase: any,
  orgId: string,
  phone: string,
  pushName: string,
  messageBody: string,
  conversationId: string,
  instanceName: string,
): Promise<string | null> {
  try {
    // Determine source based on message content
    const normalizedText = (messageBody || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isFromAd = normalizedText.includes("anuncio") || normalizedText.includes("anúncio");
    const leadSource = isFromAd ? "Meta Ads" : "WhatsApp Orgânico";

    // Get default pipeline + first stage
    let pipelineId: string | null = null;
    let stageId: string | null = null;

    const { data: defPipeline } = await supabase
      .from("pipelines")
      .select("id")
      .eq("organization_id", orgId)
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();
    pipelineId = defPipeline?.id || null;

    if (!pipelineId) {
      const { data: anyPipeline } = await supabase
        .from("pipelines")
        .select("id")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      pipelineId = anyPipeline?.id || null;
    }

    if (pipelineId) {
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, name, position")
        .eq("pipeline_id", pipelineId)
        .eq("is_active", true)
        .order("position");

      if (stages && stages.length > 0) {
        const novoLead = stages.find((s: any) =>
          s.name.toLowerCase().replace(/[^a-z]/g, "").includes("novo")
        );
        stageId = novoLead?.id || stages[0].id;
      }
    }

    // Create lead
    const leadData: Record<string, unknown> = {
      organization_id: orgId,
      name: pushName || "Lead WhatsApp",
      phone,
      source: leadSource,
      observations: `Criado automaticamente via WhatsApp (${instanceName})`,
    };
    if (stageId) leadData.stage_id = stageId;

    const { data: newLead, error: leadErr } = await supabase
      .from("leads")
      .insert(leadData)
      .select("id")
      .single();

    if (leadErr) {
      console.error(`[evolution-webhook] Auto-create lead failed:`, leadErr);
      return null;
    }

    const leadId = newLead?.id;
    console.log(`[evolution-webhook] ✅ Auto-created lead: phone=${phone} lead=${leadId} source=${leadSource}`);

    // Link conversation to lead
    await supabase.from("conversations")
      .update({ lead_id: leadId })
      .eq("id", conversationId);

    // Create opportunity in pipeline
    if (pipelineId && leadId) {
      const { error: oppErr } = await supabase
        .from("opportunities")
        .insert({
          organization_id: orgId,
          lead_id: leadId,
          pipeline_id: pipelineId,
          stage_id: stageId,
          source: leadSource,
          source_detail: `WhatsApp inbound (${instanceName})`,
          status: "open",
        });

      if (oppErr) {
        console.error(`[evolution-webhook] Auto-create opportunity failed:`, oppErr);
      } else {
        console.log(`[evolution-webhook] ✅ Auto-created opportunity for lead=${leadId} pipeline=${pipelineId} stage=${stageId}`);
      }
    }

    // Apply lead distribution
    await applyLeadDistribution(supabase, orgId, leadId, conversationId, isFromAd ? "traffic" : "non_traffic");

    return leadId;
  } catch (err) {
    console.error(`[evolution-webhook] autoCreateLeadAndOpportunity error:`, err);
    return null;
  }
}

// ── Helper: Apply lead distribution rules (dual-bucket with independent counters) ──
async function checkDistributionSchedule(
  supabase: any,
  orgId: string,
  bucket: string,
): Promise<string[] | null> {
  try {
    const { data: schedules, error } = await supabase
      .from("distribution_schedules")
      .select("days_of_week, start_time, end_time, assigned_user_ids, priority")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .in("bucket", [bucket, "all"])
      .order("priority", { ascending: true });

    if (error || !schedules?.length) return null;

    // Current Brazil time
    const now = new Date();
    const brtFormatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = brtFormatter.formatToParts(now);
    const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";

    // Map pt-BR short weekday → 0–6 (Sun=0)
    const weekdayMap: Record<string, number> = {
      dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sáb: 6,
    };
    const currentDay = weekdayMap[weekdayShort.toLowerCase()] ?? now.getDay();
    const currentTime = `${hour}:${minute}`;

    for (const schedule of schedules) {
      const { days_of_week, start_time, end_time, assigned_user_ids } = schedule;

      if (!days_of_week?.includes(currentDay)) continue;
      if (!assigned_user_ids?.length) continue;

      // Compare HH:MM strings lexicographically — works because zero-padded
      const isOvernight = start_time > end_time;
      const inWindow = isOvernight
        ? currentTime >= start_time || currentTime <= end_time
        : currentTime >= start_time && currentTime <= end_time;

      if (inWindow) {
        console.log(
          `[distribution] Schedule matched: day=${currentDay} time=${currentTime} window=${start_time}-${end_time} users=${assigned_user_ids.join(",")}`,
        );
        return assigned_user_ids as string[];
      }
    }

    return null;
  } catch (err) {
    console.error("[distribution] checkDistributionSchedule error:", err);
    return null;
  }
}

async function applyLeadDistribution(
  supabase: any,
  orgId: string,
  leadId: string,
  conversationId: string,
  bucket: string,
) {
  try {
    // ── Protection rules: don't redistribute ──
    const { data: lead } = await supabase
      .from("leads")
      .select("assigned_to, status")
      .eq("id", leadId)
      .single();

    if (lead?.assigned_to) {
      console.log(`[distribution] Lead ${leadId} already assigned — skipping`);
      return;
    }
    if (lead?.status === "Cliente") {
      console.log(`[distribution] Lead ${leadId} is Cliente — skipping`);
      return;
    }

    // Check if any linked opportunity is "Ganhou"
    const { data: wonOpp } = await supabase
      .from("opportunities")
      .select("id")
      .eq("lead_id", leadId)
      .eq("status", "won")
      .limit(1)
      .maybeSingle();

    if (wonOpp) {
      console.log(`[distribution] Lead ${leadId} has won opportunity — skipping`);
      return;
    }

    // ── Fetch global routing settings ──
    const { data: globalSettings } = await supabase
      .from("whatsapp_routing_settings")
      .select("enabled")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!globalSettings?.enabled) {
      console.log(`[distribution] Global routing disabled for org=${orgId}`);
      return;
    }

    // ── Fetch bucket-specific settings ──
    const { data: bucketSettings } = await supabase
      .from("whatsapp_routing_bucket_settings")
      .select("*")
      .eq("organization_id", orgId)
      .eq("bucket", bucket)
      .maybeSingle();

    if (!bucketSettings?.enabled) {
      console.log(`[distribution] Bucket "${bucket}" disabled for org=${orgId}`);
      return;
    }

    let assignedUserId: string | null = null;

    if (bucketSettings.mode === "fixed_user") {
      // ── Fixed user mode ──
      assignedUserId = bucketSettings.fixed_user_id;
      if (!assignedUserId) {
        console.log(`[distribution] Fixed user not set for bucket="${bucket}"`);
        return;
      }
    } else if (bucketSettings.mode === "auto") {
      // ── Round-robin mode with independent counter ──
      // Check time-based schedule rules first; fall back to default list
      const scheduleUsers = await checkDistributionSchedule(supabase, orgId, bucket);
      const userIds: string[] = scheduleUsers ?? bucketSettings.auto_assign_user_ids ?? [];
      if (userIds.length === 0) {
        console.log(`[distribution] No users configured for bucket="${bucket}"`);
        return;
      }

      // Get current routing state for this bucket
      const { data: routingState } = await supabase
        .from("whatsapp_routing_state")
        .select("id, last_assigned_user_id")
        .eq("organization_id", orgId)
        .eq("bucket", bucket)
        .maybeSingle();

      let nextIndex = 0;
      if (routingState?.last_assigned_user_id) {
        const lastIdx = userIds.indexOf(routingState.last_assigned_user_id);
        nextIndex = (lastIdx + 1) % userIds.length;
      }

      assignedUserId = userIds[nextIndex];

      // Update routing state
      if (routingState) {
        await supabase
          .from("whatsapp_routing_state")
          .update({ last_assigned_user_id: assignedUserId, updated_at: new Date().toISOString() })
          .eq("id", routingState.id);
      } else {
        await supabase
          .from("whatsapp_routing_state")
          .insert({ organization_id: orgId, bucket, last_assigned_user_id: assignedUserId });
      }
    } else {
      console.log(`[distribution] Unknown mode "${bucketSettings.mode}" for bucket="${bucket}"`);
      return;
    }

    if (!assignedUserId) return;

    // ── Resolve user_id → profile.id ──
    const { data: assignedProfile } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("user_id", assignedUserId)
      .eq("organization_id", orgId)
      .maybeSingle();

    const profileId = assignedProfile?.id;
    if (!profileId) {
      console.log(`[distribution] No profile found for user_id=${assignedUserId}`);
      return;
    }

    // ── Assign lead ──
    await supabase.from("leads").update({ assigned_to: profileId }).eq("id", leadId);

    // ── Assign conversation ──
    await supabase.from("conversations").update({ assigned_to: profileId }).eq("id", conversationId);

    // ── Assign open opportunities ──
    await supabase.from("opportunities")
      .update({ assigned_to: profileId })
      .eq("lead_id", leadId)
      .eq("status", "open");

    console.log(`[distribution] ✅ Lead ${leadId} → ${assignedProfile?.name || profileId} (bucket=${bucket}, mode=${bucketSettings.mode})`);

    // Log event
    await supabase.from("conversation_events").insert({
      organization_id: orgId,
      conversation_id: conversationId,
      event_type: "auto_assigned",
      performed_by: profileId,
      metadata: { lead_id: leadId, bucket, distribution_mode: bucketSettings.mode },
    }).catch(() => {});
  } catch (err) {
    console.error(`[distribution] applyLeadDistribution error:`, err);
  }
}


async function logWebhookEvent(supabase: any, data: Record<string, unknown>) {
  try {
    await supabase.from("webhook_logs").insert(data);
  } catch { /* non-critical */ }
}

// ── Helper: Invoke automation-worker ──
async function invokeWorker() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    await fetch(`${supabaseUrl}/functions/v1/automation-worker`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({}),
    });
  } catch { /* non-critical */ }
}

// ── Helper: Wake paused automation runs on lead reply ──
async function wakePausedRuns(supabase: any, orgId: string, leadId: string, now: string) {
  try {
    // Update lead's last_reply_at
    await supabase.from("leads").update({ last_reply_at: now }).eq("id", leadId);

    // Find paused runs for this lead
    const { data: pausedRuns } = await supabase
      .from("automation_runs")
      .select("id, automation_id, current_node_id")
      .eq("organization_id", orgId)
      .eq("entity_id", leadId)
      .eq("entity_type", "lead")
      .eq("status", "paused");

    if (!pausedRuns || pausedRuns.length === 0) return;

    for (const run of pausedRuns) {
      // Get the wait_for_reply node
      const { data: flow } = await supabase
        .from("automation_flows")
        .select("nodes, edges")
        .eq("automation_id", run.automation_id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!flow) continue;

      const edges: any[] = flow.edges || [];
      const nodes: any[] = flow.nodes || [];

      // Find "replied" edge from the current wait node
      const repliedEdge = edges.find(
        (e: any) => e.source === run.current_node_id && e.sourceHandle === "replied"
      );

      if (!repliedEdge) continue;

      const nextNode = nodes.find((n: any) => n.id === repliedEdge.target);
      if (!nextNode) continue;

      // Cancel the timeout sentinel
      await supabase
        .from("automation_jobs")
        .update({ status: "cancelled" })
        .eq("run_id", run.id)
        .eq("job_type", "wait_for_reply_timeout")
        .eq("status", "pending");

      // Create next job
      await supabase.from("automation_jobs").insert({
        organization_id: orgId,
        automation_id: run.automation_id,
        run_id: run.id,
        node_id: nextNode.id,
        job_type: nextNode.type || "action",
        payload: {
          node_config: nextNode.data?.config || {},
          node_label: nextNode.data?.label || "",
        },
        scheduled_for: now,
        status: "pending",
        attempts: 0,
      });

      // Resume run
      await supabase.from("automation_runs").update({
        status: "running",
        current_node_id: nextNode.id,
      }).eq("id", run.id);

      // Log
      await supabase.from("automation_logs").insert({
        organization_id: orgId,
        automation_id: run.automation_id,
        run_id: run.id,
        node_id: run.current_node_id,
        level: "info",
        message: `Resposta recebida do lead — automação retomada`,
        data: { lead_id: leadId, next_node: nextNode.id },
      });

      console.log(`[evolution-webhook] Paused run ${run.id} resumed on lead ${leadId} reply`);
    }
  } catch (err) {
    console.error("[evolution-webhook] wakePausedRuns error:", err);
  }
}

// ── Helper: Download and upload media (audio) ──
async function downloadAndUploadMedia(
  supabase: any,
  instanceName: string,
  messageId: string,
  orgId: string,
  conversationId: string,
): Promise<string | null> {
  try {
    const evolutionBaseUrl = Deno.env.get("EVOLUTION_BASE_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionBaseUrl || !evolutionApiKey) return null;

    const res = await fetch(`${evolutionBaseUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
      body: JSON.stringify({ message: { key: { id: messageId } } }),
    });

    if (!res.ok) {
      console.log(`[evolution-webhook] Media download failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const base64 = data?.base64 || null;
    const mimetype = data?.mimetype || "audio/ogg";

    if (!base64) return null;

    // Convert base64 to Uint8Array
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Upload to Supabase Storage
    const ext = mimetype.includes("ogg") ? "ogg" : mimetype.includes("mp4") ? "mp4" : "ogg";
    const filePath = `${orgId}/${conversationId}/${messageId}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("audio-messages")
      .upload(filePath, bytes, {
        contentType: mimetype,
        upsert: true,
      });

    if (uploadErr) {
      console.error("[evolution-webhook] Audio upload error:", uploadErr);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("audio-messages")
      .getPublicUrl(filePath);

    return urlData?.publicUrl || null;
  } catch (err) {
    console.error("[evolution-webhook] downloadAndUploadMedia error:", err);
    return null;
  }
}
