import fp from "fastify-plugin"
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import { prisma } from "../lib/prisma.js"

declare module "fastify" {
  interface FastifyRequest {
    auth: {
      userId: string   // Clerk user ID (user_xxx)
      profileId: string // Profile UUID no banco
      orgId: string
      role: string     // 'admin' | 'seller'
    }
  }
}

const PUBLIC_PREFIXES = [
  "/health",
  "/whatsapp/debug",
  "/whatsapp/send-audio", // auth verificado manualmente no handler (evita preflight CORS)
  "/auth/",
  "/organizations/bootstrap",
  "/leads/webhook",
  "/webhooks/lead",
  "/whatsapp/webhook",
  "/instagram/webhook",
  "/meta/webhook",
  "/meta/oauth/callback",
  "/meta/leads/ingest",
  "/billing/webhook",
]

async function authPlugin(fastify: FastifyInstance) {
  fastify.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    // Preflight CORS — nunca bloquear OPTIONS
    if (req.method === "OPTIONS") return

    const isPublic = PUBLIC_PREFIXES.some((prefix) => req.url.startsWith(prefix))
    if (isPublic) return

    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing authorization header" })
    }

    const token = authHeader.slice(7)

    try {
      const { verifyToken } = await import("@clerk/backend")
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      })

      const userId = payload.sub

      const profile = await prisma.profile.findFirst({
        where: { clerkUserId: userId },
        select: { id: true, organizationId: true, role: true },
      })

      if (!profile?.organizationId) {
        return reply.code(401).send({ error: "No organization found for user" })
      }

      req.auth = { userId, profileId: profile.id, orgId: profile.organizationId, role: profile.role }
    } catch {
      return reply.code(401).send({ error: "Invalid token" })
    }
  })
}

export default fp(authPlugin, { name: "auth" })
