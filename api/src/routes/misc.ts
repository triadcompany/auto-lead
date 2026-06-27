import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"
import { emit } from "../plugins/socket.js"

export default async function miscRoutes(fastify: FastifyInstance) {
  // GET /cnpj/:cnpj — consulta dados de empresa via BrasilAPI (substitui cnpj-lookup)
  fastify.get<{ Params: { cnpj: string } }>("/cnpj/:cnpj", async (req, reply) => {
    const clean = req.params.cnpj.replace(/\D/g, "")
    if (clean.length !== 14) return reply.code(400).send({ error: "CNPJ deve ter 14 dígitos" })

    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`)
    if (!res.ok) {
      if (res.status === 404) return reply.code(404).send({ error: "CNPJ não encontrado" })
      return reply.code(502).send({ error: "Erro ao consultar CNPJ" })
    }
    const data = (await res.json()) as any
    return {
      cnpj: clean,
      company_name: data.razao_social || "",
      trade_name: data.nome_fantasia || "",
      owner_name: data.qsa?.[0]?.nome_socio || "",
      status: data.descricao_situacao_cadastral || "",
      main_activity: data.cnae_fiscal_descricao || "",
      address: [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(", "),
      city: data.municipio || "",
      state: data.uf || "",
      raw: data,
    }
  })

  // GET /vehicles — lista veículos da org
  fastify.get<{ Querystring: { status?: string; limit?: string; offset?: string } }>(
    "/vehicles",
    async (req) => {
      return prisma.vehicle.findMany({
        where: {
          ...orgScope(req),
          ...(req.query.status && { status: req.query.status }),
        },
        orderBy: { createdAt: "desc" },
        take: Number(req.query.limit) || 100,
        skip: Number(req.query.offset) || 0,
      })
    }
  )

  // POST /vehicles
  fastify.post<{
    Body: {
      brand: string
      model: string
      year: number
      fuel_type?: string
      transmission?: string
      mileage?: number
      color?: string
      price?: number
      description?: string
      images?: string[]
    }
  }>("/vehicles", async (req, reply) => {
    const vehicle = await prisma.vehicle.create({
      data: {
        organizationId: req.auth.orgId,
        brand: req.body.brand,
        model: req.body.model,
        year: req.body.year,
        fuelType: req.body.fuel_type || null,
        transmission: req.body.transmission || null,
        mileage: req.body.mileage || null,
        color: req.body.color || null,
        price: req.body.price || null,
        description: req.body.description || null,
        images: req.body.images || [],
        createdBy: req.auth.userId,
      },
    })
    return reply.code(201).send(vehicle)
  })

  // PATCH /vehicles/:id
  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/vehicles/:id",
    async (req, reply) => {
      const { fuel_type, ...rest } = req.body as any
      const updated = await prisma.vehicle.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data: { ...rest, ...(fuel_type !== undefined && { fuelType: fuel_type }), updatedAt: new Date() },
      })
      if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
      return { success: true }
    }
  )

  // DELETE /vehicles/:id
  fastify.delete<{ Params: { id: string } }>("/vehicles/:id", async (req, reply) => {
    const deleted = await prisma.vehicle.deleteMany({
      where: { id: req.params.id, ...orgScope(req) },
    })
    if (deleted.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // GET /lead-sources — lista fontes de leads
  fastify.get("/lead-sources", async (req) => {
    return prisma.leadSource.findMany({
      where: { ...orgScope(req) },
      orderBy: { name: "asc" },
    })
  })

  // POST /lead-sources
  fastify.post<{ Body: { name: string; sort_order?: number } }>("/lead-sources", async (req, reply) => {
    const source = await prisma.leadSource.create({
      data: {
        organizationId: req.auth.orgId,
        name: req.body.name,
        ...(req.body.sort_order !== undefined && { sortOrder: req.body.sort_order }),
      },
    })
    return reply.code(201).send(source)
  })

  // PATCH /lead-sources/:id
  fastify.patch<{
    Params: { id: string }
    Body: { name?: string; is_active?: boolean; sort_order?: number }
  }>("/lead-sources/:id", async (req, reply) => {
    const { is_active, sort_order, name } = req.body
    const updated = await prisma.leadSource.updateMany({
      where: { id: req.params.id, ...orgScope(req) },
      data: {
        ...(name !== undefined && { name }),
        ...(is_active !== undefined && { isActive: is_active }),
        ...(sort_order !== undefined && { sortOrder: sort_order }),
      },
    })
    if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // DELETE /lead-sources/:id (soft delete via isActive)
  fastify.delete<{ Params: { id: string } }>("/lead-sources/:id", async (req, reply) => {
    const deleted = await prisma.leadSource.updateMany({
      where: { id: req.params.id, ...orgScope(req) },
      data: { isActive: false },
    })
    if (deleted.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // GET /prospects — lista prospects
  fastify.get<{ Querystring: { status?: string; limit?: string } }>("/prospects", async (req) => {
    return prisma.prospect.findMany({
      where: {
        ...orgScope(req),
        ...(req.query.status && { status: req.query.status }),
      },
      orderBy: { createdAt: "desc" },
      take: Number(req.query.limit) || 100,
    })
  })

  // POST /prospects
  fastify.post<{
    Body: { name: string; phone?: string; email?: string; source?: string; notes?: string }
  }>("/prospects", async (req, reply) => {
    const prospect = await prisma.prospect.create({
      data: {
        organizationId: req.auth.orgId,
        name: req.body.name,
        phone: req.body.phone || null,
        email: req.body.email || null,
        source: req.body.source || null,
        notes: req.body.notes || null,
        createdBy: req.auth.userId,
      },
    })
    return reply.code(201).send(prospect)
  })

  // PATCH /prospects/:id
  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/prospects/:id",
    async (req) => {
      const b = req.body as any
      await prisma.prospect.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data: {
          ...(b.name !== undefined && { name: b.name }),
          ...(b.phone !== undefined && { phone: b.phone }),
          ...(b.email !== undefined && { email: b.email }),
          ...(b.source !== undefined && { source: b.source }),
          ...(b.notes !== undefined && { notes: b.notes }),
          ...(b.status !== undefined && { status: b.status }),
        },
      })
      return { ok: true }
    }
  )

  // POST /automation-events — publica evento no event bus
  fastify.post<{ Body: Record<string, unknown> }>("/automation-events", async (req, reply) => {
    const b = req.body as any
    const event = await (prisma as any).automationEvent?.create?.({
      data: {
        organizationId: req.auth.orgId,
        eventName: b.event_name,
        entityType: b.entity_type || null,
        entityId: b.entity_id || null,
        conversationId: b.conversation_id || null,
        leadId: b.lead_id || null,
        opportunityId: b.opportunity_id || null,
        payload: b.payload || {},
        source: b.source || "system",
        sourceAiInteractionId: b.source_ai_interaction_id || null,
        idempotencyKey: b.idempotency_key || null,
        status: "pending",
      },
      select: { id: true },
    }).catch((e: any) => {
      if (e?.code === "P2002") return { id: null }
      throw e
    })
    return { ok: true, event_id: event?.id || null }
  })

  // GET /lead-distribution/audit — logs de auditoria de distribuição
  fastify.get<{ Querystring: { limit?: string; event?: string } }>(
    "/lead-distribution/audit",
    async (req) => {
      return (prisma as any).leadDistributionAudit?.findMany?.({
        where: {
          ...orgScope(req),
          ...(req.query.event && { event: req.query.event }),
        },
        orderBy: { createdAt: "desc" },
        take: Number(req.query.limit) || 50,
      }).catch(() => []) || []
    }
  )

  // ── Distribution Schedules ──
  fastify.get("/distribution/schedules", async (req) => {
    return prisma.distributionSchedule.findMany({ where: orgScope(req), orderBy: { priority: "asc" } })
  })

  fastify.post<{ Body: Record<string, unknown> }>("/distribution/schedules", async (req, reply) => {
    const b = req.body as any
    const schedule = await prisma.distributionSchedule.create({
      data: {
        organizationId: req.auth.orgId,
        bucket: b.bucket || "all",
        name: b.name,
        daysOfWeek: b.days_of_week || [],
        startTime: b.start_time,
        endTime: b.end_time,
        assignedUserIds: b.assigned_user_ids || [],
        isActive: b.is_active ?? true,
        priority: b.priority ?? 0,
      },
    })
    return reply.code(201).send(schedule)
  })

  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/distribution/schedules/:id",
    async (req) => {
      const b = req.body as any
      await prisma.distributionSchedule.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data: {
          ...(b.bucket !== undefined && { bucket: b.bucket }),
          ...(b.name !== undefined && { name: b.name }),
          ...(b.days_of_week !== undefined && { daysOfWeek: b.days_of_week }),
          ...(b.start_time !== undefined && { startTime: b.start_time }),
          ...(b.end_time !== undefined && { endTime: b.end_time }),
          ...(b.assigned_user_ids !== undefined && { assignedUserIds: b.assigned_user_ids }),
          ...(b.is_active !== undefined && { isActive: b.is_active }),
          ...(b.priority !== undefined && { priority: b.priority }),
          updatedAt: new Date(),
        },
      })
      return { ok: true }
    }
  )

  fastify.delete<{ Params: { id: string } }>("/distribution/schedules/:id", async (req) => {
    await prisma.distributionSchedule.deleteMany({ where: { id: req.params.id, ...orgScope(req) } })
    return { ok: true }
  })

  // ── Lead Distribution ──
  fastify.get("/lead-distribution", async (req) => {
    const settings = await prisma.leadDistributionSettings.findFirst({
      where: orgScope(req),
      include: {
        rules: { where: { isActive: true }, orderBy: { priority: "asc" } },
        users: { where: { isActive: true }, orderBy: { orderPosition: "asc" } },
      },
    })
    return settings || null
  })

  fastify.put<{ Body: Record<string, unknown> }>("/lead-distribution", async (req) => {
    const b = req.body as any
    const existing = await prisma.leadDistributionSettings.findFirst({ where: orgScope(req) })
    const data: Record<string, unknown> = {
      ...(b.is_auto_distribution_enabled !== undefined && { isAutoDistributionEnabled: b.is_auto_distribution_enabled }),
      ...(b.distribution_type !== undefined && { distributionType: b.distribution_type }),
      ...(b.mode !== undefined && { mode: b.mode }),
      ...(b.manual_receiver_id !== undefined && { manualReceiverId: b.manual_receiver_id || null }),
      updatedAt: new Date(),
    }
    if (existing) {
      return prisma.leadDistributionSettings.update({ where: { id: existing.id }, data })
    }
    return prisma.leadDistributionSettings.create({
      data: { organizationId: req.auth.orgId, ...data } as any,
    })
  })

  fastify.post<{ Body: Record<string, unknown> }>("/lead-distribution/rules", async (req, reply) => {
    const b = req.body as any
    const settings = await prisma.leadDistributionSettings.findFirst({ where: orgScope(req) })
    if (!settings) return reply.code(404).send({ error: "Distribution settings not found" })
    const rule = await prisma.leadDistributionRule.create({
      data: {
        distributionSettingId: settings.id,
        name: b.name || "Regra",
        conditions: b.conditions || {},
        actions: b.actions || {},
        priority: b.priority ?? 0,
        isActive: b.is_active ?? true,
      },
    })
    return reply.code(201).send(rule)
  })

  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/lead-distribution/rules/:id",
    async (req) => {
      const b = req.body as any
      await prisma.leadDistributionRule.updateMany({
        where: { id: req.params.id },
        data: {
          ...(b.name !== undefined && { name: b.name }),
          ...(b.conditions !== undefined && { conditions: b.conditions }),
          ...(b.actions !== undefined && { actions: b.actions }),
          ...(b.priority !== undefined && { priority: b.priority }),
          ...(b.is_active !== undefined && { isActive: b.is_active }),
          updatedAt: new Date(),
        },
      })
      return { ok: true }
    }
  )

  fastify.delete<{ Params: { id: string } }>("/lead-distribution/rules/:id", async (req) => {
    await prisma.leadDistributionRule.deleteMany({ where: { id: req.params.id } })
    return { ok: true }
  })

  fastify.post<{ Body: Record<string, unknown> }>("/lead-distribution/users", async (req, reply) => {
    const b = req.body as any
    const settings = await prisma.leadDistributionSettings.findFirst({ where: orgScope(req) })
    if (!settings) return reply.code(404).send({ error: "Distribution settings not found" })
    const user = await prisma.leadDistributionUser.create({
      data: {
        distributionSettingId: settings.id,
        userId: b.user_id,
        orderPosition: b.order_position ?? 0,
        isActive: true,
      },
    })
    return reply.code(201).send(user)
  })

  fastify.delete<{ Params: { id: string } }>("/lead-distribution/users/:id", async (req) => {
    await prisma.leadDistributionUser.deleteMany({ where: { id: req.params.id } })
    return { ok: true }
  })

  // ── N8N Workflows (stub) ──
  fastify.get("/n8n/workflows", async () => [])
  fastify.post<{ Body: Record<string, unknown> }>("/n8n/workflows", async (req, reply) => {
    return reply.code(201).send({ id: "stub", ...req.body })
  })
  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/n8n/workflows/:id",
    async (req) => ({ id: req.params.id, ...req.body })
  )

  // ── Intent Definitions ──
  fastify.get<{ Querystring: { scope_type?: string; scope_id?: string } }>(
    "/intent-definitions",
    async (req) => {
      return (prisma as any).intentDefinition?.findMany?.({
        where: {
          ...(req.query.scope_type && { scopeType: req.query.scope_type }),
          ...(req.query.scope_id && { scopeId: req.query.scope_id }),
        },
        orderBy: { intentLabel: "asc" },
      }).catch(() => []) || []
    }
  )

  // ── Public lead webhook (formulários externos, n8n, etc.) ──
  // POST /webhooks/lead?org=<organizationId>
  // Aceita fbc/fbp dos cookies do Facebook Pixel para melhor correspondência Meta CAPI
  fastify.post<{
    Querystring: { org?: string }
    Body: {
      name: string
      phone: string
      email?: string
      source?: string
      interest?: string
      observations?: string
      cidade?: string
      estado?: string
      fbc?: string
      fbp?: string
      [key: string]: unknown
    }
  }>("/webhooks/lead", async (req, reply) => {
    const orgId = req.query.org || (req.body as any).organization_id
    if (!orgId) return reply.code(400).send({ error: "org query param ou organization_id no body é obrigatório" })

    const { name, phone, email, source, interest, observations, cidade, estado, fbc, fbp } = req.body

    if (!name || !phone) return reply.code(400).send({ error: "name e phone são obrigatórios" })

    const lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        name,
        phone,
        email: email || null,
        source: source || "form",
        interest: interest || null,
        observations: observations || null,
        cidade: cidade || null,
        estado: estado || null,
        fbc: fbc || null,
        fbp: fbp || null,
      },
    })

    emit(orgId, "lead:created", lead)
    return reply.code(201).send({ ok: true, id: lead.id })
  })
}
