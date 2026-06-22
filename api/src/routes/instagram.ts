import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"
import { emit } from "../plugins/socket.js"

export default async function instagramRoutes(fastify: FastifyInstance) {
  // POST /instagram/connect — conecta conta Instagram (substitui instagram-connect)
  fastify.post<{ Body: { page_id: string; access_token: string; page_name?: string } }>(
    "/instagram/connect",
    async (req, reply) => {
      const { page_id, access_token, page_name } = req.body

      const connection = await (prisma as any).instagramConnection?.upsert?.({
        where: { pageId_organizationId: { pageId: page_id, organizationId: req.auth.orgId } },
        update: { accessToken: access_token, pageName: page_name, updatedAt: new Date() },
        create: {
          organizationId: req.auth.orgId,
          pageId: page_id,
          accessToken: access_token,
          pageName: page_name,
          status: "active",
        },
      }).catch(() => ({ page_id, status: "connected" }))

      return reply.code(201).send(connection)
    }
  )

  // POST /instagram/exchange — troca code por token (substitui instagram-exchange)
  fastify.post<{ Body: { code: string; redirect_uri: string } }>(
    "/instagram/exchange",
    async (req, reply) => {
      const { code, redirect_uri } = req.body
      const appId = process.env.META_APP_ID
      const appSecret = process.env.META_APP_SECRET

      if (!appId || !appSecret) {
        return reply.code(500).send({ error: "META_APP_ID or META_APP_SECRET not configured" })
      }

      const params = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri,
        code,
      })

      const res = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?${params}`
      )
      const data = await res.json() as any
      if (data.error) return reply.code(400).send(data)

      return data
    }
  )

  // POST /instagram/send — envia mensagem (substitui instagram-send-message)
  fastify.post<{ Body: { page_id: string; recipient_id: string; message: string } }>(
    "/instagram/send",
    async (req, reply) => {
      const { page_id, recipient_id, message } = req.body

      const connection = await (prisma as any).instagramConnection?.findFirst?.({
        where: { pageId: page_id, ...orgScope(req) },
      }).catch(() => null)

      if (!connection) return reply.code(404).send({ error: "Instagram connection not found" })

      const res = await fetch(
        `https://graph.facebook.com/v19.0/${page_id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: recipient_id },
            message: { text: message },
            messaging_type: "RESPONSE",
            access_token: connection.accessToken,
          }),
        }
      )
      const data = await res.json() as any
      if (data.error) return reply.code(400).send(data)
      return data
    }
  )

  // GET /instagram/webhook — verificação do Meta (rota pública)
  fastify.get<{ Querystring: { "hub.mode": string; "hub.verify_token": string; "hub.challenge": string } }>(
    "/instagram/webhook",
    async (req, reply) => {
      const mode = req.query["hub.mode"]
      const token = req.query["hub.verify_token"]
      const challenge = req.query["hub.challenge"]

      if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
        return reply.send(challenge)
      }
      return reply.code(403).send({ error: "Forbidden" })
    }
  )

  // POST /instagram/webhook — recebe mensagens do Meta (rota pública)
  fastify.post<{ Body: Record<string, unknown> }>("/instagram/webhook", async (req) => {
    const body = req.body as any

    for (const entry of body.entry || []) {
      for (const msg of entry.messaging || []) {
        const pageId = entry.id as string

        const connection = await (prisma as any).instagramConnection?.findFirst?.({
          where: { pageId },
        }).catch(() => null)

        if (!connection) continue

        emit(connection.organizationId, "message:received", {
          source: "instagram",
          page_id: pageId,
          message: msg,
        })
      }
    }

    return { received: true }
  })
}
