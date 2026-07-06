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
}
