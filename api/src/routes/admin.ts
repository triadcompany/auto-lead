import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"

async function isSuperAdmin(profileId: string): Promise<boolean> {
  const email = process.env.SUPERADMIN_EMAIL
  if (!email) return false
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { email: true },
  })
  return profile?.email === email
}

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.get("/admin/organizations", async (req, reply) => {
    if (!await isSuperAdmin(req.auth.profileId)) return reply.code(403).send({ error: "Forbidden" })

    const orgs = await prisma.organization.findMany({
      where: { isActive: true, clerkOrgId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { profiles: true } },
        profiles: {
          take: 3,
          select: { email: true, role: true },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    const orgIds = orgs.map(o => o.id)
    const subs = await prisma.subscription.findMany({
      where: { clerkOrganizationId: { in: orgIds } },
      select: {
        clerkOrganizationId: true,
        plan: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
      },
    })

    const subByOrg = new Map(subs.map(s => [s.clerkOrganizationId, s]))
    return orgs.map(org => ({
      id: org.id,
      name: org.name,
      createdAt: org.createdAt,
      userCount: org._count.profiles,
      emails: org.profiles.map(p => p.email),
      subscription: subByOrg.get(org.id) ?? null,
    }))
  })

  fastify.get<{ Params: { id: string } }>("/admin/organizations/:id/grants", async (req, reply) => {
    if (!await isSuperAdmin(req.auth.profileId)) return reply.code(403).send({ error: "Forbidden" })
    return prisma.adminGrant.findMany({
      where: { organizationId: req.params.id },
      orderBy: { createdAt: "desc" },
    })
  })

  fastify.post<{
    Params: { id: string }
    Body: { plan: string; expires_at?: string | null }
  }>("/admin/organizations/:id/grant", async (req, reply) => {
    if (!await isSuperAdmin(req.auth.profileId)) return reply.code(403).send({ error: "Forbidden" })

    const profile = await prisma.profile.findUnique({
      where: { id: req.auth.profileId },
      select: { email: true },
    })
    const grantedBy = profile?.email ?? "superadmin"
    const { plan, expires_at } = req.body
    const orgId = req.params.id
    const expiresAt = expires_at ? new Date(expires_at) : new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000)

    const existing = await prisma.subscription.findFirst({ where: { clerkOrganizationId: orgId } })
    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          plan,
          status: "active",
          stripeCustomerId: `free_${orgId}`,
          stripeSubscriptionId: `free_${orgId}_${Date.now()}`,
          currentPeriodStart: new Date(),
          currentPeriodEnd: expiresAt,
          cancelAtPeriodEnd: false,
          updatedAt: new Date(),
        },
      })
    } else {
      await prisma.subscription.create({
        data: {
          clerkOrganizationId: orgId,
          clerkUserId: req.auth.userId,
          stripeCustomerId: `free_${orgId}`,
          stripeSubscriptionId: `free_${orgId}_${Date.now()}`,
          plan,
          billingCycle: "monthly",
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: expiresAt,
          cancelAtPeriodEnd: false,
        },
      })
    }

    await prisma.adminGrant.create({
      data: { organizationId: orgId, action: "grant", plan, expiresAt, grantedBy },
    })

    return { success: true }
  })

  fastify.post<{ Params: { id: string } }>("/admin/organizations/:id/deactivate", async (req, reply) => {
    if (!await isSuperAdmin(req.auth.profileId)) return reply.code(403).send({ error: "Forbidden" })
    await prisma.organization.update({
      where: { id: req.params.id },
      data: { isActive: false },
    })
    return { success: true }
  })

  fastify.post<{ Params: { id: string } }>("/admin/organizations/:id/revoke", async (req, reply) => {
    if (!await isSuperAdmin(req.auth.profileId)) return reply.code(403).send({ error: "Forbidden" })

    const profile = await prisma.profile.findUnique({
      where: { id: req.auth.profileId },
      select: { email: true },
    })
    const grantedBy = profile?.email ?? "superadmin"
    const orgId = req.params.id

    await prisma.subscription.updateMany({
      where: { clerkOrganizationId: orgId },
      data: { status: "inactive", updatedAt: new Date() },
    })

    await prisma.adminGrant.create({
      data: { organizationId: orgId, action: "revoke", grantedBy },
    })

    return { success: true }
  })

  // ── Gestão de usuários por empresa (Superadmin) ────────────────────────────

  // GET /admin/organizations/:id/users — lista usuários da empresa com papel
  fastify.get<{ Params: { id: string } }>("/admin/organizations/:id/users", async (req, reply) => {
    if (!await isSuperAdmin(req.auth.profileId)) return reply.code(403).send({ error: "Forbidden" })

    const [users, pendingInvites] = await Promise.all([
      prisma.profile.findMany({
        where: { organizationId: req.params.id },
        select: { id: true, name: true, email: true, role: true, avatarUrl: true, clerkUserId: true, createdAt: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
      prisma.userInvitation.findMany({
        where: { organizationId: req.params.id, status: "pending" },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }).catch(() => []),
    ])

    return { users, pending_invites: pendingInvites }
  })

  // POST /admin/organizations/:id/users — adiciona usuário à empresa (via convite)
  fastify.post<{
    Params: { id: string }
    Body: { email: string; name?: string; role?: "admin" | "seller" }
  }>("/admin/organizations/:id/users", async (req, reply) => {
    if (!await isSuperAdmin(req.auth.profileId)) return reply.code(403).send({ error: "Forbidden" })

    const orgId = req.params.id
    const { email, name } = req.body
    if (!email?.trim()) return reply.code(400).send({ error: "email obrigatório" })
    const role = (req.body.role === "admin" ? "admin" : "seller") as "admin" | "seller"

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true } })
    if (!org) return reply.code(404).send({ error: "Organização não encontrada" })

    // Se o usuário já tem perfil (em qualquer org), move para esta empresa direto
    const existingProfile = await prisma.profile.findFirst({
      where: { email: email.trim() },
      select: { id: true },
    })
    if (existingProfile) {
      await prisma.profile.update({
        where: { id: existingProfile.id },
        data: { organizationId: orgId, role, updatedAt: new Date() },
      })
      return { success: true, moved: true, profile_id: existingProfile.id }
    }

    // Senão, cria/renova convite pendente para esta org
    const existingInvite = await prisma.userInvitation.findFirst({
      where: { organizationId: orgId, email: email.trim(), status: "pending" },
    }).catch(() => null)
    if (existingInvite) {
      await prisma.userInvitation.update({
        where: { id: existingInvite.id },
        data: { role, name: name || existingInvite.name, updatedAt: new Date() },
      })
    }
    const invite = existingInvite
      ? existingInvite
      : await prisma.userInvitation.create({
          data: {
            organizationId: orgId, email: email.trim(),
            name: name || email.trim(), role, status: "pending",
            invitedBy: req.auth.profileId,
          },
        })

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080"
    const inviteUrl = `${frontendUrl}/invite?token=${invite.id}`

    // Envia e-mail se o Resend estiver configurado (best-effort)
    const key = process.env.RESEND_API_KEY
    if (key) {
      const from = process.env.FROM_EMAIL || "Triad CRM <noreply@triadcomp4ny.com.br>"
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from, to: [email.trim()],
          subject: `Convite para ${org.name} no Triad CRM`,
          html: `<p>Você foi convidado para <strong>${org.name}</strong> no Triad CRM.</p><p><a href="${inviteUrl}">Aceitar convite</a></p>`,
        }),
      }).catch((e) => console.error("[admin] invite email error:", e))
    }

    return { success: true, invited: true, invite_url: inviteUrl, invitation_id: invite.id }
  })

  // PATCH /admin/organizations/:id/users/:profileId — altera papel do usuário
  fastify.patch<{
    Params: { id: string; profileId: string }
    Body: { role: "admin" | "seller" }
  }>("/admin/organizations/:id/users/:profileId", async (req, reply) => {
    if (!await isSuperAdmin(req.auth.profileId)) return reply.code(403).send({ error: "Forbidden" })
    const role = (req.body.role === "admin" ? "admin" : "seller") as "admin" | "seller"
    const updated = await prisma.profile.updateMany({
      where: { id: req.params.profileId, organizationId: req.params.id },
      data: { role, updatedAt: new Date() },
    })
    if (updated.count === 0) return reply.code(404).send({ error: "Usuário não encontrado nesta empresa" })
    return { success: true }
  })

  // DELETE /admin/organizations/:id/users/:profileId — remove usuário da empresa
  fastify.delete<{ Params: { id: string; profileId: string } }>(
    "/admin/organizations/:id/users/:profileId",
    async (req, reply) => {
      if (!await isSuperAdmin(req.auth.profileId)) return reply.code(403).send({ error: "Forbidden" })
      const deleted = await prisma.profile.deleteMany({
        where: { id: req.params.profileId, organizationId: req.params.id },
      })
      if (deleted.count === 0) return reply.code(404).send({ error: "Usuário não encontrado" })
      return { success: true }
    }
  )
}
