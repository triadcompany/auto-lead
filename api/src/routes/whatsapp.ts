import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"
import { emit } from "../plugins/socket.js"

import { evolutionFetch } from "../lib/evolution.js"

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

  // POST /whatsapp/send-audio — envia áudio gravado pelo usuário
  fastify.post<{
    Body: { organization_id?: string; conversation_id: string; audio_base64: string; mime_type?: string }
  }>("/whatsapp/send-audio", async (req, reply) => {
    const { conversation_id, audio_base64, mime_type = "audio/webm" } = req.body

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversation_id },
      select: { instanceName: true, contactPhone: true, organizationId: true },
    })
    if (!conversation) return reply.code(404).send({ error: "Conversa não encontrada" })

    const { uploadFile } = await import("../services/storage.js")
    const buffer = Buffer.from(audio_base64, "base64")
    const ext = mime_type.includes("ogg") ? "ogg" : "webm"
    const key = `audio/${conversation.organizationId}/${Date.now()}.${ext}`
    const audioUrl = await uploadFile(key, buffer, mime_type)

    const res = await evolutionFetch(`/message/sendWhatsAppAudio/${conversation.instanceName}`, {
      method: "POST",
      body: JSON.stringify({ number: conversation.contactPhone, audio: audioUrl, delay: 1000 }),
    })
    return res.json()
  })

  // POST /whatsapp/webhook — recebe eventos do Evolution (rota pública)
  fastify.post<{ Body: Record<string, unknown> }>("/whatsapp/webhook", async (req) => {
    const body = req.body as any
    const event = body.event as string
    const instanceName = body.instance as string

    if (!instanceName) return { received: true }

    const integration = await (prisma as any).whatsappIntegration?.findFirst?.({
      where: { instanceName },
    }).catch(() => null)

    if (!integration) return { received: true }

    const orgId = integration.organizationId as string

    if (event === "messages.upsert") {
      const msg = body.data as any
      if (!msg?.key) return { received: true }

      const fromMe = msg.key?.fromMe === true
      if (fromMe) return { received: true } // Mensagens enviadas pelo app já ficam no DB

      const remoteJid = msg.key?.remoteJid as string | undefined
      if (!remoteJid || remoteJid.includes("@g.us")) return { received: true } // Ignora grupos

      const contactPhone = remoteJid.split("@")[0]
      const contactName = (msg.pushName as string | undefined) || contactPhone
      const externalMessageId = msg.key?.id as string | undefined

      // Parse body e tipo
      let textBody = ""
      let messageType = "text"
      if (msg.message?.conversation) {
        textBody = msg.message.conversation
      } else if (msg.message?.extendedTextMessage?.text) {
        textBody = msg.message.extendedTextMessage.text
      } else if (msg.message?.imageMessage) {
        textBody = msg.message.imageMessage?.caption || ""
        messageType = "image"
      } else if (msg.message?.audioMessage || msg.message?.pttMessage) {
        textBody = "🎵 Áudio"
        messageType = "audio"
      } else if (msg.message?.videoMessage) {
        textBody = msg.message.videoMessage?.caption || "🎥 Vídeo"
        messageType = "video"
      } else if (msg.message?.documentMessage) {
        textBody = msg.message.documentMessage?.fileName || "📎 Documento"
        messageType = "document"
      } else if (msg.message?.stickerMessage) {
        textBody = "🎭 Figurinha"
        messageType = "sticker"
      }

      // Idempotência: ignora mensagem já salva
      if (externalMessageId) {
        const exists = await prisma.message.findFirst({ where: { externalMessageId } })
        if (exists) return { received: true }
      }

      // Encontra ou cria conversa
      let conversation = await prisma.conversation.findFirst({
        where: { organizationId: orgId, instanceName, contactPhone },
      })

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            organizationId: orgId,
            instanceName,
            contactPhone,
            contactName,
            channel: "whatsapp",
            status: "open",
            lastMessageAt: new Date(),
            lastMessagePreview: textBody.substring(0, 100),
            unreadCount: 1,
          },
        })
        emit(orgId, "conversation:created", conversation)
      } else {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: textBody.substring(0, 100),
            unreadCount: { increment: 1 },
            ...(contactName && contactName !== conversation.contactName ? { contactName } : {}),
          },
        })
      }

      const savedMessage = await prisma.message.create({
        data: {
          organizationId: orgId,
          conversationId: conversation.id,
          direction: "inbound",
          body: textBody,
          messageType,
          channel: "whatsapp",
          externalMessageId: externalMessageId || undefined,
          senderName: contactName,
          senderPhone: contactPhone,
        },
      })

      emit(orgId, "message:created", { conversationId: conversation.id, message: savedMessage })
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
