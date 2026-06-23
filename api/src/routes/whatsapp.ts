import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"
import { emit } from "../plugins/socket.js"

import { evolutionFetch } from "../lib/evolution.js"

export default async function whatsappRoutes(fastify: FastifyInstance) {
  // GET /whatsapp/debug — diagnóstico público (temporário)
  fastify.get("/whatsapp/debug", { config: { skipAuth: true } } as any, async (req, reply) => {
    const evolutionUrl = process.env.EVOLUTION_API_URL || "(não definido)"
    const evolutionKey = process.env.EVOLUTION_API_KEY ? "***definido***" : "(não definido)"

    let evolutionPing: any = null
    let instances: any = null
    try {
      const r = await evolutionFetch("/instance/fetchInstances")
      evolutionPing = { status: r.status, ok: r.ok }
      if (r.ok) instances = (await r.json() as any[]).map((i: any) => ({ name: i.name, status: i.connectionStatus }))
    } catch (e: any) {
      evolutionPing = { error: e.message }
    }

    return { evolution_url: evolutionUrl, evolution_key: evolutionKey, evolution_ping: evolutionPing, instances }
  })

  // Helper: deriva slug da org (mesmo algoritmo do meConnect)
  async function orgInstanceName(orgId: string): Promise<string> {
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } })
    return (org?.name || orgId)
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || `org-${orgId}`
  }

  // Helper: garante que a tabela e colunas existem
  async function ensureWhatsappTable(orgId: string, instanceName: string, status = "connected") {
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS whatsapp_integrations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID UNIQUE NOT NULL,
          provider TEXT NOT NULL DEFAULT 'evolution',
          instance_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'disconnected',
          is_active BOOLEAN NOT NULL DEFAULT true,
          mirror_enabled BOOLEAN NOT NULL DEFAULT false,
          connected_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
      await prisma.$executeRaw`ALTER TABLE whatsapp_integrations ADD COLUMN IF NOT EXISTS mirror_enabled BOOLEAN DEFAULT false`
      await prisma.$executeRaw`
        INSERT INTO whatsapp_integrations (organization_id, instance_name, status, provider, is_active)
        VALUES (${orgId}::uuid, ${instanceName}, ${status}, 'evolution', true)
        ON CONFLICT (organization_id) DO UPDATE SET
          instance_name = EXCLUDED.instance_name,
          status = ${status}
      `
    } catch (e: any) {
      // log mas não falha — o endpoint ainda funciona sem banco
    }
  }

  // GET /whatsapp/me — status da instância da org autenticada
  fastify.get("/whatsapp/me", async (req, reply) => {
    const orgId = req.auth.orgId

    // Tenta ler do banco; se falhar, deriva o nome da instância do nome da org
    let dbRecord: any = null
    try { dbRecord = await prisma.whatsappIntegration.findFirst({ where: { organizationId: orgId } }) } catch { }

    const instanceName = dbRecord?.instanceName || await orgInstanceName(orgId)

    // Consulta estado real na Evolution
    let evolutionData: any = null
    let qrCode: string | null = null
    try {
      const res = await evolutionFetch(`/instance/connectionState/${instanceName}`)
      if (res.ok) evolutionData = await res.json()
    } catch { }

    // Se Evolution não conhece essa instância e não há registro no banco → não configurado
    if (!evolutionData?.instance && !dbRecord) {
      return { ok: false, status: "not_configured", connection: null }
    }

    const rawState = evolutionData?.instance?.state || dbRecord?.status || "disconnected"
    const evStatus =
      rawState === "open"   ? "connected"   :
      rawState === "close" || rawState === "closed" ? "disconnected" :
      rawState === "qr"    ? "connecting"   :
      rawState

    // Se conectado mas sem banco → salva automaticamente
    if (evStatus === "connected" && !dbRecord) {
      await ensureWhatsappTable(orgId, instanceName, "connected")
    }

    if (evStatus === "connecting") {
      try {
        const qrRes = await evolutionFetch(`/instance/connect/${instanceName}`)
        const qrData = await qrRes.json() as Record<string, any>
        qrCode = qrData?.base64 || qrData?.qrcode?.base64 || null
      } catch { }
    }

    // Lê mirror_enabled (coluna pode não existir em produção antiga)
    let mirrorEnabled = false
    try {
      const rows = await prisma.$queryRaw<[{ mirror_enabled: boolean }]>`
        SELECT mirror_enabled FROM whatsapp_integrations WHERE organization_id = ${orgId}::uuid LIMIT 1
      `
      mirrorEnabled = rows[0]?.mirror_enabled ?? false
    } catch { }

    return {
      ok: true,
      status: evStatus,
      connection: {
        instance_name: instanceName,
        phone_number: null,
        status: evStatus,
        qr_code: qrCode,
        connected_at: dbRecord?.connectedAt || null,
        last_connected_at: null,
        last_disconnected_at: null,
        mirror_enabled: mirrorEnabled,
        mirror_enabled_at: null,
      },
    }
  })

  // POST /whatsapp/me/connect — conecta org autenticada (cria ou reutiliza instância)
  fastify.post("/whatsapp/me/connect", async (req, reply) => {
    const orgId = req.auth.orgId
    const webhookUrl = `${process.env.API_URL || "https://auto-lead-api.upw28y.easypanel.host"}/whatsapp/webhook`

    // Nome da instância = nome da organização sanitizado (sem espaços/especiais)
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } })
    const orgSlug = (org?.name || orgId)
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove acentos
      .replace(/[^a-z0-9]+/g, "-")                      // não-alfanumérico → hífen
      .replace(/^-+|-+$/g, "")                          // trim hífens
      .slice(0, 50)
    const defaultInstanceName = orgSlug || `org-${orgId}`

    // Busca registro existente no banco
    let existing: any = null
    try {
      existing = await prisma.whatsappIntegration.findFirst({ where: { organizationId: orgId } })
    } catch { /* tabela pode não existir */ }

    if (existing?.instanceName) {
      try {
        const stateRes = await evolutionFetch(`/instance/connectionState/${existing.instanceName}`)
        const stateData = await stateRes.json() as Record<string, any>
        if (stateData?.instance?.state === "open") {
          return { ok: true, already_connected: true }
        }
      } catch { /* continua */ }
    }

    const targetInstance = existing?.instanceName || defaultInstanceName

    // Verifica estado na Evolution antes de tentar criar (evita ciclo QR se já estiver open)
    try {
      const stateRes = await evolutionFetch(`/instance/connectionState/${targetInstance}`)
      const stateData = await stateRes.json() as Record<string, any>
      const currentState = stateData?.instance?.state
      if (currentState === "open") {
        await ensureWhatsappTable(orgId, targetInstance, "connected")
        return { ok: true, already_connected: true }
      }
    } catch { /* instância não existe ainda — continua para create */ }

    // Cria instância na Evolution
    const createRes = await evolutionFetch("/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName: targetInstance,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: false,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
        },
      }),
    })
    const createData = await createRes.json() as Record<string, any>

    if (!createRes.ok) {
      if (createRes.status === 403) {
        // Instância já existe mas não estava "open" na checagem anterior — tenta pegar QR
        try {
          const qrRes = await evolutionFetch(`/instance/connect/${targetInstance}`)
          const qrData = await qrRes.json() as Record<string, any>
          const qrCode = qrData?.base64 || qrData?.qrcode?.base64 || null
          return reply.code(200).send({ ok: true, instance_name: targetInstance, qr_code: qrCode })
        } catch { }
        return reply.code(200).send({ ok: true, instance_name: targetInstance, qr_code: null })
      }
      fastify.log.error({ status: createRes.status, body: createData }, "Evolution create falhou")
      return reply.code(502).send({
        ok: false,
        error: `Evolution API erro ${createRes.status}: ${JSON.stringify(createData?.response?.message || createData?.error || createData)}`,
      })
    }

    await ensureWhatsappTable(orgId, targetInstance, "connecting")

    // QR vem no create; se não, busca com /instance/connect
    let qrCode: string | null = createData?.qrcode?.base64 || null
    if (!qrCode) {
      try {
        const qrRes = await evolutionFetch(`/instance/connect/${targetInstance}`)
        const qrData = await qrRes.json() as Record<string, any>
        qrCode = qrData?.base64 || qrData?.qrcode?.base64 || null
      } catch { /* non-critical */ }
    }

    return reply.code(201).send({ ok: true, instance_name: targetInstance, qr_code: qrCode })
  })

  // PATCH /whatsapp/me — atualiza configurações da integração (ex: mirror_enabled)
  fastify.patch<{ Body: { mirror_enabled?: boolean } }>("/whatsapp/me", async (req, reply) => {
    const { mirror_enabled } = req.body
    if (mirror_enabled === undefined) return { success: true }

    const orgId = req.auth.orgId
    try {
      // Cria a coluna se ainda não existir (deploy sem migration)
      await prisma.$executeRaw`ALTER TABLE whatsapp_integrations ADD COLUMN IF NOT EXISTS mirror_enabled BOOLEAN DEFAULT false`
      await prisma.$executeRaw`
        UPDATE whatsapp_integrations SET mirror_enabled = ${mirror_enabled} WHERE organization_id = ${orgId}::uuid
      `
    } catch (err: any) {
      fastify.log.warn({ err: err?.message }, "mirror_enabled update falhou")
    }
    return { success: true }
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

  // POST /whatsapp/send-audio — envia áudio (base64 JSON, max ~300KB para 60s a 32kbps)
  fastify.post<{
    Body: { conversation_id: string; audio_base64: string; mime_type?: string }
  }>("/whatsapp/send-audio", { bodyLimit: 5 * 1024 * 1024 } as any, async (req, reply) => {
    const { conversation_id, audio_base64, mime_type = "audio/webm" } = req.body
    const orgId = req.auth.orgId

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversation_id, organizationId: orgId },
      select: { id: true, instanceName: true, contactPhone: true },
    })
    if (!conversation) return reply.code(404).send({ error: "Conversa não encontrada" })

    const dataUri = `data:${mime_type};base64,${audio_base64}`
    const evRes = await evolutionFetch(`/message/sendWhatsAppAudio/${conversation.instanceName}`, {
      method: "POST",
      body: JSON.stringify({ number: conversation.contactPhone, audio: dataUri, delay: 1000 }),
    })

    if (!evRes.ok) {
      const evErr = await evRes.json().catch(() => ({})) as any
      fastify.log.error({ evErr }, "Evolution send-audio error")
      return reply.code(502).send({ error: evErr?.message || "Falha ao enviar áudio" })
    }

    const evData = await evRes.json() as any

    const message = await prisma.message.create({
      data: {
        organizationId: orgId,
        conversationId: conversation_id,
        direction: "outbound",
        body: "🎵 Áudio",
        messageType: "audio",
        channel: "whatsapp",
        mimeType: mime_type,
        externalMessageId: evData?.key?.id || null,
      },
    })

    await prisma.conversation.update({
      where: { id: conversation_id },
      data: { lastMessageAt: new Date(), lastMessagePreview: "🎵 Áudio" },
    })

    emit(orgId, "message:created", { conversationId: conversation_id, message })
    return reply.code(201).send(message)
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
      // Só processa se espelhamento estiver ativado
      let mirrorEnabled = false
      try {
        const rows = await prisma.$queryRaw<[{ mirror_enabled: boolean }]>`
          SELECT mirror_enabled FROM whatsapp_integrations WHERE instance_name = ${instanceName} LIMIT 1
        `
        mirrorEnabled = rows[0]?.mirror_enabled ?? false
      } catch { }
      if (!mirrorEnabled) return { received: true }

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
