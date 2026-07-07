import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"
import { emit } from "../plugins/socket.js"
import { evolutionFetch } from "../lib/evolution.js"

// Cache em memória para buffers de áudio (evita re-buscar no Evolution a cada abertura)
const audioCache = new Map<string, { buf: Buffer; mime: string }>()
const AUDIO_CACHE_MAX = 200

function cacheAudio(msgId: string, buf: Buffer, mime: string) {
  if (audioCache.size >= AUDIO_CACHE_MAX) {
    audioCache.delete(audioCache.keys().next().value as string)
  }
  audioCache.set(msgId, { buf, mime })
}

export default async function conversationsRoutes(fastify: FastifyInstance) {
  // GET /conversations
  fastify.get<{
    Querystring: {
      status?: string
      assigned_to?: string
      channel?: string
      ai_mode?: string
      search?: string
      limit?: string
      offset?: string
    }
  }>("/conversations", async (req) => {
    const { status, assigned_to, channel, ai_mode, search, limit, offset } = req.query
    return prisma.conversation.findMany({
      where: {
        ...orgScope(req),
        ...(status && { status }),
        ...(assigned_to && { assignedTo: assigned_to }),
        ...(channel && { channel }),
        ...(ai_mode && { aiMode: ai_mode }),
        ...(search && {
          OR: [
            { contactName: { contains: search, mode: "insensitive" } },
            { contactPhone: { contains: search } },
          ],
        }),
      },
      orderBy: { lastMessageAt: "desc" },
      take: Number(limit) || 50,
      skip: Number(offset) || 0,
    })
  })

  // GET /conversations/:id
  fastify.get<{ Params: { id: string } }>("/conversations/:id", async (req, reply) => {
    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, ...orgScope(req) },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 100 }, notes: true },
    })
    if (!conv) return reply.code(404).send({ error: "Not found" })
    return conv
  })

  // PATCH /conversations/:id — atualiza status, assignee, lock, ai_mode etc
  fastify.patch<{
    Params: { id: string }
    Body: Record<string, unknown>
  }>("/conversations/:id", async (req, reply) => {
    const b = req.body as any
    const data: Record<string, unknown> = {
      ...(b.status !== undefined && { status: b.status }),
      ...(b.assigned_to !== undefined && {
        assignedTo: b.assigned_to,
        assignedAt: b.assigned_to ? new Date() : null,
      }),
      ...(b.ai_mode !== undefined && { aiMode: b.ai_mode }),
      ...(b.lead_id !== undefined && { leadId: b.lead_id }),
      ...(b.unread_count !== undefined && { unreadCount: b.unread_count }),
      ...(b.locked_by !== undefined && { lockedBy: b.locked_by }),
      ...(b.locked_at !== undefined && { lockedAt: b.locked_at ? new Date(b.locked_at as string) : null }),
      ...(b.last_status_change_at !== undefined && { lastStatusChangeAt: b.last_status_change_at ? new Date(b.last_status_change_at as string) : null }),
      ...(b.assigned_at !== undefined && { assignedAt: b.assigned_at ? new Date(b.assigned_at as string) : null }),
    }

    if (Object.keys(data).length === 0) return { success: true }

    const updated = await prisma.conversation.updateMany({
      where: { id: req.params.id, ...orgScope(req) },
      data,
    })
    if (updated.count === 0) return reply.code(404).send({ error: "Not found" })

    emit(req.auth.orgId, "conversation:updated", { conversationId: req.params.id, ...req.body })
    return { success: true }
  })

  // GET /conversations/:id/messages/:msgId/audio — proxy para áudio incoming
  fastify.get<{ Params: { id: string; msgId: string } }>(
    "/conversations/:id/messages/:msgId/audio",
    async (req, reply) => {
      const msgId = req.params.msgId

      // 1. Cache em memória (sobrevive enquanto o processo rodar)
      const cached = audioCache.get(msgId)
      if (cached) {
        reply.header("Content-Type", cached.mime)
        reply.header("Cache-Control", "public, max-age=86400")
        return reply.send(cached.buf)
      }

      const msg = await prisma.message.findFirst({
        where: { id: msgId, conversationId: req.params.id, organizationId: req.auth.orgId },
      })
      if (!msg) return reply.code(404).send({ error: "Not found" })

      // 2. Se já temos URL HTTP, redireciona
      if (msg.mediaUrl && msg.mediaUrl.startsWith("http")) {
        return reply.redirect(msg.mediaUrl)
      }

      if (!msg.externalMessageId) return reply.code(404).send({ error: "No external ID" })

      const conv = await prisma.conversation.findFirst({
        where: { id: req.params.id, organizationId: req.auth.orgId },
        select: { instanceName: true, contactPhone: true },
      })
      if (!conv?.instanceName) return reply.code(404).send({ error: "No instance" })

      // 3. Busca o áudio no Evolution via getBase64FromMediaMessage
      const remoteJid = `${conv.contactPhone}@s.whatsapp.net`
      const evRes = await evolutionFetch(
        `/chat/getBase64FromMediaMessage/${conv.instanceName}`,
        {
          method: "POST",
          body: JSON.stringify({
            message: {
              key: {
                id: msg.externalMessageId,
                remoteJid,
                fromMe: msg.direction === "outbound",
              },
            },
          }),
        }
      )

      if (!evRes.ok) return reply.code(404).send({ error: "Media not available" })

      const data = await evRes.json() as any
      if (!data?.base64) return reply.code(404).send({ error: "No base64" })

      const buffer = Buffer.from(data.base64, "base64")
      const mimeType = (data.mimetype || msg.mimeType || "audio/ogg").split(";")[0]

      // 4. Guarda no cache em memória
      cacheAudio(msgId, buffer, mimeType)

      reply.header("Content-Type", mimeType)
      reply.header("Cache-Control", "public, max-age=86400")
      return reply.send(buffer)
    }
  )

  // GET /conversations/:id/messages
  fastify.get<{
    Params: { id: string }
    Querystring: { limit?: string; before?: string }
  }>("/conversations/:id/messages", async (req, reply) => {
    const { limit, before } = req.query
    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, ...orgScope(req) },
      select: { id: true },
    })
    if (!conv) return reply.code(404).send({ error: "Not found" })

    return prisma.message.findMany({
      where: {
        conversationId: req.params.id,
        organizationId: req.auth.orgId,
        ...(before && { createdAt: { lt: new Date(before) } }),
      },
      orderBy: { createdAt: "desc" },
      take: Number(limit) || 50,
    })
  })

  // POST /conversations/:id/messages — envia mensagem manual pelo inbox
  fastify.post<{
    Params: { id: string }
    Body: { body: string; message_type?: string }
  }>("/conversations/:id/messages", async (req, reply) => {
    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, ...orgScope(req) },
      select: { id: true, channel: true, instanceName: true, contactPhone: true, leadId: true },
    })
    if (!conv) return reply.code(404).send({ error: "Not found" })

    // SLA: marca a 1ª resposta do vendedor ao lead (só se ainda não houver)
    if (conv.leadId) {
      setImmediate(() =>
        prisma.lead.updateMany({
          where: { id: conv.leadId!, firstResponseAt: null },
          data: { firstResponseAt: new Date() },
        }).catch(() => null)
      )
    }

    const sender = await prisma.profile.findUnique({
      where: { id: req.auth.profileId },
      select: { name: true },
    }).catch(() => null)

    const message = await prisma.message.create({
      data: {
        organizationId: req.auth.orgId,
        conversationId: req.params.id,
        direction: "outbound",
        body: req.body.body,
        messageType: req.body.message_type || "text",
        channel: conv.channel,
        senderName: sender?.name || null,
      },
    })

    await prisma.conversation.update({
      where: { id: req.params.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: req.body.body.substring(0, 100),
        unreadCount: 0,
      },
    })

    // Envia ao WhatsApp via Evolution API (não bloqueia a resposta)
    if (conv.channel === "whatsapp" && conv.instanceName && conv.contactPhone) {
      evolutionFetch(`/message/sendText/${conv.instanceName}`, {
        method: "POST",
        body: JSON.stringify({ number: conv.contactPhone, text: req.body.body }),
      }).catch((err) => fastify.log.error({ err }, "Falha ao enviar mensagem para WhatsApp"))
    }

    emit(req.auth.orgId, "message:created", { conversationId: req.params.id, message })
    return reply.code(201).send(message)
  })

  // POST /conversations/:id/notes
  fastify.post<{ Params: { id: string }; Body: { content: string } }>(
    "/conversations/:id/notes",
    async (req, reply) => {
      const note = await prisma.conversationNote.create({
        data: {
          conversationId: req.params.id,
          organizationId: req.auth.orgId,
          content: req.body.content,
          createdBy: req.auth.profileId,
        },
      })
      return reply.code(201).send(note)
    }
  )

  // POST /conversations/:id/read — marca como lido
  fastify.post<{ Params: { id: string } }>("/conversations/:id/read", async (req) => {
    await prisma.conversation.updateMany({
      where: { id: req.params.id, ...orgScope(req) },
      data: { unreadCount: 0 },
    })
    return { success: true }
  })

  // POST /conversations/:id/transfer — transfere conversa
  fastify.post<{ Params: { id: string }; Body: { to_user_id: string; reason?: string } }>(
    "/conversations/:id/transfer",
    async (req, reply) => {
      await prisma.conversation.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data: { assignedTo: req.body.to_user_id, assignedAt: new Date() },
      })
      emit(req.auth.orgId, "conversation:transferred", {
        conversationId: req.params.id,
        fromUserId: req.auth.userId,
        toUserId: req.body.to_user_id,
      })
      return { success: true }
    }
  )

  // PATCH /conversations/:id/ai-state — atualiza modo IA da conversa
  fastify.patch<{ Params: { id: string }; Body: { state: string } }>(
    "/conversations/:id/ai-state",
    async (req, reply) => {
      const updated = await prisma.conversation.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data: { aiMode: req.body.state as any },
      })
      if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
      return { ok: true }
    }
  )

  // GET /conversations/:id/tasks — tarefas vinculadas à conversa
  fastify.get<{ Params: { id: string } }>("/conversations/:id/tasks", async (req) => {
    return prisma.task.findMany({
      where: { conversationId: req.params.id, ...orgScope(req) },
      orderBy: { createdAt: "asc" },
      include: { assignee: { select: { id: true, name: true } } },
    })
  })

  // POST /conversations/:id/tasks — cria tarefa para a conversa
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/conversations/:id/tasks",
    async (req, reply) => {
      const b = req.body as any
      const task = await prisma.task.create({
        data: {
          organizationId: req.auth.orgId,
          leadId: b.lead_id || null,
          conversationId: req.params.id,
          titulo: b.titulo,
          descricao: b.descricao || null,
          priority: (b.prioridade || "media") as any,
          status: "pendente" as any,
          dueDate: b.data_hora ? new Date(b.data_hora) : null,
          assignedTo: b.responsavel_id || null,
          createdBy: req.auth.profileId,
        },
      })
      return reply.code(201).send(task)
    }
  )

  // GET /conversations/:id/appointments — stub (sem modelo por ora)
  fastify.get<{ Params: { id: string } }>("/conversations/:id/appointments", async () => [])

  // POST /conversations/:id/appointments — stub
  fastify.post<{ Params: { id: string } }>("/conversations/:id/appointments", async (req, reply) =>
    reply.code(201).send({ ok: true })
  )

  // GET /conversations/:id/ai-jobs — último job de IA bloqueado
  fastify.get<{ Params: { id: string } }>("/conversations/:id/ai-jobs", async (req) => {
    const job = await (prisma as any).aiAutoReplyJob?.findFirst?.({
      where: { conversationId: req.params.id, status: "blocked", ...orgScope(req) },
      select: { id: true, status: true, error: true, result: true, processedAt: true },
      orderBy: { processedAt: "desc" },
    }).catch(() => null)
    return job || null
  })

  // GET /conversations/:id/intelligence — dados de inteligência da conversa
  fastify.get<{ Params: { id: string } }>("/conversations/:id/intelligence", async (req) => {
    return (prisma as any).conversationIntelligence?.findFirst?.({
      where: { conversationId: req.params.id, organizationId: req.auth.orgId },
    }).catch(() => null) || null
  })
}
