import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"
import { emit } from "../plugins/socket.js"
import { fireAutomationTrigger, runInactiveLeadCheck } from "../lib/automationRunner.js"

const INITIAL_NODES = [
  {
    id: "trigger_initial",
    type: "trigger",
    position: { x: 250, y: 50 },
    data: { label: "Gatilho", config: { triggerType: "lead_created" } },
  },
]

const FOLLOWUP_TEMPLATE_NODES = [
  {
    id: "tpl_trigger",
    type: "trigger",
    position: { x: 250, y: 30 },
    data: { label: "Lead criado", config: { triggerType: "lead_created" } },
  },
  {
    id: "tpl_msg1",
    type: "message",
    position: { x: 250, y: 160 },
    data: { label: "Mensagem inicial", config: { text: "Olá {{lead.name}}, tudo bem? Posso te ajudar?" } },
  },
  {
    id: "tpl_wait",
    type: "wait_for_reply",
    position: { x: 250, y: 310 },
    data: { label: "Aguardar resposta", config: { timeout_amount: 24, timeout_unit: "hours" } },
  },
  {
    id: "tpl_action_stage",
    type: "action",
    position: { x: 80, y: 490 },
    data: { label: "Mover etapa", config: { actionType: "move_stage", params: { stage: "Em atendimento" } } },
  },
  {
    id: "tpl_msg_timeout",
    type: "message",
    position: { x: 420, y: 490 },
    data: { label: "Lembrete", config: { text: "Oi {{lead.name}}, passando para confirmar se ainda precisa de ajuda." } },
  },
]

const FOLLOWUP_TEMPLATE_EDGES = [
  { id: "e_trig_msg1", source: "tpl_trigger", target: "tpl_msg1", sourceHandle: "default" },
  { id: "e_msg1_wait", source: "tpl_msg1", target: "tpl_wait", sourceHandle: "default" },
  { id: "e_wait_replied", source: "tpl_wait", target: "tpl_action_stage", sourceHandle: "replied" },
  { id: "e_wait_timeout", source: "tpl_wait", target: "tpl_msg_timeout", sourceHandle: "timeout" },
]

export default async function automationsRoutes(fastify: FastifyInstance) {
  // ── Automations CRUD ──────────────────────────────────────────────────────

  fastify.get<{ Querystring: { limit?: string; offset?: string } }>(
    "/automations",
    async (req) => {
      return prisma.automation.findMany({
        where: { ...orgScope(req) },
        orderBy: { createdAt: "desc" },
        take: Number(req.query.limit) || 100,
        skip: Number(req.query.offset) || 0,
      })
    }
  )

  fastify.get<{ Params: { id: string } }>("/automations/:id", async (req, reply) => {
    const automation = await prisma.automation.findFirst({
      where: { id: req.params.id, ...orgScope(req) },
    })
    if (!automation) return reply.code(404).send({ error: "Not found" })
    return automation
  })

  fastify.post<{
    Body: { name: string; description?: string; channel?: string }
  }>("/automations", async (req, reply) => {
    try {
      if (!req.body?.name?.trim()) {
        return reply.code(400).send({ error: "name is required" })
      }

      const automation = await prisma.automation.create({
        data: {
          organizationId: req.auth.orgId,
          name: req.body.name.trim(),
          description: req.body.description || null,
          channel: req.body.channel || "whatsapp",
          createdBy: req.auth.userId,
          isActive: false,
        },
      })

      await prisma.automationFlow.create({
        data: {
          organizationId: req.auth.orgId,
          automationId: automation.id,
          nodes: INITIAL_NODES as any,
          edges: [],
          entryNodeId: "trigger_initial",
          version: 1,
        },
      }).catch((e: unknown) => {
        fastify.log.warn({ err: e }, "Failed to create initial automationFlow")
      })

      return reply.code(201).send(automation)
    } catch (err) {
      fastify.log.error({ err, body: req.body, orgId: req.auth?.orgId }, "POST /automations failed")
      return reply.code(500).send({ error: "Failed to create automation", detail: String(err) })
    }
  })

  fastify.patch<{
    Params: { id: string }
    Body: {
      name?: string
      description?: string
      channel?: string
      isActive?: boolean
      triggerType?: string
      triggerEventName?: string
      allowAiTriggers?: boolean
      allowHumanTriggers?: boolean
      throttleSeconds?: number
    }
  }>("/automations/:id", async (req, reply) => {
    const { name, description, channel, isActive, triggerType, triggerEventName, allowAiTriggers, allowHumanTriggers, throttleSeconds } = req.body
    const updated = await prisma.automation.updateMany({
      where: { id: req.params.id, ...orgScope(req) },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(channel !== undefined && { channel }),
        ...(isActive !== undefined && { isActive }),
        ...(triggerType !== undefined && { triggerType }),
        ...(triggerEventName !== undefined && { triggerEventName }),
        ...(allowAiTriggers !== undefined && { allowAiTriggers }),
        ...(allowHumanTriggers !== undefined && { allowHumanTriggers }),
        ...(throttleSeconds !== undefined && { throttleSeconds }),
        updatedAt: new Date(),
      },
    })
    if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  fastify.delete<{ Params: { id: string } }>("/automations/:id", async (req, reply) => {
    const automationId = req.params.id
    const orgId = req.auth.orgId

    // Verify ownership before deleting
    const automation = await prisma.automation.findFirst({
      where: { id: automationId, ...orgScope(req) },
      select: { id: true },
    })
    if (!automation) return reply.code(404).send({ error: "Not found" })

    // Delete child records in correct FK order to avoid constraint violations
    await prisma.$transaction(async (tx) => {
      // 1. Null out WhatsappMessage references to runs (optional FK)
      await (tx as any).whatsappMessage?.updateMany?.({
        where: { organizationId: orgId, automationRunId: { not: null } },
        data: { automationRunId: null },
      }).catch(() => null)

      // 2. Delete AutomationRunStep (child of AutomationRun)
      const runs = await tx.automationRun.findMany({
        where: { automationId, organizationId: orgId },
        select: { id: true },
      })
      if (runs.length > 0) {
        const runIds = runs.map((r) => r.id)
        await tx.automationRunStep.deleteMany({ where: { runId: { in: runIds } } })
      }

      // 3. Delete AutomationRun
      await tx.automationRun.deleteMany({ where: { automationId, organizationId: orgId } })

      // 4. Delete AutomationFlow
      await tx.automationFlow.deleteMany({ where: { automationId, organizationId: orgId } })

      // 5. Delete AutomationJob
      await tx.automationJob.deleteMany({ where: { automationId, organizationId: orgId } })

      // 6. Delete AutomationLog
      await (tx as any).automationLog?.deleteMany?.({ where: { automationId, organizationId: orgId } }).catch(() => null)

      // 7. Delete AutomationFirstContact
      await (tx as any).automationFirstContact?.deleteMany?.({ where: { automationId, organizationId: orgId } }).catch(() => null)

      // 8. Finally delete the Automation itself
      await tx.automation.delete({ where: { id: automationId } })
    })

    return { success: true }
  })

  // POST /automations/:id/duplicate
  fastify.post<{ Params: { id: string } }>("/automations/:id/duplicate", async (req, reply) => {
    const original = await prisma.automation.findFirst({
      where: { id: req.params.id, ...orgScope(req) },
    })
    if (!original) return reply.code(404).send({ error: "Not found" })

    const origFlow = await (prisma as any).automationFlow?.findFirst?.({
      where: { automationId: req.params.id },
      orderBy: { version: "desc" },
    }).catch(() => null)

    const copy = await prisma.automation.create({
      data: {
        organizationId: req.auth.orgId,
        name: `${original.name} (cópia)`,
        description: original.description,
        channel: original.channel,
        createdBy: req.auth.userId,
        isActive: false,
      },
    })

    if (origFlow) {
      await (prisma as any).automationFlow?.create?.({
        data: {
          organizationId: req.auth.orgId,
          automationId: copy.id,
          nodes: origFlow.nodes,
          edges: origFlow.edges,
          entryNodeId: origFlow.entryNodeId,
          version: 1,
        },
      }).catch(() => null)
    }

    return reply.code(201).send(copy)
  })

  // ── Flows ─────────────────────────────────────────────────────────────────

  // GET latest flow for an automation
  fastify.get<{ Params: { id: string } }>("/automations/:id/flow", async (req, reply) => {
    const flow = await (prisma as any).automationFlow?.findFirst?.({
      where: { automationId: req.params.id },
      orderBy: { version: "desc" },
    }).catch(() => null)
    if (!flow) return reply.code(404).send({ error: "Flow not found" })
    return flow
  })

  // POST save flow (creates new version)
  fastify.post<{
    Params: { id: string }
    Body: { nodes: unknown[]; edges: unknown[] }
  }>("/automations/:id/flow", async (req, reply) => {
    const { nodes, edges } = req.body

    const triggers = (nodes || []).filter((n: any) => n.type === "trigger")
    if (triggers.length > 1) {
      return reply.code(400).send({ error: "Só pode haver 1 nó de gatilho por automação." })
    }

    const current = await (prisma as any).automationFlow?.findFirst?.({
      where: { automationId: req.params.id },
      orderBy: { version: "desc" },
      select: { version: true },
    }).catch(() => null)

    const nextVersion = (current?.version || 0) + 1
    const entryNodeId = triggers.length > 0 ? (triggers[0] as any).id : null

    const flow = await (prisma as any).automationFlow?.create?.({
      data: {
        organizationId: req.auth.orgId,
        automationId: req.params.id,
        nodes: nodes || [],
        edges: edges || [],
        entryNodeId,
        version: nextVersion,
      },
    }).catch((e: Error) => reply.code(500).send({ error: e.message }))

    // Sync trigger config to automation record
    if (triggers.length > 0) {
      const tc = (triggers[0] as any).data?.config || {}
      const triggerUpdates: Record<string, unknown> = {}

      if (tc.triggerType === "event") {
        triggerUpdates.triggerType = "event"
        triggerUpdates.triggerEventName = tc.triggerEventName || null
        triggerUpdates.allowAiTriggers = tc.allowAiTriggers ?? false
        triggerUpdates.allowHumanTriggers = tc.allowHumanTriggers ?? true
        triggerUpdates.throttleSeconds = tc.throttleSeconds ?? 0
      } else if (tc.triggerType === "deal_stage_changed") {
        triggerUpdates.triggerType = "deal_stage_changed"
        triggerUpdates.triggerEventName = "deal.stage_changed"
        triggerUpdates.allowAiTriggers = false
        triggerUpdates.allowHumanTriggers = true
        triggerUpdates.throttleSeconds = 0
      } else {
        triggerUpdates.triggerType = tc.triggerType || "manual"
        triggerUpdates.triggerEventName = null
        triggerUpdates.hasKeywordTrigger =
          tc.triggerType === "first_message" && tc.useKeyword === true
      }

      await prisma.automation.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data: triggerUpdates,
      })
    }

    return reply.code(201).send(flow)
  })

  // ── Runs & Logs ───────────────────────────────────────────────────────────

  fastify.get<{
    Params: { id: string }
    Querystring: { limit?: string }
  }>("/automations/:id/runs", async (req) => {
    return prisma.automationRun.findMany({
      where: { automationId: req.params.id, ...orgScope(req) },
      orderBy: { startedAt: "desc" },
      take: Number(req.query.limit) || 50,
    })
  })

  // GET /automations/stats — global stats (sem id)
  fastify.get("/automations/stats", async (req) => {
    const runs = await prisma.automationRun.findMany({
      where: { ...orgScope(req) },
      select: { status: true },
    })
    const stats = { total: 0, running: 0, completed: 0, failed: 0, waiting: 0 }
    for (const r of runs) {
      stats.total++
      if (r.status === "running") stats.running++
      else if (r.status === "completed") stats.completed++
      else if (r.status === "failed") stats.failed++
      else if (r.status === "waiting") stats.waiting++
    }
    return stats
  })

  fastify.get<{ Params: { id: string } }>("/automations/:id/stats", async (req) => {
    const runs = await prisma.automationRun.findMany({
      where: { automationId: req.params.id, ...orgScope(req) },
      select: { status: true },
    })
    const stats = { total: 0, running: 0, completed: 0, failed: 0, waiting: 0 }
    for (const r of runs) {
      stats.total++
      if (r.status === "running") stats.running++
      else if (r.status === "completed") stats.completed++
      else if (r.status === "failed") stats.failed++
      else if (r.status === "waiting") stats.waiting++
    }
    return stats
  })

  // ── Templates ─────────────────────────────────────────────────────────────

  fastify.post<{ Body: { template: string; pipeline_id?: string; stage_id?: string } }>(
    "/automations/templates",
    async (req, reply) => {
      const { template, pipeline_id, stage_id } = req.body

      let name: string
      let description: string
      let nodes: unknown[]
      let edges: unknown[]

      if (template === "keyword_lead") {
        name = "Primeira mensagem contém 'anuncio' → criar lead"
        description = "Template: captura leads via WhatsApp com keyword"
        nodes = [
          {
            id: "kw_trigger",
            type: "trigger",
            position: { x: 250, y: 30 },
            data: {
              label: "Mensagem recebida (WhatsApp)",
              config: { triggerType: "inbound_message_keyword", keyword: "anuncio", firstMessageOnly: true },
            },
          },
          {
            id: "kw_action",
            type: "action",
            position: { x: 250, y: 200 },
            data: {
              label: "Criar Lead (Meta Ads)",
              config: {
                actionType: "create_lead",
                params: {
                  source: "Meta Ads",
                  source_detail: "WhatsApp keyword: anuncio",
                  pipeline_id: pipeline_id || null,
                  stage_id: stage_id || null,
                },
              },
            },
          },
        ]
        edges = [{ id: "e1", source: "kw_trigger", target: "kw_action", sourceHandle: "default" }]
      } else {
        // Default: follow-up 24h
        name = req.body.template || "Follow-up - resposta em 24h"
        description = "Template: envia mensagem, aguarda 24h e move etapa ou envia lembrete."
        nodes = FOLLOWUP_TEMPLATE_NODES
        edges = FOLLOWUP_TEMPLATE_EDGES
      }

      const automation = await prisma.automation.create({
        data: {
          organizationId: req.auth.orgId,
          name,
          description,
          channel: "whatsapp",
          createdBy: req.auth.userId,
          isActive: false,
        },
      })

      await (prisma as any).automationFlow?.create?.({
        data: {
          organizationId: req.auth.orgId,
          automationId: automation.id,
          nodes,
          edges,
          entryNodeId: (nodes[0] as any).id,
          version: 1,
        },
      }).catch(() => null)

      return reply.code(201).send(automation)
    }
  )

  // ── Trigger automation manually ───────────────────────────────────────────

  fastify.post<{ Params: { id: string }; Body: { lead_id: string } }>(
    "/automations/:id/trigger",
    async (req, reply) => {
      const automation = await prisma.automation.findFirst({
        where: { id: req.params.id, ...orgScope(req) },
      })
      if (!automation) return reply.code(404).send({ error: "Not found" })

      emit(req.auth.orgId, "automation:trigger", {
        automationId: req.params.id,
        leadId: req.body.lead_id,
        triggeredBy: req.auth.userId,
      })

      return { queued: true, automationId: req.params.id }
    }
  )

  // ── Public webhook endpoint ───────────────────────────────────────────────
  // POST /automations/webhook/:automationId — dispara gatilho webhook_received

  fastify.post<{ Params: { automationId: string }; Body: Record<string, unknown> }>(
    "/automations/webhook/:automationId",
    async (req, reply) => {
      const automation = await prisma.automation.findUnique({
        where: { id: req.params.automationId },
        select: { id: true, organizationId: true, isActive: true },
      }).catch(() => null)

      if (!automation?.isActive) {
        return reply.code(404).send({ error: "Not found or inactive" })
      }

      setImmediate(() =>
        fireAutomationTrigger(automation.organizationId, "webhook_received", null, {
          webhook_payload: req.body,
          automation_id: automation.id,
        }).catch((e) => console.error("[automations] webhook trigger error:", e))
      )

      return { received: true }
    }
  )

  // ── Cron: check inactive leads ────────────────────────────────────────────
  // POST /automations/cron/inactive-check — chamado por cron externo a cada hora

  fastify.post("/automations/cron/inactive-check", async (req, reply) => {
    const secret = req.headers["x-cron-secret"]
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return reply.code(401).send({ error: "Unauthorized" })
    }

    const orgs = await prisma.automation.findMany({
      where: { isActive: true },
      select: { organizationId: true },
      distinct: ["organizationId"],
    }).catch(() => [] as { organizationId: string }[])

    setImmediate(async () => {
      for (const { organizationId } of orgs) {
        await runInactiveLeadCheck(organizationId).catch((e) =>
          console.error("[cron] inactive check error for org", organizationId, e)
        )
      }
    })

    return { queued: true, orgs: orgs.length }
  })

}
