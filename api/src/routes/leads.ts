import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"
import { emit } from "../plugins/socket.js"
import crypto from "node:crypto"
import { fireAutomationTrigger } from "../lib/automationRunner.js"
import { enrichLeadFromCtwa } from "../lib/metaCtwa.js"
import { logLeadActivity, computeLeadScore } from "../lib/leadActivity.js"

// Converte um Lead do Prisma (camelCase) pro formato snake_case que o
// frontend espera (interface Lead em web/src/hooks/useSupabaseLeads.ts).
// Sem isso, campos como sellerId/stageId/valorNegocio/metaCampaignName
// chegam undefined no front mesmo com dado correto no banco.
function serializeLead(l: any) {
  return {
    id: l.id,
    name: l.name,
    email: l.email,
    phone: l.phone,
    seller_id: l.sellerId,
    source: l.source,
    interest: l.interest,
    observations: l.observations,
    stage_id: l.stageId,
    pipeline_id: l.pipelineId,
    created_at: l.createdAt,
    updated_at: l.updatedAt,
    created_by: l.createdBy,
    valor_negocio: l.valorNegocio,
    servico: l.servico,
    cidade: l.cidade,
    estado: l.estado,
    status: l.status,
    tags: l.tags,
    score: l.score,
    fbc: l.fbc,
    fbp: l.fbp,
    meta_campaign_id: l.metaCampaignId,
    meta_campaign_name: l.metaCampaignName,
    meta_adset_id: l.metaAdsetId,
    meta_adset_name: l.metaAdsetName,
    meta_ad_id: l.metaAdId,
    meta_ad_name: l.metaAdName,
    ctwa_click_id: l.ctwaClickId,
    ad_source_id: l.adSourceId,
    ad_source_url: l.adSourceUrl,
    ad_media_url: l.adMediaUrl,
    ad_thumbnail_url: l.adThumbnailUrl,
    stage_name: l.stage?.name ?? l.stage_name ?? null,
    stage_color: l.stage?.color ?? l.stage_color ?? null,
    stage_position: l.stage?.position ?? l.stage_position ?? null,
    seller_name: l.seller?.name ?? l.seller_name ?? null,
  }
}

export default async function leadsRoutes(fastify: FastifyInstance) {
  // GET /leads — lista leads da org com filtros (substitui get_org_leads RPC)
  fastify.get<{
    Querystring: {
      pipeline_id?: string
      stage_id?: string
      stage_ids?: string
      seller_id?: string
      source?: string
      search?: string
      created_after?: string
      created_before?: string
      limit?: string
      offset?: string
    }
  }>("/leads", async (req, reply) => {
    try {
      const { pipeline_id, stage_id, stage_ids, seller_id, source, search, created_after, created_before, limit = "200", offset = "0" } = req.query

      const where: any = { ...orgScope(req) }
      if (pipeline_id) where.pipelineId = pipeline_id
      if (stage_ids) {
        const ids = stage_ids.split(",").map((s: string) => s.trim()).filter(Boolean)
        if (ids.length > 0) where.stageId = { in: ids }
      } else if (stage_id) {
        where.stageId = stage_id
      }
      if (seller_id === "none") {
        where.sellerId = null
      } else if (seller_id) {
        where.sellerId = seller_id
      }
      if (source) where.source = { contains: source, mode: "insensitive" }
      const createdAtFilter: any = {}
      if (created_after) createdAtFilter.gte = new Date(created_after)
      if (created_before) createdAtFilter.lte = new Date(created_before)
      if (Object.keys(createdAtFilter).length > 0) where.createdAt = createdAtFilter
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
      return leads.map(serializeLead)
    } catch (err) {
      fastify.log.error({ err, query: req.query }, "GET /leads failed")
      return reply.code(500).send({ error: "Failed to list leads", detail: String(err) })
    }
  })

  // GET /leads/:id
  fastify.get<{ Params: { id: string } }>("/leads/:id", async (req, reply) => {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, ...orgScope(req) },
      include: {
        stage: { select: { name: true, color: true, position: true } },
        seller: { select: { name: true } },
      },
    })
    if (!lead) return reply.code(404).send({ error: "Not found" })
    return serializeLead(lead)
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
    // Score inicial + timeline
    const initialScore = computeLeadScore(lead as any)
    if (initialScore > 0) {
      await prisma.lead.update({ where: { id: lead.id }, data: { score: initialScore } }).catch(() => null)
      ;(lead as any).score = initialScore
    }
    setImmediate(() =>
      logLeadActivity({
        orgId: req.auth.orgId, leadId: lead.id, type: "created",
        description: `Lead criado${lead.source ? ` via ${lead.source}` : ""}`,
        performedBy: req.auth.profileId,
      })
    )
    emit(req.auth.orgId, "lead:created", serializeLead(lead))
    setImmediate(() =>
      fireAutomationTrigger(req.auth.orgId, "lead_created", lead.id, {
        phone: lead.phone,
        nome: lead.name,
        telefone: lead.phone,
      }).catch((e) => console.error("[leads] automation trigger error:", e))
    )
    // Enriquece com dados CTWA se houver conversa WA com anúncio para este telefone
    if (lead.phone) {
      const phoneDigits = lead.phone.replace(/\D/g, "").slice(-8)
      setImmediate(async () => {
        try {
          const conv = await prisma.conversation.findFirst({
            where: { organizationId: req.auth.orgId, contactPhone: { contains: phoneDigits }, ctwaAdId: { not: null } },
            select: { ctwaAdId: true, ctwaClid: true, ctwaSourceUrl: true, ctwaMediaUrl: true, ctwaThumbnailUrl: true },
            orderBy: { createdAt: "desc" },
          })
          if (conv?.ctwaAdId) {
            await enrichLeadFromCtwa(req.auth.orgId, lead.id, conv.ctwaAdId, {
              fbc: conv.ctwaClid,
              clickId: conv.ctwaClid,
              sourceUrl: conv.ctwaSourceUrl,
              mediaUrl: conv.ctwaMediaUrl,
              thumbnailUrl: conv.ctwaThumbnailUrl,
            })
          }
        } catch (e) {
          console.error("[leads] CTWA enrichment error:", e)
        }
      })
    }
    return reply.code(201).send(serializeLead(lead))
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
      if (b.meta_campaign_name !== undefined) data.metaCampaignName = b.meta_campaign_name
      if (b.meta_adset_name !== undefined) data.metaAdsetName = b.meta_adset_name
      if (b.meta_ad_name !== undefined) data.metaAdName = b.meta_ad_name
      if (b.meta_campaign_id !== undefined) data.metaCampaignId = b.meta_campaign_id
      if (b.meta_adset_id !== undefined) data.metaAdsetId = b.meta_adset_id
      if (b.meta_ad_id !== undefined) data.metaAdId = b.meta_ad_id

      const lead = await prisma.lead.update({
        where: { id: req.params.id },
        data,
        include: {
          stage: { select: { name: true, color: true, position: true } },
          seller: { select: { name: true } },
        },
      })
      emit(req.auth.orgId, "lead:updated", serializeLead(lead))
      const newSellerId = b.seller_id || b.sellerId
      if (newSellerId && newSellerId !== existing.sellerId) {
        setImmediate(async () => {
          fireAutomationTrigger(req.auth.orgId, "owner_assigned", lead.id, { new_seller_id: newSellerId })
            .catch((e) => console.error("[leads] automation trigger error:", e))
          const seller = await prisma.profile.findUnique({ where: { id: newSellerId }, select: { name: true } }).catch(() => null)
          logLeadActivity({
            orgId: req.auth.orgId, leadId: lead.id, type: "assigned",
            description: `Atribuído a ${seller?.name || "vendedor"}`,
            performedBy: req.auth.profileId,
          })
        })
      }
      // Recalcula score após edição
      setImmediate(async () => {
        const fresh = await prisma.lead.findUnique({ where: { id: lead.id } }).catch(() => null)
        if (!fresh) return
        const newScore = computeLeadScore(fresh as any)
        if (newScore !== fresh.score) {
          await prisma.lead.update({ where: { id: lead.id }, data: { score: newScore } }).catch(() => null)
        }
      })
      return serializeLead(lead)
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
      setImmediate(async () => {
        const toStage = await prisma.pipelineStage.findUnique({
          where: { id: req.body.stage_id }, select: { name: true },
        }).catch(() => null)
        logLeadActivity({
          orgId: req.auth.orgId, leadId: lead.id, type: "stage_changed",
          description: `Movido para "${toStage?.name || "outro estágio"}"`,
          metadata: { from: existing.stageId, to: req.body.stage_id },
          performedBy: req.auth.profileId,
        })
      })
      const stageCtx = {
        from_stage_id: existing.stageId || "",
        to_stage_id: req.body.stage_id,
        pipeline_id: req.body.pipeline_id || existing.pipelineId || "",
      }
      setImmediate(() => {
        fireAutomationTrigger(req.auth.orgId, "deal_stage_changed", lead.id, stageCtx)
          .catch((e) => console.error("[leads] automation trigger error:", e))
        fireAutomationTrigger(req.auth.orgId, "lead_stage_changed", lead.id, stageCtx)
          .catch((e) => console.error("[leads] automation trigger error:", e))
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
      const statusStr = req.body.status
      setImmediate(() =>
        logLeadActivity({
          orgId: req.auth.orgId, leadId: req.params.id, type: "status_changed",
          description: statusStr === "won" ? "Marcado como GANHO" : statusStr === "lost" ? "Marcado como PERDIDO" : `Status: ${statusStr}`,
          performedBy: req.auth.profileId,
        })
      )
      if (statusStr === "won" || statusStr === "lost") {
        setImmediate(() =>
          fireAutomationTrigger(
            req.auth.orgId,
            statusStr === "won" ? "lead_won" : "lead_lost",
            req.params.id,
            { status: statusStr }
          ).catch((e) => console.error("[leads] automation trigger error:", e))
        )
      }
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

  // PATCH /leads/:id/tags — adiciona ou remove tag
  fastify.patch<{ Params: { id: string }; Body: { action: "add" | "remove"; tag: string } }>(
    "/leads/:id/tags",
    async (req, reply) => {
      const { action, tag } = req.body
      if (!tag?.trim()) return reply.code(400).send({ error: "tag required" })

      const existing = await prisma.lead.findFirst({
        where: { id: req.params.id, ...orgScope(req) },
        select: { id: true, tags: true },
      })
      if (!existing) return reply.code(404).send({ error: "Not found" })

      const currentTags: string[] = (existing.tags as string[]) || []
      let newTags: string[]

      if (action === "add") {
        if (currentTags.includes(tag)) return { success: true, tags: currentTags }
        newTags = [...currentTags, tag]
      } else {
        newTags = currentTags.filter((t) => t !== tag)
      }

      await prisma.lead.update({
        where: { id: req.params.id },
        data: { tags: newTags, updatedAt: new Date() },
      })

      emit(req.auth.orgId, "lead:updated", { id: req.params.id, tags: newTags })

      if (action === "add") {
        setImmediate(() =>
          fireAutomationTrigger(req.auth.orgId, "tag_added", req.params.id, { tag })
            .catch((e) => console.error("[leads] automation trigger error:", e))
        )
      }

      return { success: true, tags: newTags }
    }
  )

  // POST /leads/webhook — rota pública para webhooks externos (N8N, etc.)
  fastify.post<{ Body: Record<string, unknown> }>("/leads/webhook", async (req, reply) => {
    const signature = req.headers["x-n8n-signature"] as string | undefined
    const secret = process.env.N8N_INGEST_SECRET

    // Secret é obrigatório: sem ele, a rota pública não aceita nada (evita injeção de leads).
    if (!secret) {
      fastify.log.error("N8N_INGEST_SECRET não configurado — rota /leads/webhook desabilitada")
      return reply.code(503).send({ error: "Webhook não configurado" })
    }
    if (!signature) {
      return reply.code(401).send({ error: "Missing signature" })
    }
    const expected = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(req.body))
      .digest("hex")
    // Comparação em tempo constante para evitar timing attacks
    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(`sha256=${expected}`)
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return reply.code(401).send({ error: "Invalid signature" })
    }

    const b = req.body as any
    const organization_id = b.organization_id
    if (!organization_id) return reply.code(400).send({ error: "organization_id required" })
    if (!b.name || !b.phone) return reply.code(400).send({ error: "name e phone são obrigatórios" })

    // Whitelist de campos aceitos — evita injeção de colunas arbitrárias
    const lead = await prisma.lead.create({
      data: {
        organizationId: organization_id,
        name: String(b.name),
        phone: String(b.phone),
        email: b.email ? String(b.email) : undefined,
        source: b.source ? String(b.source) : undefined,
        leadSource: b.lead_source ? String(b.lead_source) : undefined,
        interest: b.interest ? String(b.interest) : undefined,
        observations: b.observations ? String(b.observations) : undefined,
        stageId: b.stage_id || undefined,
        pipelineId: b.pipeline_id || undefined,
        servico: b.servico ? String(b.servico) : undefined,
        cidade: b.cidade ? String(b.cidade) : undefined,
        estado: b.estado ? String(b.estado) : undefined,
        valorNegocio: typeof b.valor_negocio === "number" ? b.valor_negocio : undefined,
      },
    })
    emit(organization_id, "lead:created", lead)
    setImmediate(() =>
      fireAutomationTrigger(organization_id, "lead_created", lead.id, {
        phone: lead.phone,
        nome: lead.name,
        telefone: lead.phone,
      }).catch((e) => console.error("[leads] webhook automation trigger error:", e))
    )
    return reply.code(201).send(lead)
  })

  // GET /leads/:id/timeline — histórico de atividades do lead
  fastify.get<{ Params: { id: string } }>("/leads/:id/timeline", async (req, reply) => {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, ...orgScope(req) }, select: { id: true },
    })
    if (!lead) return reply.code(404).send({ error: "Not found" })
    return (prisma as any).leadActivity.findMany({
      where: { leadId: req.params.id, organizationId: req.auth.orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  })

  // GET /leads/duplicates — grupos de leads duplicados (mesmo telefone ou email)
  fastify.get("/leads/duplicates", async (req) => {
    const leads = await prisma.lead.findMany({
      where: { ...orgScope(req) },
      select: { id: true, name: true, phone: true, email: true, createdAt: true, sellerId: true, stageId: true },
      orderBy: { createdAt: "asc" },
    })
    const byKey = new Map<string, typeof leads>()
    for (const l of leads) {
      const phoneKey = l.phone ? "p:" + l.phone.replace(/\D/g, "").slice(-10) : null
      const emailKey = l.email ? "e:" + l.email.toLowerCase().trim() : null
      for (const key of [phoneKey, emailKey]) {
        if (!key) continue
        if (!byKey.has(key)) byKey.set(key, [] as any)
        byKey.get(key)!.push(l)
      }
    }
    const groups: { key: string; leads: typeof leads }[] = []
    const seen = new Set<string>()
    for (const [key, group] of byKey) {
      if (group.length < 2) continue
      const sig = group.map(g => g.id).sort().join(",")
      if (seen.has(sig)) continue
      seen.add(sig)
      groups.push({ key, leads: group })
    }
    return { groups, count: groups.length }
  })

  // POST /leads/:id/merge — funde leads duplicados no lead :id (mantém o principal)
  fastify.post<{ Params: { id: string }; Body: { duplicate_ids: string[] } }>(
    "/leads/:id/merge",
    async (req, reply) => {
      const primary = await prisma.lead.findFirst({
        where: { id: req.params.id, ...orgScope(req) },
      })
      if (!primary) return reply.code(404).send({ error: "Not found" })
      const dupIds = (req.body.duplicate_ids || []).filter(id => id !== req.params.id)
      if (dupIds.length === 0) return reply.code(400).send({ error: "duplicate_ids vazio" })

      // Garante que os duplicados são da mesma org
      const dups = await prisma.lead.findMany({
        where: { id: { in: dupIds }, ...orgScope(req) },
        select: { id: true, observations: true, tags: true, valorNegocio: true, email: true },
      })
      const validIds = dups.map(d => d.id)
      if (validIds.length === 0) return reply.code(400).send({ error: "Nenhum duplicado válido" })

      // Reponta dependências para o lead principal
      await prisma.$transaction([
        prisma.task.updateMany({ where: { leadId: { in: validIds } }, data: { leadId: req.params.id } }),
        prisma.followup.updateMany({ where: { leadId: { in: validIds } }, data: { leadId: req.params.id } }),
        prisma.conversation.updateMany({ where: { leadId: { in: validIds } }, data: { leadId: req.params.id } }),
      ]).catch((e) => { fastify.log.error({ e }, "merge repoint failed") })

      // Consolida dados (tags/observações/valor) e apaga duplicados
      const mergedTags = Array.from(new Set([...(primary.tags || []), ...dups.flatMap(d => d.tags || [])]))
      const mergedValue = primary.valorNegocio || dups.find(d => d.valorNegocio)?.valorNegocio || null
      const mergedEmail = primary.email || dups.find(d => d.email)?.email || null
      await prisma.lead.update({
        where: { id: req.params.id },
        data: { tags: mergedTags, valorNegocio: mergedValue, email: mergedEmail, updatedAt: new Date() },
      }).catch(() => null)
      await prisma.lead.deleteMany({ where: { id: { in: validIds } } }).catch(() => null)

      setImmediate(() => logLeadActivity({
        orgId: req.auth.orgId, leadId: req.params.id, type: "note",
        description: `${validIds.length} lead(s) duplicado(s) fundido(s)`,
        performedBy: req.auth.profileId,
      }))
      emit(req.auth.orgId, "lead:updated", { id: req.params.id })
      return { success: true, merged: validIds.length }
    }
  )

  // GET /leads/export.csv — exporta leads da org em CSV
  fastify.get<{ Querystring: { pipeline_id?: string; stage_id?: string } }>(
    "/leads/export.csv",
    async (req, reply) => {
      const where: any = { ...orgScope(req) }
      if (req.query.pipeline_id) where.pipelineId = req.query.pipeline_id
      if (req.query.stage_id) where.stageId = req.query.stage_id
      const leads = await prisma.lead.findMany({
        where, orderBy: { createdAt: "desc" }, take: 10000,
        include: { stage: { select: { name: true } }, seller: { select: { name: true } } },
      })
      const esc = (v: any) => {
        const s = v == null ? "" : String(v)
        return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const headers = ["Nome", "Telefone", "Email", "Origem", "Interesse", "Estágio", "Vendedor", "Valor", "Cidade", "Estado", "Criado em"]
      const rows = leads.map((l: any) => [
        l.name, l.phone, l.email, l.source, l.interest,
        l.stage?.name, l.seller?.name, l.valorNegocio, l.cidade, l.estado,
        l.createdAt?.toISOString().slice(0, 10),
      ].map(esc).join(","))
      const csv = "﻿" + [headers.join(","), ...rows].join("\n")
      reply.header("Content-Type", "text/csv; charset=utf-8")
      reply.header("Content-Disposition", `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`)
      return reply.send(csv)
    }
  )

  // POST /leads/import — importa leads em lote (JSON array vindo de CSV parseado no front)
  fastify.post<{ Body: { leads: Array<Record<string, any>>; pipeline_id?: string; stage_id?: string } }>(
    "/leads/import",
    async (req, reply) => {
      const items = req.body.leads || []
      if (!Array.isArray(items) || items.length === 0) return reply.code(400).send({ error: "leads vazio" })
      if (items.length > 5000) return reply.code(400).send({ error: "Máximo 5000 leads por importação" })

      let created = 0, skipped = 0
      for (const it of items) {
        const name = it.name || it.nome
        const phone = it.phone || it.telefone
        if (!name || !phone) { skipped++; continue }
        try {
          await prisma.lead.create({
            data: {
              organizationId: req.auth.orgId,
              name: String(name),
              phone: String(phone),
              email: it.email ? String(it.email) : undefined,
              source: it.source || it.origem || "Importação CSV",
              interest: it.interest || it.interesse || undefined,
              cidade: it.cidade || it.city || undefined,
              estado: it.estado || it.state || undefined,
              pipelineId: req.body.pipeline_id || undefined,
              stageId: req.body.stage_id || undefined,
              createdBy: req.auth.profileId,
            },
          })
          created++
        } catch { skipped++ }
      }
      return { success: true, created, skipped }
    }
  )
}
