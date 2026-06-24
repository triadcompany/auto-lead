import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"
import { emit } from "../plugins/socket.js"
import crypto from "node:crypto"

export default async function leadsRoutes(fastify: FastifyInstance) {
  // GET /leads — lista leads da org com filtros (substitui get_org_leads RPC)
  fastify.get<{
    Querystring: {
      pipeline_id?: string
      stage_id?: string
      seller_id?: string
      search?: string
      limit?: string
      offset?: string
    }
  }>("/leads", async (req) => {
    const { pipeline_id, stage_id, seller_id, search, limit = "200", offset = "0" } = req.query

    const where: any = { ...orgScope(req) }
    if (pipeline_id) where.pipelineId = pipeline_id
    if (stage_id) where.stageId = stage_id
    if (seller_id) where.sellerId = seller_id
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ]
    }

    const leads = await prisma.lead.findMany({
      where,
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { createdAt: "desc" },
      include: {
        stage: { select: { name: true, color: true, position: true } },
        seller: { select: { name: true } },
      },
    })
    return leads.map((l: any) => ({
      ...l,
      stage_name: l.stage?.name ?? null,
      stage_color: l.stage?.color ?? null,
      stage_position: l.stage?.position ?? null,
      seller_name: l.seller?.name ?? null,
      stage: undefined,
      seller: undefined,
    }))
  })

  // GET /leads/:id
  fastify.get<{ Params: { id: string } }>("/leads/:id", async (req, reply) => {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, ...orgScope(req) },
    })
    if (!lead) return reply.code(404).send({ error: "Not found" })
    return lead
  })

  // POST /leads
  fastify.post<{ Body: Record<string, unknown> }>("/leads", async (req, reply) => {
    const b = req.body as any
    const lead = await prisma.lead.create({
      data: {
        organizationId: req.auth.orgId,
        name: b.name,
        phone: b.phone,
        email: b.email || undefined,
        sellerId: b.seller_id || b.sellerId || undefined,
        source: b.source || undefined,
        leadSource: b.lead_source || b.leadSource || undefined,
        leadSourceId: b.lead_source_id || b.leadSourceId || undefined,
        interest: b.interest || undefined,
        observations: b.observations || undefined,
        stageId: b.stage_id || b.stageId || undefined,
        pipelineId: b.pipeline_id || b.pipelineId || undefined,
        servico: b.servico || undefined,
        cidade: b.cidade || undefined,
        estado: b.estado || undefined,
        valorNegocio: b.valor_negocio ?? b.valorNegocio ?? undefined,
        createdBy: req.auth.profileId || undefined,
      },
    })
    emit(req.auth.orgId, "lead:created", { ...lead, stage_name: null })
    return reply.code(201).send(lead)
  })

  // PATCH /leads/:id — atualiza lead (substitui update_lead_rpc)
  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/leads/:id",
    async (req, reply) => {
      const existing = await prisma.lead.findFirst({
        where: { id: req.params.id, ...orgScope(req) },
      })
      if (!existing) return reply.code(404).send({ error: "Not found" })

      const b = req.body as any
      const data: any = { updatedAt: new Date() }
      if (b.name !== undefined) data.name = b.name
      if (b.phone !== undefined) data.phone = b.phone
      if (b.email !== undefined) data.email = b.email
      if (b.seller_id !== undefined) data.sellerId = b.seller_id
      if (b.sellerId !== undefined) data.sellerId = b.sellerId
      if (b.source !== undefined) data.source = b.source
      if (b.interest !== undefined) data.interest = b.interest
      if (b.observations !== undefined) data.observations = b.observations
      if (b.stage_id !== undefined) data.stageId = b.stage_id
      if (b.stageId !== undefined) data.stageId = b.stageId
      if (b.pipeline_id !== undefined) data.pipelineId = b.pipeline_id
      if (b.pipelineId !== undefined) data.pipelineId = b.pipelineId
      if (b.servico !== undefined) data.servico = b.servico
      if (b.cidade !== undefined) data.cidade = b.cidade
      if (b.estado !== undefined) data.estado = b.estado
      if (b.valor_negocio !== undefined) data.valorNegocio = b.valor_negocio
      if (b.valorNegocio !== undefined) data.valorNegocio = b.valorNegocio
      if (b.status !== undefined) data.status = b.status

      const lead = await prisma.lead.update({ where: { id: req.params.id }, data })
      emit(req.auth.orgId, "lead:updated", lead)
      return lead
    }
  )

  // PATCH /leads/:id/stage — move lead para outro estágio
  fastify.patch<{ Params: { id: string }; Body: { stage_id: string; pipeline_id?: string } }>(
    "/leads/:id/stage",
    async (req, reply) => {
      const existing = await prisma.lead.findFirst({
        where: { id: req.params.id, ...orgScope(req) },
      })
      if (!existing) return reply.code(404).send({ error: "Not found" })

      const lead = await prisma.lead.update({
        where: { id: req.params.id },
        data: {
          stageId: req.body.stage_id,
          ...(req.body.pipeline_id && { pipelineId: req.body.pipeline_id }),
          updatedAt: new Date(),
        },
      })
      emit(req.auth.orgId, "lead:moved", {
        lead,
        fromStageId: existing.stageId,
        toStageId: req.body.stage_id,
      })
      return lead
    }
  )

  // PATCH /leads/:id/status (substitui change-lead-status)
  fastify.patch<{ Params: { id: string }; Body: { status: string } }>(
    "/leads/:id/status",
    async (req, reply) => {
      const updated = await prisma.lead.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data: { status: req.body.status, updatedAt: new Date() } as any,
      })
      if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
      emit(req.auth.orgId, "lead:updated", { id: req.params.id, status: req.body.status })
      return { success: true }
    }
  )

  // PATCH /leads/:id/sale-value (substitui update-sale-value)
  fastify.patch<{ Params: { id: string }; Body: { sale_value: number } }>(
    "/leads/:id/sale-value",
    async (req, reply) => {
      const updated = await prisma.lead.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data: { valorNegocio: req.body.sale_value, updatedAt: new Date() },
      })
      if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
      emit(req.auth.orgId, "lead:updated", { id: req.params.id, sale_value: req.body.sale_value })
      return { success: true }
    }
  )

  // POST /leads/:id/reset-first-touch (substitui reset-first-touch)
  fastify.post<{ Params: { id: string } }>("/leads/:id/reset-first-touch", async (req, reply) => {
    const updated = await prisma.lead.updateMany({
      where: { id: req.params.id, ...orgScope(req) },
      data: { updatedAt: new Date() } as any,
    })
    if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // DELETE /leads/:id
  fastify.delete<{ Params: { id: string } }>("/leads/:id", async (req, reply) => {
    const deleted = await prisma.lead.deleteMany({
      where: { id: req.params.id, ...orgScope(req) },
    })
    if (deleted.count === 0) return reply.code(404).send({ error: "Not found" })
    emit(req.auth.orgId, "lead:deleted", { id: req.params.id })
    return { success: true }
  })

  // POST /leads/webhook — rota pública para webhooks externos (N8N, etc.)
  fastify.post<{ Body: Record<string, unknown> }>("/leads/webhook", async (req, reply) => {
    const signature = req.headers["x-n8n-signature"] as string | undefined
    const secret = process.env.N8N_INGEST_SECRET

    if (secret && signature) {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(req.body))
        .digest("hex")
      if (signature !== `sha256=${expected}`) {
        return reply.code(401).send({ error: "Invalid signature" })
      }
    }

    const { organization_id, ...leadData } = req.body as any
    if (!organization_id) return reply.code(400).send({ error: "organization_id required" })

    const lead = await prisma.lead.create({
      data: { ...leadData, organizationId: organization_id } as any,
    })
    emit(organization_id, "lead:created", lead)
    return reply.code(201).send(lead)
  })
}
