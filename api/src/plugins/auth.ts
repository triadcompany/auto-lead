import fp from "fastify-plugin"
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import { prisma } from "../lib/prisma.js"

declare module "fastify" {
  interface FastifyRequest {
    auth: {
      userId: string
      orgId: string
    }
  }
}

const PUBLIC_PREFIXES = [
  "/health",
  "/auth/",
  "/organizations/bootstrap",
  "/leads/webhook",
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
      const { verifyToken } = await import("@clerk/backend")
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      })

      const userId = payload.sub

      const profile = await prisma.profile.findFirst({
        where: { clerkUserId: userId },
        select: { organizationId: true },
      })

      if (!profile?.organizationId) {
        return reply.code(401).send({ error: "No organization found for user" })
      }

      req.auth = { userId, orgId: profile.organizationId }
    } catch {
      return reply.code(401).send({ error: "Invalid token" })
    }
  })
}

export default fp(authPlugin, { name: "auth" })
