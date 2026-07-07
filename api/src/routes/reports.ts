import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope, requireAdmin } from "../lib/auth.js"

export default async function reportsRoutes(fastify: FastifyInstance) {
  // GET /reports/forecast — valor ponderado do pipeline por estágio (valor × probabilidade)
  fastify.get<{ Querystring: { pipeline_id?: string } }>("/reports/forecast", async (req) => {
    const stageWhere: any = { pipeline: { organizationId: req.auth.orgId } }
    if (req.query.pipeline_id) stageWhere.pipelineId = req.query.pipeline_id
    const stages = await prisma.pipelineStage.findMany({
      where: stageWhere,
      orderBy: { position: "asc" },
      select: { id: true, name: true, color: true, probability: true, isWon: true, isLost: true },
    })

    const leadWhere: any = { ...orgScope(req) }
    if (req.query.pipeline_id) leadWhere.pipelineId = req.query.pipeline_id
    const leads = await prisma.lead.findMany({
      where: leadWhere,
      select: { stageId: true, valorNegocio: true },
    })

    const byStage = new Map<string, { count: number; total: number }>()
    for (const l of leads) {
      if (!l.stageId) continue
      const cur = byStage.get(l.stageId) || { count: 0, total: 0 }
      cur.count++
      cur.total += l.valorNegocio || 0
      byStage.set(l.stageId, cur)
    }

    let weightedTotal = 0, openTotal = 0, wonTotal = 0
    const stageBreakdown = stages.map((s) => {
      const agg = byStage.get(s.id) || { count: 0, total: 0 }
      const weighted = agg.total * (s.probability / 100)
      if (s.isWon) wonTotal += agg.total
      else if (!s.isLost) { weightedTotal += weighted; openTotal += agg.total }
      return {
        stage_id: s.id, stage_name: s.name, color: s.color,
        probability: s.probability, count: agg.count,
        total_value: agg.total, weighted_value: Math.round(weighted),
        is_won: s.isWon, is_lost: s.isLost,
      }
    })

    return {
      stages: stageBreakdown,
      weighted_forecast: Math.round(weightedTotal),
      open_pipeline_value: Math.round(openTotal),
      won_value: Math.round(wonTotal),
    }
  })

  // GET /reports/sla — tempo médio de primeira resposta (SLA)
  fastify.get("/reports/sla", async (req) => {
    const leads = await prisma.lead.findMany({
      where: { ...orgScope(req) },
      select: { createdAt: true, firstResponseAt: true },
    })
    const responded = leads.filter((l) => l.firstResponseAt)
    const times = responded.map((l) => new Date(l.firstResponseAt!).getTime() - new Date(l.createdAt).getTime())
    const avgMs = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0
    const within1h = times.filter((t) => t <= 3600_000).length
    const sorted = [...times].sort((a, b) => a - b)
    const medianMs = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0

    return {
      total_leads: leads.length,
      responded: responded.length,
      pending_response: leads.length - responded.length,
      avg_minutes: Math.round(avgMs / 60000),
      median_minutes: Math.round(medianMs / 60000),
      within_1h: within1h,
      within_1h_pct: responded.length ? Math.round((within1h / responded.length) * 100) : 0,
    }
  })

  // GET /reports/performance — desempenho por vendedor no período
  fastify.get<{ Querystring: { period?: string } }>("/reports/performance", async (req) => {
    const period = req.query.period || new Date().toISOString().slice(0, 7) // YYYY-MM
    const start = new Date(`${period}-01T00:00:00Z`)
    const end = new Date(start); end.setMonth(end.getMonth() + 1)

    const [sellers, wonStages] = await Promise.all([
      prisma.profile.findMany({ where: { ...orgScope(req) }, select: { id: true, name: true } }),
      prisma.pipelineStage.findMany({
        where: { pipeline: { organizationId: req.auth.orgId }, isWon: true }, select: { id: true },
      }),
    ])
    const wonStageIds = new Set(wonStages.map((s) => s.id))

    const leads = await prisma.lead.findMany({
      where: { ...orgScope(req), createdAt: { gte: start, lt: end } },
      select: { sellerId: true, stageId: true, status: true, valorNegocio: true },
    })

    const goals = await (prisma as any).salesGoal.findMany({
      where: { organizationId: req.auth.orgId, period },
    }).catch(() => [])
    const goalByProfile = new Map<string, any>(goals.map((g: any) => [g.profileId || "org", g]))

    const rows = sellers.map((s) => {
      const own = leads.filter((l) => l.sellerId === s.id)
      const won = own.filter((l) => l.status === "won" || (l.stageId && wonStageIds.has(l.stageId)))
      const wonValue = won.reduce((a, l) => a + (l.valorNegocio || 0), 0)
      const goal = goalByProfile.get(s.id)
      return {
        profile_id: s.id, name: s.name,
        leads: own.length, won: won.length, won_value: wonValue,
        conversion_pct: own.length ? Math.round((won.length / own.length) * 100) : 0,
        target_value: goal?.targetValue || 0,
        target_count: goal?.targetCount || 0,
        goal_value_pct: goal?.targetValue ? Math.round((wonValue / goal.targetValue) * 100) : null,
      }
    })
    return { period, sellers: rows }
  })

  // GET /reports/goals — metas do período
  fastify.get<{ Querystring: { period?: string } }>("/reports/goals", async (req) => {
    const period = req.query.period || new Date().toISOString().slice(0, 7)
    return (prisma as any).salesGoal.findMany({
      where: { organizationId: req.auth.orgId, period },
    }).catch(() => [])
  })

  // PUT /reports/goals — cria/atualiza meta (admin) — upsert manual por causa do profileId nulo
  fastify.put<{ Body: { profile_id?: string | null; period: string; target_value?: number; target_count?: number } }>(
    "/reports/goals",
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return
      const { profile_id = null, period, target_value = 0, target_count = 0 } = req.body
      if (!period) return reply.code(400).send({ error: "period obrigatório (YYYY-MM)" })

      const existing = await (prisma as any).salesGoal.findFirst({
        where: { organizationId: req.auth.orgId, profileId: profile_id, period },
      }).catch(() => null)

      if (existing) {
        return (prisma as any).salesGoal.update({
          where: { id: existing.id },
          data: { targetValue: target_value, targetCount: target_count, updatedAt: new Date() },
        })
      }
      return (prisma as any).salesGoal.create({
        data: {
          organizationId: req.auth.orgId, profileId: profile_id, period,
          targetValue: target_value, targetCount: target_count,
        },
      })
    }
  )
}
