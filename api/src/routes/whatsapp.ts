import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"
import { emit } from "../plugins/socket.js"
import { findPausedReplyRouterRun, matchReply, resumeRun } from "../lib/automationRunner.js"

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
    select: { id: true, contactName: true, unreadCount: true },
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
      },
      select: { id: true, contactName: true, unreadCount: true },
    }).catch(() => null)
    isNewConversation = true
  }

  if (!conv) return

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

    const evStatus = evolutionData?.instance?.state || integration.status || "disconnected"
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
    const instanceName = `org-${orgId}`
    const webhookUrl = `${process.env.API_URL || ""}/whatsapp/webhook`

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

    const res = await evolutionFetch("/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName: targetInstance,
        webhook: { enabled: true, url: webhookUrl, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] },
      }),
    })
    const data = await res.json() as Record<string, any>

    await (prisma as any).whatsappIntegration?.upsert?.({
      where: { organizationId: orgId } as any,
      update: { instanceName: targetInstance, status: "connecting" },
      create: { organizationId: orgId, instanceName: targetInstance, status: "connecting" },
    }).catch(() => null)

    // Get QR code
    let qrCode: string | null = null
    try {
      const qrRes = await evolutionFetch(`/instance/connect/${targetInstance}`)
      const qrData = await qrRes.json() as Record<string, any>
      qrCode = qrData?.base64 || qrData?.qrcode?.base64 || null
    } catch { /* non-critical */ }

    return reply.code(201).send({ ok: true, instance_name: targetInstance, qr_code: qrCode, ...(data as object) })
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

  // GET /whatsapp/status/:instance
  fastify.get<{ Params: { instance: string } }>("/whatsapp/status/:instance", async (req, reply) => {
    const res = await evolutionFetch(`/instance/connectionState/${req.params.instance}`)
    return res.json()
  })

  // GET /whatsapp/qr/:instance
  fastify.get<{ Params: { instance: string } }>("/whatsapp/qr/:instance", async (req, reply) => {
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
    const res = await evolutionFetch(`/message/sendText/${instance}`, {
      method: "POST",
      body: JSON.stringify({ number: phone, text: message }),
    })
    return res.json()
  })

  // POST /whatsapp/send-audio — envia áudio (substitui whatsapp-send-audio)
  fastify.post<{
    Body: { instance: string; phone: string; audio_url: string }
  }>("/whatsapp/send-audio", async (req, reply) => {
    const { instance, phone, audio_url } = req.body
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
      if (isInbound && rawPhone && messageText) {
        findPausedReplyRouterRun(orgId, rawPhone)
          .then((paused) => {
            if (!paused) return
            const branch = matchReply(messageText, paused.nodeConfig)
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
}
