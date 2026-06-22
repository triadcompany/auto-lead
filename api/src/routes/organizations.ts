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

  // POST /organizations/bootstrap — cria org e perfil do owner (substitui bootstrap-org)
  fastify.post<{
    Body: {
      clerk_org_id: string
      clerk_user_id: string
      org_name: string
      user_name: string
      email: string
    }
  }>("/organizations/bootstrap", async (req, reply) => {
    const { clerk_org_id, clerk_user_id, org_name, user_name, email } = req.body

    const existing = await prisma.organization.findFirst({
      where: { clerkOrgId: clerk_org_id } as any,
    }).catch(() => null)

    if (existing) return reply.code(200).send(existing)

    const org = await prisma.organization.create({
      data: {
        name: org_name,
        ...(({ clerkOrgId: clerk_org_id }) as any),
      } as any,
    })

    await prisma.profile.upsert({
      where: { clerkUserId: clerk_user_id },
      update: { organizationId: org.id, role: "admin", updatedAt: new Date() },
      create: {
        clerkUserId: clerk_user_id,
        name: user_name,
        email,
        organizationId: org.id,
        role: "admin",
      },
    })

    return reply.code(201).send(org)
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
