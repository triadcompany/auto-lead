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
    Body: { email: string; name: string; avatar_url?: string; invitation_token?: string }
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

    const { email, name, avatar_url, invitation_token } = req.body

    let profile = await prisma.profile.findFirst({
      where: { clerkUserId: userId },
      include: { organization: true },
    })

    // Fluxo de convite: usuário sem org + token válido → anexa à empresa convidada
    if ((!profile || !profile.organizationId) && invitation_token) {
      const invite = await prisma.userInvitation.findUnique({
        where: { id: invitation_token },
      }).catch(() => null)

      if (invite && invite.status === "pending") {
        profile = await prisma.profile.upsert({
          where: { clerkUserId: userId },
          update: {
            organizationId: invite.organizationId,
            role: invite.role,
            email, name,
            ...(avatar_url && { avatarUrl: avatar_url }),
            updatedAt: new Date(),
          },
          create: {
            clerkUserId: userId,
            email: email || invite.email,
            name: name || invite.name || invite.email,
            organizationId: invite.organizationId,
            role: invite.role,
            ...(avatar_url && { avatarUrl: avatar_url }),
          },
          include: { organization: true },
        })
        await prisma.userInvitation.update({
          where: { id: invite.id },
          data: { status: "accepted", updatedAt: new Date() },
        }).catch(() => null)
      }
    }

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
        name: (finalProfile as any).organization?.name || '',
      },
      needsOnboarding: false,
    }
  })
}
