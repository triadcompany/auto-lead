import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"
import { emit } from "../plugins/socket.js"

async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  apiKey: string,
  model = "gpt-4o-mini"
) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  })
  const data = (await res.json()) as any
  if (!res.ok) throw new Error(data.error?.message || "OpenAI error")
  return data.choices[0].message.content as string
}

export default async function aiRoutes(fastify: FastifyInstance) {
  // POST /ai/reply — gera resposta IA para uma conversa (substitui ai-auto-reply manual trigger)
  fastify.post<{
    Body: { conversation_id: string; send?: boolean }
  }>("/ai/reply", async (req, reply) => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return reply.code(500).send({ error: "OPENAI_API_KEY not configured" })

    const conv = await prisma.conversation.findFirst({
      where: { id: req.body.conversation_id, ...orgScope(req) },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 30 } },
    })
    if (!conv) return reply.code(404).send({ error: "Conversation not found" })

    const org = await prisma.organization.findFirst({ where: { id: req.auth.orgId } })
    const systemPrompt = (org as any)?.aiSystemPrompt ||
      "Você é um assistente de vendas prestativo. Responda em português de forma amigável e profissional."

    const messages = conv.messages.map((m) => ({
      role: m.direction === "inbound" ? "user" : "assistant",
      content: m.body || "",
    }))

    const aiReply = await callOpenAI(messages, systemPrompt, apiKey)

    if (req.body.send !== false) {
      const message = await prisma.message.create({
        data: {
          organizationId: req.auth.orgId,
          conversationId: conv.id,
          direction: "outbound",
          body: aiReply,
          aiGenerated: true,
          channel: conv.channel,
        },
      })

      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: aiReply.substring(0, 100),
          lastAiReplyAt: new Date(),
          aiReplyCountSinceLastLead: { increment: 1 },
        },
      })

      emit(req.auth.orgId, "message:sent", { conversationId: conv.id, message })
    }

    return { reply: aiReply }
  })

  // POST /ai/analyze — analisa conversa (substitui ai-analyze-conversation)
  fastify.post<{
    Body: { conversation_id: string }
  }>("/ai/analyze", async (req, reply) => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return reply.code(500).send({ error: "OPENAI_API_KEY not configured" })

    const conv = await prisma.conversation.findFirst({
      where: { id: req.body.conversation_id, ...orgScope(req) },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 50 },
        lead: { select: { id: true, name: true } },
      },
    })
    if (!conv) return reply.code(404).send({ error: "Conversation not found" })

    const transcript = conv.messages
      .map((m) => `${m.direction === "inbound" ? "Cliente" : "Atendente"}: ${m.body || ""}`)
      .join("\n")

    const analysisPrompt = `Analise essa conversa de vendas e retorne um JSON com:
- intent: string (interesse do cliente)
- sentiment: "positive" | "neutral" | "negative"
- stage: string (em qual etapa do funil o lead está)
- key_points: string[] (pontos principais)
- suggested_action: string (próxima ação recomendada)
- qualification_score: number (0-10)

Responda APENAS com o JSON, sem texto adicional.`

    const analysis = await callOpenAI(
      [{ role: "user", content: transcript }],
      analysisPrompt,
      apiKey,
      "gpt-4o-mini"
    )

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(analysis.replace(/```json\n?|\n?```/g, ""))
    } catch {
      parsed = { raw: analysis }
    }

    // Save to conversation_intelligence
    await (prisma as any).conversationIntelligence?.upsert?.({
      where: { conversationId: conv.id },
      update: { ...parsed, updatedAt: new Date() },
      create: { conversationId: conv.id, organizationId: req.auth.orgId, ...parsed },
    }).catch(() => null)

    return parsed
  })

  // GET /ai/jobs — lista jobs de AI pendentes (admin)
  fastify.get<{ Querystring: { status?: string; limit?: string } }>("/ai/jobs", async (req) => {
    return (prisma as any).aiAutoReplyJob?.findMany?.({
      where: {
        ...orgScope(req),
        ...(req.query.status && { status: req.query.status }),
      },
      orderBy: { createdAt: "desc" },
      take: Number(req.query.limit) || 50,
    }).catch(() => [])
  })

  // POST /ai/mode — altera modo de IA de uma conversa
  fastify.post<{ Body: { conversation_id: string; mode: "off" | "auto" | "supervised" } }>(
    "/ai/mode",
    async (req, reply) => {
      const updated = await prisma.conversation.updateMany({
        where: { id: req.body.conversation_id, ...orgScope(req) },
        data: { aiMode: req.body.mode },
      })
      if (updated.count === 0) return reply.code(404).send({ error: "Conversation not found" })
      emit(req.auth.orgId, "conversation:ai_mode", {
        conversationId: req.body.conversation_id,
        mode: req.body.mode,
      })
      return { success: true }
    }
  )
}
