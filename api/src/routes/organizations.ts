import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"
import { uploadFile, deleteFile } from "../services/storage.js"

export default async function organizationsRoutes(fastify: FastifyInstance) {
  // GET /organizations/me — dados da org atual
  fastify.get("/organizations/me", async (req, reply) => {
    const org = await prisma.organization.findFirst({
      where: { id: req.auth.orgId },
    })
    if (!org) return reply.code(404).send({ error: "Organization not found" })
    return org
  })

  // POST /organizations/bootstrap — cria org e perfil do owner (rota pública, auto-auth)
  fastify.post<{
    Body: {
      clerk_user_id: string
      org_name: string
      user_name: string
      email: string
      cnpj?: string
    }
  }>("/organizations/bootstrap", async (req, reply) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing authorization header" })
    }

    let userId: string
    try {
      const { verifyToken } = await import("@clerk/backend")
      const payload = await verifyToken(authHeader.slice(7), { secretKey: process.env.CLERK_SECRET_KEY })
      userId = payload.sub
    } catch {
      return reply.code(401).send({ error: "Invalid token" })
    }

    const { clerk_user_id, org_name, user_name, email, cnpj } = req.body
    if (userId !== clerk_user_id) {
      return reply.code(403).send({ error: "Unauthorized" })
    }

    // Se já tem perfil com org, retorna existente
    const existing = await prisma.profile.findFirst({
      where: { clerkUserId: userId },
      include: { organization: true },
    })
    if (existing?.organization) {
      return reply.code(200).send({ org: existing.organization, profile: existing })
    }

    // Cria organização no Clerk
    let clerkOrgId: string | undefined
    try {
      const { createClerkClient } = await import("@clerk/backend")
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
      const clerkOrg = await clerk.organizations.createOrganization({
        name: org_name,
        createdBy: userId,
      })
      clerkOrgId = clerkOrg.id
    } catch (err) {
      console.warn("Clerk org creation failed (non-critical):", err)
    }

    // Cria organização no banco
    const org = await prisma.organization.create({
      data: {
        name: org_name,
        ...(cnpj ? { cnpj } : {}),
        ...(clerkOrgId ? { clerkOrgId } : {}),
      },
    })

    // Cria/atualiza perfil
    const profile = await prisma.profile.upsert({
      where: { clerkUserId: userId },
      update: { organizationId: org.id, role: "admin", onboardingCompleted: true, updatedAt: new Date() },
      create: {
        clerkUserId: userId,
        name: user_name,
        email,
        organizationId: org.id,
        role: "admin",
        onboardingCompleted: true,
      },
      include: { organization: true },
    })

    // Seed lead sources padrão
    await prisma.leadSource.createMany({
      data: [
        { name: "Meta Ads", sortOrder: 10, organizationId: org.id },
        { name: "Indicação", sortOrder: 20, organizationId: org.id },
        { name: "Site", sortOrder: 30, organizationId: org.id },
        { name: "Instagram Orgânico", sortOrder: 40, organizationId: org.id },
        { name: "WhatsApp", sortOrder: 50, organizationId: org.id },
      ],
      skipDuplicates: true,
    })

    // Seed pipeline padrão
    const pipeline = await prisma.pipeline.create({
      data: { name: "Pipeline Principal", organizationId: org.id, isDefault: true },
    })
    await prisma.pipelineStage.createMany({
      data: [
        { name: "Novo", position: 1, pipelineId: pipeline.id },
        { name: "Contato feito", position: 2, pipelineId: pipeline.id },
        { name: "Negociando", position: 3, pipelineId: pipeline.id },
        { name: "Fechado", position: 4, pipelineId: pipeline.id },
        { name: "Perdido", position: 5, pipelineId: pipeline.id },
      ],
    })

    return reply.code(201).send({ org, profile, clerk_org_id: clerkOrgId ?? null })
  })

  // PATCH /organizations/:id — atualiza org (substitui update-clerk-org)
  fastify.patch<{
    Params: { id: string }
    Body: {
      name?: string
      cnpj?: string
      phone?: string
      email?: string
      address?: string
      city?: string
      state?: string
      zip_code?: string
    }
  }>("/organizations/:id", async (req, reply) => {
    const { zip_code, ...rest } = req.body
    const updated = await prisma.organization.updateMany({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(zip_code && { zipCode: zip_code }),
        updatedAt: new Date(),
      },
    })
    if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // PATCH /organizations/:id/settings — atualiza configurações sensíveis (substitui update-sensitive-settings)
  fastify.patch<{
    Params: { id: string }
    Body: {
      ai_system_prompt?: string
      ai_auto_reply_throttle_seconds?: number
      ai_auto_max_without_reply?: number
      ai_auto_debounce_seconds?: number
    }
  }>("/organizations/:id/settings", async (req, reply) => {
    const updated = await prisma.organization.updateMany({
      where: { id: req.params.id },
      data: {
        ...(req.body.ai_system_prompt !== undefined && { aiSystemPrompt: req.body.ai_system_prompt }),
        ...(req.body.ai_auto_reply_throttle_seconds !== undefined && {
          aiAutoReplyThrottleSeconds: req.body.ai_auto_reply_throttle_seconds,
        }),
        ...(req.body.ai_auto_max_without_reply !== undefined && {
          aiAutoMaxWithoutReply: req.body.ai_auto_max_without_reply,
        }),
        ...(req.body.ai_auto_debounce_seconds !== undefined && {
          aiAutoDebounceSeconds: req.body.ai_auto_debounce_seconds,
        }),
        updatedAt: new Date(),
      },
    })
    if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // POST /organizations/:id/logo — upload de logo (substitui upload-org-logo)
  fastify.post<{ Params: { id: string } }>("/organizations/:id/logo", async (req, reply) => {
    const org = await prisma.organization.findFirst({
      where: { id: req.params.id },
    })
    if (!org) return reply.code(404).send({ error: "Not found" })

    const data = await req.file()
    if (!data) return reply.code(400).send({ error: "No file provided" })

    const buffer = await data.toBuffer()
    const ext = data.filename.split(".").pop() || "jpg"
    const key = `org-logos/${req.params.id}.${ext}`

    // Delete old logo if exists
    if (org.logoUrl) {
      const oldKey = org.logoUrl.split(`/${process.env.MINIO_BUCKET || "auto-lead"}/`)[1]
      if (oldKey) await deleteFile(oldKey).catch(() => null)
    }

    const url = await uploadFile(key, buffer, data.mimetype)

    await prisma.organization.update({
      where: { id: req.params.id },
      data: { logoUrl: url, updatedAt: new Date() },
    })

    return { logo_url: url }
  })
}
