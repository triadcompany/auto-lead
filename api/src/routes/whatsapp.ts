import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope, resolveActiveProfile } from "../lib/auth.js"
import { emit } from "../plugins/socket.js"
import { findPausedReplyRouterRun, matchReply, resumeRun, fireAutomationTrigger } from "../lib/automationRunner.js"
import { enrichLeadFromCtwa } from "../lib/metaCtwa.js"

async function evolutionFetch(path: string, options: RequestInit = {}) {
  const base = process.env.EVOLUTION_API_URL?.replace(/\/$/, "")
  if (!base) throw new Error("EVOLUTION_API_URL not set")
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.EVOLUTION_API_KEY || "",
      ...(options.headers || {}),
    },
  })
}

// ── Sincroniza mensagem recebida do webhook no banco de dados ─────────────────

async function syncIncomingMessage(
  orgId: string,
  instanceName: string,
  message: any
): Promise<void> {
  const jid: string = message?.key?.remoteJid || ""
  if (!jid || jid.endsWith("@g.us")) return // ignora grupos por ora

  const phone = jid.replace("@s.whatsapp.net", "").replace(/[^0-9]/g, "")
  if (!phone) return

  const fromMe: boolean = message?.key?.fromMe === true
  const direction = fromMe ? "outbound" : "inbound"
  const externalId: string | null = message?.key?.id || null
  const contactName: string | null = message?.pushName || null
  const timestamp = message?.messageTimestamp
    ? new Date(Number(message.messageTimestamp) * 1000)
    : new Date()

  // Extrai conteúdo e tipo
  const msg = message?.message || {}
  let body: string | null = null
  let messageType = "text"

  // DIAGNÓSTICO TEMPORÁRIO — remover depois de confirmar o formato real do
  // externalAdReply que a Evolution API manda. Loga toda mensagem recebida.
  if (!fromMe) {
    console.log("[whatsapp][ctwa-debug] msg keys:", Object.keys(msg))
    console.log("[whatsapp][ctwa-debug] full msg:", JSON.stringify(msg))
    console.log("[whatsapp][ctwa-debug] full message (nível acima, com key/contextInfo/etc):", JSON.stringify(message))
  }

  // Extrai dados CTWA (Click-to-WhatsApp) — presentes na 1ª mensagem de anúncio
  const externalAdReply = msg.extendedTextMessage?.contextInfo?.externalAdReply
  const ctwaAdId: string | null = externalAdReply?.sourceId || null
  const ctwaClid: string | null = externalAdReply?.ctwaClid || null
  const ctwaSourceUrl: string | null = externalAdReply?.sourceUrl || null
  const ctwaMediaUrl: string | null = externalAdReply?.mediaUrl || null
  const ctwaThumbnailUrl: string | null = externalAdReply?.thumbnailUrl || externalAdReply?.thumbnail || null

  if (msg.conversation) {
    body = msg.conversation
  } else if (msg.extendedTextMessage?.text) {
    body = msg.extendedTextMessage.text
  } else if (msg.imageMessage) {
    body = msg.imageMessage.caption || null
    messageType = "image"
  } else if (msg.videoMessage) {
    body = msg.videoMessage.caption || null
    messageType = "video"
  } else if (msg.audioMessage || msg.pttMessage) {
    messageType = "audio"
  } else if (msg.documentMessage) {
    body = msg.documentMessage.fileName || null
    messageType = "document"
  } else if (msg.stickerMessage) {
    messageType = "sticker"
  } else {
    return // tipo desconhecido, ignora
  }

  // Busca ou cria conversa
  let conv = await prisma.conversation.findFirst({
    where: { organizationId: orgId, instanceName, contactPhone: phone },
    select: { id: true, contactName: true, unreadCount: true, profilePictureUrl: true },
  }).catch(() => null)

  let isNewConversation = false
  if (!conv) {
    conv = await prisma.conversation.create({
      data: {
        organizationId: orgId,
        instanceName,
        contactPhone: phone,
        contactName: contactName || null,
        channel: "whatsapp",
        lastMessageAt: timestamp,
        lastMessagePreview: body?.substring(0, 100) || `[${messageType}]`,
        unreadCount: fromMe ? 0 : 1,
        ...(ctwaAdId ? { ctwaAdId } : {}),
        ...(ctwaClid ? { ctwaClid } : {}),
        ...(ctwaSourceUrl ? { ctwaSourceUrl } : {}),
        ...(ctwaMediaUrl ? { ctwaMediaUrl } : {}),
        ...(ctwaThumbnailUrl ? { ctwaThumbnailUrl } : {}),
      },
      select: { id: true, contactName: true, unreadCount: true, profilePictureUrl: true },
    }).catch(() => null)
    isNewConversation = true
  } else if (ctwaAdId) {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: {
        ...(ctwaAdId ? { ctwaAdId } : {}),
        ...(ctwaClid ? { ctwaClid } : {}),
        ...(ctwaSourceUrl ? { ctwaSourceUrl } : {}),
        ...(ctwaMediaUrl ? { ctwaMediaUrl } : {}),
        ...(ctwaThumbnailUrl ? { ctwaThumbnailUrl } : {}),
      },
    }).catch(() => null)
  }

  if (!conv) return

  // Busca a foto de perfil do WhatsApp (fire-and-forget) quando ainda não temos.
  if (!fromMe && (isNewConversation || !conv.profilePictureUrl)) {
    const convId = conv.id
    setImmediate(async () => {
      try {
        const res = await evolutionFetch(`/chat/fetchProfilePictureUrl/${instanceName}`, {
          method: "POST",
          body: JSON.stringify({ number: phone }),
        })
        const data = await res.json().catch(() => null) as any
        const url: string | null = data?.profilePictureUrl || data?.url || null
        if (url) {
          await prisma.conversation.update({
            where: { id: convId },
            data: { profilePictureUrl: url, profilePictureUpdatedAt: new Date() },
          }).catch(() => null)
          emit(orgId, "conversation:updated", { id: convId, profile_picture_url: url })
        }
      } catch { /* non-critical */ }
    })
  }

  // Deduplicação por externalId
  if (externalId) {
    const exists = await prisma.message.findFirst({
      where: { conversationId: conv.id, externalMessageId: externalId },
      select: { id: true },
    }).catch(() => null)
    if (exists) return
  }

  // Salva mensagem
  const saved = await prisma.message.create({
    data: {
      organizationId: orgId,
      conversationId: conv.id,
      direction,
      body,
      messageType,
      externalMessageId: externalId,
      channel: "whatsapp",
      senderName: fromMe ? null : contactName,
      createdAt: timestamp,
    },
  }).catch(() => null)

  if (!saved) return

  // Atualiza metadados da conversa
  await prisma.conversation.update({
    where: { id: conv.id },
    data: {
      lastMessageAt: timestamp,
      lastMessagePreview: body?.substring(0, 100) || `[${messageType}]`,
      ...(fromMe ? {} : { unreadCount: { increment: 1 } }),
      ...(contactName && !conv.contactName ? { contactName } : {}),
    },
  }).catch(() => null)

  // Emite eventos de socket para o inbox atualizar em tempo real
  emit(orgId, "message:created", { conversationId: conv.id, message: saved })
  if (isNewConversation) {
    emit(orgId, "conversation:created", { id: conv.id })
  } else {
    emit(orgId, "conversation:updated", { id: conv.id })
  }

  // Busca lead pelo telefone (usado em múltiplos triggers abaixo)
  const lead = !fromMe
    ? await prisma.lead.findFirst({
        where: { organizationId: orgId, phone: { contains: phone.slice(-8) } },
        select: { id: true },
      }).catch(() => null)
    : null

  // Enriquece lead com dados CTWA se mensagem veio de anúncio Click-to-WhatsApp
  if (!fromMe && ctwaAdId && lead) {
    setImmediate(() =>
      enrichLeadFromCtwa(orgId, lead.id, ctwaAdId, {
        fbc: ctwaClid,
        clickId: ctwaClid,
        sourceUrl: ctwaSourceUrl,
        mediaUrl: ctwaMediaUrl,
        thumbnailUrl: ctwaThumbnailUrl,
      }).catch((e) => console.error("[whatsapp] CTWA enrichment error:", e))
    )
  }

  // Dispara automações de "primeira mensagem" apenas para mensagens inbound novas
  if (!fromMe && isNewConversation) {
    setImmediate(() =>
      fireAutomationTrigger(orgId, "first_message", lead?.id ?? null, {
        phone,
        message_text: body || "",
        channel: "whatsapp",
        instance_name: instanceName,
        lead_phone: phone,
        contact_name: contactName || "",
      }).catch((e) => console.error("[whatsapp] automation trigger error:", e))
    )
  }

  // Detecta resposta a campanha broadcast
  if (!fromMe && body) {
    const recipient = await (prisma as any).broadcastRecipient?.findFirst?.({
      where: {
        organizationId: orgId,
        phone: { contains: phone.slice(-8) },
        status: "sent",
        responseReceived: false,
      },
      orderBy: { sentAt: "desc" },
      select: { id: true, campaignId: true },
    }).catch(() => null)

    if (recipient) {
      await (prisma as any).broadcastRecipient?.update?.({
        where: { id: recipient.id },
        data: { responseReceived: true, responseAt: timestamp },
      }).catch(() => null)

      await (prisma as any).broadcastCampaign?.update?.({
        where: { id: recipient.campaignId },
        data: { respondedCount: { increment: 1 } },
      }).catch(() => null)

      setImmediate(() =>
        fireAutomationTrigger(orgId, "broadcast_response", lead?.id ?? null, {
          phone,
          campaign_id: recipient.campaignId,
          message_text: body || "",
          lead_phone: phone,
        }).catch((e) => console.error("[whatsapp] broadcast_response trigger error:", e))
      )
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function whatsappRoutes(fastify: FastifyInstance) {
  // GET /whatsapp/me — status da instância da org autenticada
  fastify.get("/whatsapp/me", async (req, reply) => {
    const integration = await (prisma as any).whatsappIntegration?.findFirst?.({
      where: { organizationId: req.auth.orgId },
      orderBy: { createdAt: "desc" },
    }).catch(() => null)

    if (!integration) return { ok: false, status: "not_configured", connection: null }

    const instanceName = integration.instanceName as string
    let evolutionData: any = null
    let qrCode: string | null = null

    try {
      const res = await evolutionFetch(`/instance/connectionState/${instanceName}`)
      evolutionData = await res.json()
    } catch {
      // Evolution API unreachable — return last known status from DB
    }

    const rawState = evolutionData?.instance?.state || integration.status || "disconnected"
    const evStatus = rawState === "open" ? "connected" : rawState === "close" ? "disconnected" : rawState
    const isConnecting = evStatus === "connecting" || evStatus === "qr"

    if (isConnecting) {
      try {
        const qrRes = await evolutionFetch(`/instance/connect/${instanceName}`)
        const qrData = await qrRes.json() as Record<string, any>
        qrCode = qrData?.base64 || qrData?.qrcode?.base64 || null
      } catch { /* non-critical */ }
    }

    return {
      ok: true,
      status: evStatus,
      connection: {
        instance_name: instanceName,
        phone_number: integration.phoneNumber || null,
        status: evStatus,
        qr_code: qrCode,
        connected_at: integration.connectedAt || null,
        last_connected_at: integration.lastConnectedAt || null,
        last_disconnected_at: integration.lastDisconnectedAt || null,
        mirror_enabled: integration.mirrorEnabled || false,
        mirror_enabled_at: integration.mirrorEnabledAt || null,
      },
    }
  })

  // POST /whatsapp/me/connect — conecta org autenticada (cria ou reutiliza instância)
  fastify.post("/whatsapp/me/connect", async (req, reply) => {
    const orgId = req.auth.orgId
    const webhookUrl = `${process.env.API_URL || ""}/whatsapp/webhook`

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } })
    const orgSlug = (org?.name || "org")
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")  // remove acentos
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32)
    const instanceName = `${orgSlug}-${orgId.slice(0, 8)}`

    // Reuse existing integration if it exists
    const existing = await (prisma as any).whatsappIntegration?.findFirst?.({
      where: { organizationId: orgId },
    }).catch(() => null)

    if (existing?.instanceName) {
      // Check if instance already running in Evolution
      try {
        const stateRes = await evolutionFetch(`/instance/connectionState/${existing.instanceName}`)
        const stateData = await stateRes.json() as Record<string, any>
        if (stateData?.instance?.state === "open") {
          return { ok: true, already_connected: true }
        }
      } catch { /* continue */ }
    }

    const targetInstance = existing?.instanceName || instanceName

    const createRes = await evolutionFetch("/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName: targetInstance,
        integration: "WHATSAPP-BAILEYS",
        ...(webhookUrl
          ? { webhook: { enabled: true, url: webhookUrl, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] } }
          : {}),
      }),
    })
    const createData = await createRes.json() as Record<string, any>

    if (!createRes.ok && createData?.status !== 400) {
      // Hard error (not "already exists")
      return reply.code(502).send({ ok: false, error: createData?.message || "Failed to create Evolution instance" })
    }

    // Persist integration record
    const existingRecord = await prisma.whatsappIntegration.findFirst({ where: { organizationId: orgId } })
    if (existingRecord) {
      await prisma.whatsappIntegration.update({
        where: { id: existingRecord.id },
        data: { instanceName: targetInstance, status: "connecting", updatedAt: new Date() },
      })
    } else {
      await prisma.whatsappIntegration.create({
        data: { organizationId: orgId, instanceName: targetInstance, status: "connecting" },
      })
    }

    // Get QR code
    let qrCode: string | null = null
    try {
      const qrRes = await evolutionFetch(`/instance/connect/${targetInstance}`)
      const qrData = await qrRes.json() as Record<string, any>
      qrCode = qrData?.base64 || qrData?.qrcode?.base64 || null
    } catch { /* non-critical */ }

    return reply.code(201).send({ ok: true, instance_name: targetInstance, qr_code: qrCode })
  })

  // DELETE /whatsapp/me/disconnect — desconecta org autenticada
  fastify.delete("/whatsapp/me/disconnect", async (req) => {
    const integration = await (prisma as any).whatsappIntegration?.findFirst?.({
      where: { organizationId: req.auth.orgId },
    }).catch(() => null)

    if (integration?.instanceName) {
      await evolutionFetch(`/instance/delete/${integration.instanceName}`, { method: "DELETE" }).catch(() => null)
      await (prisma as any).whatsappIntegration?.deleteMany?.({
        where: { organizationId: req.auth.orgId },
      }).catch(() => null)
    }

    return { success: true, ok: true }
  })

  // Verifica que a instância pertence à org autenticada (previne IDOR)
  async function assertOwnsInstance(req: any, reply: any): Promise<boolean> {
    const owns = await prisma.whatsappIntegration.findFirst({
      where: { instanceName: req.params.instance, organizationId: req.auth.orgId },
      select: { id: true },
    }).catch(() => null)
    if (!owns) {
      reply.code(404).send({ error: "Instância não encontrada" })
      return false
    }
    return true
  }

  // GET /whatsapp/status/:instance
  fastify.get<{ Params: { instance: string } }>("/whatsapp/status/:instance", async (req, reply) => {
    if (!await assertOwnsInstance(req, reply)) return
    const res = await evolutionFetch(`/instance/connectionState/${req.params.instance}`)
    return res.json()
  })

  // GET /whatsapp/qr/:instance
  fastify.get<{ Params: { instance: string } }>("/whatsapp/qr/:instance", async (req, reply) => {
    if (!await assertOwnsInstance(req, reply)) return
    const res = await evolutionFetch(`/instance/connect/${req.params.instance}`)
    return res.json()
  })

  // POST /whatsapp/connect — cria instância Evolution (substitui whatsapp-connect + evolution-create-instance)
  fastify.post<{ Body: { instance_name: string; webhook_url?: string } }>(
    "/whatsapp/connect",
    async (req, reply) => {
      const { instance_name, webhook_url } = req.body
      const webhookUrl = webhook_url || `${process.env.API_URL || ""}/whatsapp/webhook`

      const res = await evolutionFetch("/instance/create", {
        method: "POST",
        body: JSON.stringify({
          instanceName: instance_name,
          webhook: { enabled: true, url: webhookUrl, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] },
        }),
      })
      const data = await res.json()

      await prisma.whatsappIntegration?.create?.({
        data: {
          organizationId: req.auth.orgId,
          instanceName: instance_name,
          status: "connecting",
        } as any,
      }).catch(() => null)

      return reply.code(201).send(data)
    }
  )

  // DELETE /whatsapp/disconnect/:instance (substitui whatsapp-disconnect + evolution-delete-instance)
  fastify.delete<{ Params: { instance: string } }>(
    "/whatsapp/disconnect/:instance",
    async (req, reply) => {
      if (!await assertOwnsInstance(req, reply)) return
      await evolutionFetch(`/instance/delete/${req.params.instance}`, { method: "DELETE" })

      await prisma.whatsappIntegration?.deleteMany?.({
        where: { instanceName: req.params.instance, ...orgScope(req) } as any,
      }).catch(() => null)

      return { success: true }
    }
  )

  // POST /whatsapp/send — envia mensagem de texto (substitui whatsapp-send + evolution-send)
  fastify.post<{
    Body: { instance: string; phone: string; message: string }
  }>("/whatsapp/send", async (req, reply) => {
    const { instance, phone, message } = req.body
    const owns = await prisma.whatsappIntegration.findFirst({
      where: { instanceName: instance, organizationId: req.auth.orgId }, select: { id: true },
    }).catch(() => null)
    if (!owns) return reply.code(404).send({ error: "Instância não encontrada" })
    const res = await evolutionFetch(`/message/sendText/${instance}`, {
      method: "POST",
      body: JSON.stringify({ number: phone, text: message }),
    })
    return res.json()
  })

  // POST /whatsapp/send-audio — envia áudio (rota pública p/ evitar preflight CORS; auth manual)
  fastify.post<{
    Body: { instance: string; phone: string; audio_url: string }
  }>("/whatsapp/send-audio", async (req, reply) => {
    // Verificação manual do token Clerk (rota está em PUBLIC_PREFIXES)
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing authorization header" })
    }
    let orgId: string
    try {
      const { verifyToken } = await import("@clerk/backend")
      const payload = await verifyToken(authHeader.slice(7), { secretKey: process.env.CLERK_SECRET_KEY })
      const result = await resolveActiveProfile(payload.sub, req.headers["x-org-id"] as string | undefined)
      if (!result.profile) return reply.code(result.status || 401).send({ error: result.message })
      orgId = result.profile.organizationId
    } catch {
      return reply.code(401).send({ error: "Invalid token" })
    }

    const { instance, phone, audio_url } = req.body
    const owns = await prisma.whatsappIntegration.findFirst({
      where: { instanceName: instance, organizationId: orgId }, select: { id: true },
    }).catch(() => null)
    if (!owns) return reply.code(404).send({ error: "Instância não encontrada" })

    const res = await evolutionFetch(`/message/sendWhatsAppAudio/${instance}`, {
      method: "POST",
      body: JSON.stringify({ number: phone, audio: audio_url }),
    })
    return res.json()
  })

  // POST /whatsapp/webhook — recebe eventos do Evolution (rota pública)
  fastify.post<{ Body: Record<string, unknown> }>("/whatsapp/webhook", async (req) => {
    const body = req.body as any
    const event = body.event as string
    const instanceName = body.instance as string

    if (!instanceName) return { received: true }

    // Find org by instance
    const integration = await (prisma as any).whatsappIntegration?.findFirst?.({
      where: { instanceName },
    }).catch(() => null)

    if (!integration) return { received: true }

    const orgId = integration.organizationId

    if (event === "messages.upsert") {
      const message = body.data

      // Salva mensagem no DB e sincroniza conversa (fire-and-forget)
      setImmediate(() =>
        syncIncomingMessage(orgId, instanceName, message)
          .catch((e) => console.error("[whatsapp] syncIncomingMessage error:", e))
      )

      // Resume automações pausadas (reply_router) quando lead responde
      const isInbound = message?.key?.fromMe === false
      const rawPhone: string = (message?.key?.remoteJid || "").replace("@s.whatsapp.net", "")
      const messageText: string =
        message?.message?.conversation ||
        message?.message?.extendedTextMessage?.text ||
        ""
      if (isInbound && rawPhone) {
        findPausedReplyRouterRun(orgId, rawPhone)
          .then((paused) => {
            if (!paused) return
            // wait_for_reply: qualquer mensagem = "replied"; reply_router: match por keywords
            const branch = paused.nodeType === "wait_for_reply"
              ? "replied"
              : matchReply(messageText, paused.nodeConfig)
            return resumeRun(paused.runId, branch, messageText)
          })
          .catch((e) => console.error("[whatsapp] automation resume error:", e))
      }
    }

    if (event === "connection.update") {
      const status = body.data?.state
      await (prisma as any).whatsappIntegration?.updateMany?.({
        where: { instanceName },
        data: { status },
      }).catch(() => null)
      emit(orgId, "whatsapp:status", { instance: instanceName, status })
    }

    return { received: true }
  })

  // GET /whatsapp/settings — configurações básicas da integração
  fastify.get("/whatsapp/settings", async (req) => {
    const i = await (prisma as any).whatsappIntegration?.findFirst?.({
      where: { organizationId: req.auth.orgId },
    }).catch(() => null)
    if (!i) return { ok: false, integration: null }
    return {
      ok: true,
      integration: {
        id: i.id,
        instance_name: i.instanceName,
        is_active: i.isActive,
        webhook_token: i.webhookToken,
        status: i.status,
        phone_number: i.phoneNumber || null,
      },
    }
  })

  // PATCH /whatsapp/settings — atualiza settings básicos
  fastify.patch<{ Body: Record<string, unknown> }>("/whatsapp/settings", async (req, reply) => {
    const b = req.body as any
    const updated = await (prisma as any).whatsappIntegration?.updateMany?.({
      where: { organizationId: req.auth.orgId },
      data: {
        ...(b.is_active !== undefined && { isActive: b.is_active }),
        updatedAt: new Date(),
      },
    }).catch(() => null)
    if (!updated?.count) return reply.code(404).send({ error: "Not found" })
    return { ok: true }
  })

  // GET /whatsapp/routing-settings — configurações de distribuição de conversas
  fastify.get("/whatsapp/routing-settings", async (req) => {
    return prisma.whatsappRoutingSettings.findFirst({ where: orgScope(req) }) || null
  })

  // PUT /whatsapp/routing-settings — upsert configurações de roteamento
  fastify.put<{ Body: Record<string, unknown> }>("/whatsapp/routing-settings", async (req) => {
    const b = req.body as any
    const existing = await prisma.whatsappRoutingSettings.findFirst({ where: orgScope(req) })
    const data: Record<string, unknown> = {
      ...(b.enabled !== undefined && { enabled: b.enabled }),
      ...(b.mode !== undefined && { mode: b.mode }),
      ...(b.assign_on !== undefined && { assignOn: b.assign_on }),
      ...(b.only_roles !== undefined && { onlyRoles: b.only_roles }),
      ...(b.business_hours_enabled !== undefined && { businessHoursEnabled: b.business_hours_enabled }),
      ...(b.business_hours !== undefined && { businessHours: b.business_hours }),
      ...(b.traffic_enabled !== undefined && { trafficEnabled: b.traffic_enabled }),
      ...(b.non_traffic_enabled !== undefined && { nonTrafficEnabled: b.non_traffic_enabled }),
      ...(b.traffic_roles !== undefined && { trafficRoles: b.traffic_roles }),
      ...(b.non_traffic_roles !== undefined && { nonTrafficRoles: b.non_traffic_roles }),
      updatedAt: new Date(),
    }
    if (existing) {
      return prisma.whatsappRoutingSettings.update({ where: { id: existing.id }, data })
    }
    return prisma.whatsappRoutingSettings.create({
      data: { organizationId: req.auth.orgId, ...data } as any,
    })
  })
}
