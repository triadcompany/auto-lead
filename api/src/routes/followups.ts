import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"

export default async function followupsRoutes(fastify: FastifyInstance) {
  // ── Followups ────────────────────────────────────────────────────────────────

  // GET /followups
  fastify.get<{ Querystring: { lead_id?: string; status?: string; assigned_to?: string } }>(
    "/followups",
    async (req) => {
      const { lead_id, status, assigned_to } = req.query
      const items = await prisma.followup.findMany({
        where: {
          ...orgScope(req),
          ...(lead_id && { leadId: lead_id }),
          ...(status && { status }),
          ...(assigned_to && { assignedTo: assigned_to }),
        },
        include: {
          lead: { select: { id: true, name: true, phone: true, email: true, interest: true, sellerId: true, stageId: true } },
          template: true,
        },
        orderBy: { scheduledFor: "asc" },
      })
      return items.map(f => ({
        id: f.id,
        organization_id: f.organizationId,
        lead_id: f.leadId,
        assigned_to: f.assignedTo,
        scheduled_for: f.scheduledFor,
        channel: f.channel,
        status: f.status,
        template_id: f.templateId,
        message_custom: f.messageCustom,
        sent_at: f.sentAt,
        sent_by: f.sentBy,
        result_tag: f.resultTag,
        notes: f.notes,
        cadence_id: f.cadenceId,
        cadence_step: f.cadenceStep,
        created_by: f.createdBy,
        created_at: f.createdAt,
        updated_at: f.updatedAt,
        lead: f.lead ? {
          id: f.lead.id,
          name: f.lead.name,
          phone: f.lead.phone,
          email: f.lead.email,
          interest: f.lead.interest,
          seller_id: f.lead.sellerId,
          stage_id: f.lead.stageId,
        } : undefined,
        template: f.template,
      }))
    }
  )

  // POST /followups
  fastify.post<{ Body: Record<string, unknown> }>("/followups", async (req, reply) => {
    const b = req.body as any
    const followup = await prisma.followup.create({
      data: {
        organizationId: req.auth.orgId,
        leadId: b.lead_id,
        assignedTo: b.assigned_to,
        scheduledFor: new Date(b.scheduled_for),
        channel: b.channel || "whatsapp",
        status: b.status || "PENDENTE",
        templateId: b.template_id || undefined,
        messageCustom: b.message_custom || undefined,
        cadenceId: b.cadence_id || undefined,
        cadenceStep: b.cadence_step ?? undefined,
        createdBy: req.auth.profileId,
      },
    })
    return reply.code(201).send(followup)
  })

  // PATCH /followups/:id
  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/followups/:id",
    async (req, reply) => {
      const b = req.body as any
      const data: any = { updatedAt: new Date() }
      if (b.status !== undefined) data.status = b.status
      if (b.scheduled_for !== undefined) data.scheduledFor = new Date(b.scheduled_for)
      if (b.notes !== undefined) data.notes = b.notes
      if (b.result_tag !== undefined) data.resultTag = b.result_tag
      if (b.sent_at !== undefined) data.sentAt = b.sent_at ? new Date(b.sent_at) : null
      if (b.sent_by !== undefined) data.sentBy = b.sent_by
      if (b.template_id !== undefined) data.templateId = b.template_id
      if (b.message_custom !== undefined) data.messageCustom = b.message_custom
      if (b.assigned_to !== undefined) data.assignedTo = b.assigned_to

      const updated = await prisma.followup.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data,
      })
      if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
      return { success: true }
    }
  )

  // DELETE /followups/:id
  fastify.delete<{ Params: { id: string } }>("/followups/:id", async (req, reply) => {
    const deleted = await prisma.followup.deleteMany({
      where: { id: req.params.id, ...orgScope(req) },
    })
    if (deleted.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // ── Cadências ────────────────────────────────────────────────────────────────

  // GET /followup-cadences
  fastify.get("/followup-cadences", async (req) => {
    return prisma.followupCadence.findMany({
      where: { ...orgScope(req), isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    })
  })

  // POST /followup-cadences
  fastify.post<{ Body: Record<string, unknown> }>("/followup-cadences", async (req, reply) => {
    const b = req.body as any
    const cadence = await prisma.followupCadence.create({
      data: {
        organizationId: req.auth.orgId,
        name: b.name,
        description: b.description || undefined,
        steps: b.steps || [],
        isDefault: b.is_default ?? false,
        isActive: b.is_active ?? true,
        createdBy: req.auth.profileId,
      },
    })
    return reply.code(201).send(cadence)
  })

  // PATCH /followup-cadences/:id
  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/followup-cadences/:id",
    async (req, reply) => {
      const b = req.body as any
      const data: any = { updatedAt: new Date() }
      if (b.name !== undefined) data.name = b.name
      if (b.description !== undefined) data.description = b.description
      if (b.steps !== undefined) data.steps = b.steps
      if (b.is_default !== undefined) data.isDefault = b.is_default
      if (b.is_active !== undefined) data.isActive = b.is_active

      const updated = await prisma.followupCadence.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data,
      })
      if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
      return { success: true }
    }
  )

  // DELETE /followup-cadences/:id
  fastify.delete<{ Params: { id: string } }>("/followup-cadences/:id", async (req, reply) => {
    const deleted = await prisma.followupCadence.deleteMany({
      where: { id: req.params.id, ...orgScope(req) },
    })
    if (deleted.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // ── Templates ────────────────────────────────────────────────────────────────

  // GET /followup-templates
  fastify.get("/followup-templates", async (req) => {
    return prisma.followupTemplate.findMany({
      where: { ...orgScope(req), isActive: true },
      orderBy: { createdAt: "asc" },
    })
  })

  // POST /followup-templates
  fastify.post<{ Body: Record<string, unknown> }>("/followup-templates", async (req, reply) => {
    const b = req.body as any
    const template = await prisma.followupTemplate.create({
      data: {
        organizationId: req.auth.orgId,
        name: b.name,
        category: b.category || "geral",
        content: b.content,
        variables: b.variables || [],
        isActive: b.is_active ?? true,
        createdBy: req.auth.profileId,
      },
    })
    return reply.code(201).send(template)
  })

  // PATCH /followup-templates/:id
  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/followup-templates/:id",
    async (req, reply) => {
      const b = req.body as any
      const data: any = { updatedAt: new Date() }
      if (b.name !== undefined) data.name = b.name
      if (b.category !== undefined) data.category = b.category
      if (b.content !== undefined) data.content = b.content
      if (b.variables !== undefined) data.variables = b.variables
      if (b.is_active !== undefined) data.isActive = b.is_active

      const updated = await prisma.followupTemplate.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data,
      })
      if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
      return { success: true }
    }
  )

  // DELETE /followup-templates/:id
  fastify.delete<{ Params: { id: string } }>("/followup-templates/:id", async (req, reply) => {
    const deleted = await prisma.followupTemplate.deleteMany({
      where: { id: req.params.id, ...orgScope(req) },
    })
    if (deleted.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // ── Aplicar cadência a um lead ────────────────────────────────────────────────

  // POST /leads/:id/apply-cadence
  fastify.post<{ Params: { id: string }; Body: { cadence_id: string; assigned_to: string } }>(
    "/leads/:id/apply-cadence",
    async (req, reply) => {
      const { cadence_id, assigned_to } = req.body

      const cadence = await prisma.followupCadence.findFirst({
        where: { id: cadence_id, ...orgScope(req) },
      })
      if (!cadence) return reply.code(404).send({ error: "Cadência não encontrada" })

      const lead = await prisma.lead.findFirst({
        where: { id: req.params.id, ...orgScope(req) },
      })
      if (!lead) return reply.code(404).send({ error: "Lead não encontrado" })

      const steps = cadence.steps as any[]
      if (!steps?.length) return reply.code(400).send({ error: "Cadência sem passos" })

      const now = new Date()
      const followups = await prisma.$transaction(
        steps.map((step, index) => {
          const delayMs = (step.delay_hours || 0) * 60 * 60 * 1000
          return prisma.followup.create({
            data: {
              organizationId: req.auth.orgId,
              leadId: lead.id,
              assignedTo: assigned_to,
              scheduledFor: new Date(now.getTime() + delayMs),
              channel: step.channel || "whatsapp",
              status: "PENDENTE",
              templateId: step.template_id || undefined,
              messageCustom: step.message || undefined,
              cadenceId: cadence.id,
              cadenceStep: index,
              createdBy: req.auth.profileId,
            },
          })
        })
      )

      return reply.code(201).send({ created: followups.length, followups })
    }
  )
}
