import fp from "fastify-plugin"
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"

declare module "fastify" {
  interface FastifyRequest {
    auth: {
      userId: string
      orgId: string
    }
  }
}

// Routes that skip Clerk auth (webhooks, health)
const PUBLIC_PREFIXES = [
  "/health",
  "/leads/webhook",
  "/whatsapp/webhook",
  "/instagram/webhook",
  "/whatsapp/webhook",
  "/instagram/webhook",
  "/meta/webhook",
  "/meta/oauth/callback",
  "/meta/leads/ingest",
  "/billing/webhook",
]

async function authPlugin(fastify: FastifyInstance) {
  fastify.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const isPublic = PUBLIC_PREFIXES.some((prefix) => req.url.startsWith(prefix))
    if (isPublic) return

    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing authorization header" })
    }

    const token = authHeader.slice(7)

    try {
      const { createClerkClient } = await import("@clerk/fastify")
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
      const payload = await clerk.verifyToken(token)

      const orgId = payload.org_id as string | undefined
      const userId = payload.sub

      if (!orgId) {
        return reply.code(401).send({ error: "No organization in token" })
      }

      req.auth = { userId, orgId }
    } catch {
      return reply.code(401).send({ error: "Invalid token" })
    }
  })
}

export default fp(authPlugin, { name: "auth" })
