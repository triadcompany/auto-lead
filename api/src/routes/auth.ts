import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"

async function verifyClerkToken(token: string): Promise<string> {
  const { verifyToken } = await import("@clerk/backend")
  const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
  return payload.sub
}

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/sync — verifica se usuário tem perfil e retorna org info (sem org_id no token)
  fastify.post<{
    Body: { email: string; name: string; avatar_url?: string }
  }>("/auth/sync", async (req, reply) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing authorization header" })
    }

    let userId: string
    try {
      userId = await verifyClerkToken(authHeader.slice(7))
    } catch {
      return reply.code(401).send({ error: "Invalid token" })
    }

    const { email, name, avatar_url } = req.body

    const profile = await prisma.profile.findFirst({
      where: { clerkUserId: userId },
      include: { organization: true },
    })

    if (!profile || !profile.organizationId) {
      return { ok: true, profile: null, org: null, needsOnboarding: true }
    }

    const needsUpdate =
      profile.email !== email ||
      profile.name !== name ||
      (avatar_url && profile.avatarUrl !== avatar_url)

    let finalProfile: typeof profile = profile
    if (needsUpdate) {
      finalProfile = await prisma.profile.update({
        where: { id: profile.id },
        data: {
          email,
          name,
          ...(avatar_url && { avatarUrl: avatar_url }),
          updatedAt: new Date(),
        },
        include: { organization: true },
      }) as typeof profile
    }

    return {
      ok: true,
      profile: finalProfile,
      org: {
        org_id: finalProfile.organizationId,
        clerk_org_id: finalProfile.organizationId,
        role: finalProfile.role as string,
      },
      needsOnboarding: false,
    }
  })
}
