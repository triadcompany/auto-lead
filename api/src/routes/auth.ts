import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { resolveActiveProfile } from "../lib/auth.js"

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

    // Fluxo de convite: token válido e pendente → anexa (ou reanexa) o usuário à
    // organização convidada — mesmo que ele já pertença a outra(s) (multi-org).
    // Isso acontece automaticamente, sem tela de confirmação.
    let justJoinedOrgId: string | null = null
    if (invitation_token) {
      const invite = await prisma.userInvitation.findUnique({
        where: { id: invitation_token },
      }).catch(() => null)

      if (invite && invite.status === "pending") {
        await prisma.profile.upsert({
          where: { clerkUserId_organizationId: { clerkUserId: userId, organizationId: invite.organizationId } },
          update: {
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
        })
        await prisma.userInvitation.update({
          where: { id: invite.id },
          data: { status: "accepted", updatedAt: new Date() },
        }).catch(() => null)
        justJoinedOrgId = invite.organizationId
      }
    }

    // A organização recém-aceita tem prioridade nesta chamada (o usuário acabou
    // de entrar, deve cair nela); caso contrário usa a mesma resolução do resto da API.
    const active = await resolveActiveProfile(userId, justJoinedOrgId || undefined)

    if (!active.profile) {
      return { ok: true, profile: null, org: null, needsOnboarding: true }
    }

    if (justJoinedOrgId) {
      await prisma.usersProfile.upsert({
        where: { clerkUserId: userId },
        update: { lastActiveOrganizationId: justJoinedOrgId },
        create: { clerkUserId: userId, lastActiveOrganizationId: justJoinedOrgId },
      }).catch(() => null)
    }

    let profile = await prisma.profile.findUnique({
      where: { id: active.profile.id },
      include: { organization: true },
    })
    if (!profile) {
      return { ok: true, profile: null, org: null, needsOnboarding: true }
    }

    const needsUpdate =
      profile.email !== email ||
      profile.name !== name ||
      (avatar_url && profile.avatarUrl !== avatar_url)

    if (needsUpdate) {
      profile = await prisma.profile.update({
        where: { id: profile.id },
        data: {
          email,
          name,
          ...(avatar_url && { avatarUrl: avatar_url }),
          updatedAt: new Date(),
        },
        include: { organization: true },
      })
    }

    return {
      ok: true,
      profile,
      org: {
        org_id: profile.organizationId,
        clerk_org_id: profile.organizationId,
        role: profile.role as string,
        name: (profile as any).organization?.name || '',
      },
      needsOnboarding: false,
    }
  })
}
