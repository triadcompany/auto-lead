import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"
import { emit } from "../plugins/socket.js"
import { evolutionFetch } from "../lib/evolution.js"

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

  // PATCH /conversations/:id — atualiza status, assignee, ai_mode
  fastify.patch<{
    Params: { id: string }
    Body: {
      status?: string
      assigned_to?: string | null
      ai_mode?: string
      lead_id?: string | null
      unread_count?: number
    }
  }>("/conversations/:id", async (req, reply) => {
    const { status, assigned_to, ai_mode, lead_id, unread_count } = req.body
    const updated = await prisma.conversation.updateMany({
      where: { id: req.params.id, ...orgScope(req) },
      data: {
        ...(status !== undefined && { status }),
        ...(assigned_to !== undefined && {
          assignedTo: assigned_to,
          assignedAt: assigned_to ? new Date() : null,
        }),
        ...(ai_mode !== undefined && { aiMode: ai_mode }),
        ...(lead_id !== undefined && { leadId: lead_id }),
        ...(unread_count !== undefined && { unreadCount: unread_count }),
      },
    })
    if (updated.count === 0) return reply.code(404).send({ error: "Not found" })

    emit(req.auth.orgId, "conversation:updated", { conversationId: req.params.id, ...req.body })
    return { success: true }
  })

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
      select: { id: true, channel: true, instanceName: true, contactPhone: true },
    })
    if (!conv) return reply.code(404).send({ error: "Not found" })

    const message = await prisma.message.create({
      data: {
        organizationId: req.auth.orgId,
        conversationId: req.params.id,
        direction: "outbound",
        body: req.body.body,
        messageType: req.body.message_type || "text",
        channel: conv.channel,
        senderName: req.auth.profileId,
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
}
