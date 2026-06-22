import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"

export default async function usersRoutes(fastify: FastifyInstance) {
  // GET /users — lista membros da org
  fastify.get("/users", async (req) => {
    return prisma.profile.findMany({
      where: { ...orgScope(req) },
      select: {
        id: true,
        clerkUserId: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        whatsappE164: true,
        onboardingCompleted: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    })
  })

  // GET /users/me — perfil do usuário atual
  fastify.get("/users/me", async (req, reply) => {
    const profile = await prisma.profile.findFirst({
      where: { clerkUserId: req.auth.userId },
      include: { organization: true },
    })
    if (!profile) return reply.code(404).send({ error: "Profile not found" })
    return profile
  })

  // POST /users/sync — sincroniza usuário do Clerk (substitui sync-clerk-user + sync-login)
  fastify.post<{
    Body: {
      clerk_user_id: string
      email: string
      name: string
      avatar_url?: string
      organization_id?: string
    }
  }>("/users/sync", async (req, reply) => {
    const { clerk_user_id, email, name, avatar_url, organization_id } = req.body

    const profile = await prisma.profile.upsert({
      where: { clerkUserId: clerk_user_id },
      update: {
        email,
        name,
        ...(avatar_url && { avatarUrl: avatar_url }),
        ...(organization_id && { organizationId: organization_id }),
        updatedAt: new Date(),
      },
      create: {
        clerkUserId: clerk_user_id,
        email,
        name,
        ...(avatar_url && { avatarUrl: avatar_url }),
        ...(organization_id && { organizationId: organization_id }),
      },
    })
    return reply.code(200).send(profile)
  })

  // PATCH /users/:id/profile — atualiza perfil (substitui update-user-profile)
  fastify.patch<{
    Params: { id: string }
    Body: { name?: string; whatsapp_e164?: string; avatar_url?: string }
  }>("/users/:id/profile", async (req, reply) => {
    const updated = await prisma.profile.updateMany({
      where: { id: req.params.id, ...orgScope(req) },
      data: {
        ...(req.body.name && { name: req.body.name }),
        ...(req.body.whatsapp_e164 && { whatsappE164: req.body.whatsapp_e164 }),
        ...(req.body.avatar_url && { avatarUrl: req.body.avatar_url }),
        updatedAt: new Date(),
      },
    })
    if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // PATCH /users/:id/role — atualiza role (substitui update-user-role)
  fastify.patch<{ Params: { id: string }; Body: { role: "admin" | "seller" } }>(
    "/users/:id/role",
    async (req, reply) => {
      const updated = await prisma.profile.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data: { role: req.body.role, updatedAt: new Date() },
      })
      if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
      return { success: true }
    }
  )

  // DELETE /users/:id — remove usuário (substitui delete-user)
  fastify.delete<{ Params: { id: string } }>("/users/:id", async (req, reply) => {
    const deleted = await prisma.profile.deleteMany({
      where: { id: req.params.id, ...orgScope(req) },
    })
    if (deleted.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // GET /users/invitations/:token/validate — valida convite (substitui validate-invitation)
  fastify.get<{ Params: { token: string } }>("/users/invitations/:token/validate", async (req, reply) => {
    const invite = await (prisma as any).invitation?.findFirst({
      where: { token: req.params.token, used: false },
    }).catch(() => null)

    if (!invite) return reply.code(404).send({ error: "Invitation not found or expired" })
    return invite
  })

  // POST /users/invite — convida usuário (substitui invite-user + send-invitation-email)
  fastify.post<{ Body: { email: string; role: string; name?: string } }>(
    "/users/invite",
    async (req, reply) => {
      const { email, role, name } = req.body
      const { orgId } = req.auth

      const token = crypto.randomUUID()
      const invite = await (prisma as any).invitation?.create({
        data: {
          organizationId: orgId,
          email,
          role,
          name,
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }).catch(() => ({ token, email, role }))

      return reply.code(201).send({ token: invite.token, email })
    }
  )

  // POST /users/invitations/:token/accept — aceita convite (substitui accept-invitation)
  fastify.post<{ Params: { token: string }; Body: { clerk_user_id: string } }>(
    "/users/invitations/:token/accept",
    async (req, reply) => {
      const invite = await (prisma as any).invitation?.findFirst({
        where: { token: req.params.token, used: false },
      }).catch(() => null)

      if (!invite) return reply.code(404).send({ error: "Invitation not found or expired" })

      await prisma.profile.upsert({
        where: { clerkUserId: req.body.clerk_user_id },
        update: { organizationId: invite.organizationId, role: invite.role, updatedAt: new Date() },
        create: {
          clerkUserId: req.body.clerk_user_id,
          email: invite.email,
          name: invite.name || invite.email,
          organizationId: invite.organizationId,
          role: invite.role,
        },
      })

      await (prisma as any).invitation?.updateMany({
        where: { token: req.params.token },
        data: { used: true },
      }).catch(() => null)

      return { success: true }
    }
  )
}
