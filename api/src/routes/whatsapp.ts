import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"
import { emit } from "../plugins/socket.js"

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

export default async function whatsappRoutes(fastify: FastifyInstance) {
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
      emit(orgId, "message:received", { source: "whatsapp", instance: instanceName, message })
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
