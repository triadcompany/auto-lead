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

      } else if (template === "welcome_business_hours") {
        name = "Boas-vindas com Horário Comercial"
        description = "Envia boas-vindas para novos contatos dentro do horário comercial; fora do horário, avisa quando retornará."
        nodes = [
          { id: "wbh_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Primeira mensagem recebida", config: { triggerType: "first_message" } } },
          { id: "wbh_bh", type: "business_hours", position: { x: 250, y: 160 }, data: { label: "Horário Comercial", config: { timezone: "America/Sao_Paulo", schedule: { mon: { enabled: true, start: "09:00", end: "18:00" }, tue: { enabled: true, start: "09:00", end: "18:00" }, wed: { enabled: true, start: "09:00", end: "18:00" }, thu: { enabled: true, start: "09:00", end: "18:00" }, fri: { enabled: true, start: "09:00", end: "18:00" }, sat: { enabled: false, start: "09:00", end: "13:00" }, sun: { enabled: false, start: "09:00", end: "12:00" } } } } },
          { id: "wbh_msg1", type: "message", position: { x: 60, y: 320 }, data: { label: "Boas-vindas", config: { messageType: "text", text: "Olá, {{lead.name}}! 👋 Seja bem-vindo(a)!\n\nComo posso te ajudar hoje?" } } },
          { id: "wbh_msg2", type: "message", position: { x: 60, y: 480 }, data: { label: "Menu de opções", config: { messageType: "text", text: "Escolha uma opção:\n\n1️⃣ Quero conhecer os produtos\n2️⃣ Já sou cliente\n3️⃣ Falar com um atendente" } } },
          { id: "wbh_off", type: "message", position: { x: 440, y: 320 }, data: { label: "Fora do horário", config: { messageType: "text", text: "Olá, {{lead.name}}! 🌙 Recebemos sua mensagem.\n\nNosso horário de atendimento é:\n*Segunda a Sexta: 9h às 18h*\n\nRetornaremos em breve! ✨" } } },
        ]
        edges = [
          { id: "e1", source: "wbh_trigger", target: "wbh_bh", sourceHandle: "default" },
          { id: "e2", source: "wbh_bh", target: "wbh_msg1", sourceHandle: "within" },
          { id: "e3", source: "wbh_msg1", target: "wbh_msg2", sourceHandle: "default" },
          { id: "e4", source: "wbh_bh", target: "wbh_off", sourceHandle: "outside" },
        ]

      } else if (template === "followup_24h") {
        name = "Follow-up 24h após contato"
        description = "Envia uma mensagem de acompanhamento 24 horas após o primeiro contato do lead."
        nodes = [
          { id: "fu_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Primeira mensagem recebida", config: { triggerType: "first_message" } } },
          { id: "fu_msg1", type: "message", position: { x: 250, y: 160 }, data: { label: "Primeiro contato", config: { messageType: "text", text: "Olá, {{lead.name}}! 👋 Vi que você entrou em contato conosco.\n\nPosso te ajudar com alguma informação?" } } },
          { id: "fu_wait", type: "wait", position: { x: 250, y: 310 }, data: { label: "Aguardar 24h", config: { duration: 24, unit: "hours" } } },
          { id: "fu_bh", type: "business_hours", position: { x: 250, y: 450 }, data: { label: "Horário Comercial", config: { timezone: "America/Sao_Paulo", schedule: { mon: { enabled: true, start: "09:00", end: "18:00" }, tue: { enabled: true, start: "09:00", end: "18:00" }, wed: { enabled: true, start: "09:00", end: "18:00" }, thu: { enabled: true, start: "09:00", end: "18:00" }, fri: { enabled: true, start: "09:00", end: "18:00" }, sat: { enabled: false, start: "09:00", end: "13:00" }, sun: { enabled: false, start: "09:00", end: "12:00" } } } } },
          { id: "fu_followup", type: "message", position: { x: 100, y: 600 }, data: { label: "Lembrete", config: { messageType: "text", text: "Oi, {{lead.name}}! 😊 Passando para ver se ficou alguma dúvida.\n\nEstamos aqui para ajudar! Pode falar à vontade." } } },
          { id: "fu_action", type: "action", position: { x: 380, y: 600 }, data: { label: "Mover etapa", config: { actionType: "move_stage", params: { stage_name: "Follow-up" } } } },
        ]
        edges = [
          { id: "e1", source: "fu_trigger", target: "fu_msg1", sourceHandle: "default" },
          { id: "e2", source: "fu_msg1", target: "fu_wait", sourceHandle: "default" },
          { id: "e3", source: "fu_wait", target: "fu_bh", sourceHandle: "default" },
          { id: "e4", source: "fu_bh", target: "fu_followup", sourceHandle: "within" },
          { id: "e5", source: "fu_bh", target: "fu_action", sourceHandle: "outside" },
        ]

      } else if (template === "notify_new_lead") {
        name = "Novo lead → Notificar equipe"
        description = "Quando um novo lead entra, atribui ao responsável e envia notificação interna pelo WhatsApp."
        nodes = [
          { id: "nnl_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Lead criado", config: { triggerType: "lead_created" } } },
          { id: "nnl_assign", type: "action", position: { x: 250, y: 160 }, data: { label: "Atribuir responsável", config: { actionType: "assign_owner", params: { strategy: "round_robin" } } } },
          { id: "nnl_notify", type: "action", position: { x: 250, y: 310 }, data: { label: "Notificação interna", config: { actionType: "internal_notification", memberId: null, role: "admin", message: "🔔 Novo lead chegou!\n\nNome: {{lead.name}}\nTelefone: {{lead.phone}}\nFonte: {{lead.source}}\n\nAcesse o CRM para atender." } } },
          { id: "nnl_msg", type: "message", position: { x: 250, y: 460 }, data: { label: "Boas-vindas ao lead", config: { messageType: "text", text: "Olá, {{lead.name}}! 👋 Obrigado por entrar em contato.\n\nUm de nossos atendentes irá te responder em breve!" } } },
        ]
        edges = [
          { id: "e1", source: "nnl_trigger", target: "nnl_assign", sourceHandle: "default" },
          { id: "e2", source: "nnl_assign", target: "nnl_notify", sourceHandle: "default" },
          { id: "e3", source: "nnl_notify", target: "nnl_msg", sourceHandle: "default" },
        ]

      } else if (template === "deal_won_capi") {
        name = "Venda Fechada → Meta CAPI + Parabéns"
        description = "Quando o lead é marcado como Ganho no Kanban, dispara evento de Purchase no Meta CAPI e envia mensagem de parabéns."
        nodes = [
          { id: "dwc_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Lead movido no Kanban", config: { triggerType: "deal_stage_changed" } } },
          { id: "dwc_capi", type: "action", position: { x: 250, y: 160 }, data: { label: "Meta CAPI – Purchase", config: { actionType: "send_meta_event", params: { event_name: "Purchase", value: 0, currency: "BRL" } } } },
          { id: "dwc_msg", type: "message", position: { x: 250, y: 310 }, data: { label: "Mensagem de parabéns", config: { messageType: "text", text: "🎉 Parabéns, {{lead.name}}!\n\nFicamos muito felizes em confirmar sua compra. Em breve entraremos em contato com os próximos passos.\n\nObrigado pela confiança! 🙏" } } },
          { id: "dwc_note", type: "action", position: { x: 250, y: 460 }, data: { label: "Criar nota", config: { actionType: "create_note", content: "Venda fechada em {{date}}. Evento de Purchase enviado ao Meta CAPI." } } },
          { id: "dwc_status", type: "action", position: { x: 250, y: 610 }, data: { label: "Marcar como Ganho", config: { actionType: "set_lead_status", status: "won" } } },
        ]
        edges = [
          { id: "e1", source: "dwc_trigger", target: "dwc_capi", sourceHandle: "default" },
          { id: "e2", source: "dwc_capi", target: "dwc_msg", sourceHandle: "default" },
          { id: "e3", source: "dwc_msg", target: "dwc_note", sourceHandle: "default" },
          { id: "e4", source: "dwc_note", target: "dwc_status", sourceHandle: "default" },
        ]

      } else if (template === "ab_test_welcome") {
        name = "A/B Test – Mensagem de boas-vindas"
        description = "Testa duas versões de mensagem de boas-vindas para ver qual converte melhor."
        nodes = [
          { id: "ab_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Primeira mensagem recebida", config: { triggerType: "first_message" } } },
          { id: "ab_split", type: "ab_split", position: { x: 250, y: 160 }, data: { label: "A/B Split", config: { split_a: 50 } } },
          { id: "ab_msg_a", type: "message", position: { x: 60, y: 320 }, data: { label: "Variante A", config: { messageType: "text", text: "Olá, {{lead.name}}! 👋 Que bom ter você aqui!\n\nSou da equipe de atendimento. Como posso te ajudar hoje?" } } },
          { id: "ab_msg_b", type: "message", position: { x: 440, y: 320 }, data: { label: "Variante B", config: { messageType: "text", text: "Oi, {{lead.name}}! 😊\n\nVi que você entrou em contato. Pode me contar um pouco mais sobre o que você precisa?" } } },
          { id: "ab_tag_a", type: "action", position: { x: 60, y: 480 }, data: { label: "Tag: variante-a", config: { actionType: "add_tag", params: { tag: "ab-variante-a" } } } },
          { id: "ab_tag_b", type: "action", position: { x: 440, y: 480 }, data: { label: "Tag: variante-b", config: { actionType: "add_tag", params: { tag: "ab-variante-b" } } } },
        ]
        edges = [
          { id: "e1", source: "ab_trigger", target: "ab_split", sourceHandle: "default" },
          { id: "e2", source: "ab_split", target: "ab_msg_a", sourceHandle: "a" },
          { id: "e3", source: "ab_split", target: "ab_msg_b", sourceHandle: "b" },
          { id: "e4", source: "ab_msg_a", target: "ab_tag_a", sourceHandle: "default" },
          { id: "e5", source: "ab_msg_b", target: "ab_tag_b", sourceHandle: "default" },
        ]

      } else if (template === "welcome_sequence") {
        name = "Sequência de boas-vindas em 3 etapas"
        description = "Envia três mensagens progressivas: boas-vindas imediata, cardápio de opções após 5 minutos e mensagem de engajamento após 1 hora."
        nodes = [
          { id: "ws_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Primeira mensagem recebida", config: { triggerType: "first_message" } } },
          { id: "ws_msg1", type: "message", position: { x: 250, y: 160 }, data: { label: "Boas-vindas imediata", config: { messageType: "text", text: "Olá, {{lead.name}}! 👋 Obrigado por entrar em contato!\n\nEstou aqui e já te respondo em instantes. 😊" } } },
          { id: "ws_wait1", type: "wait", position: { x: 250, y: 310 }, data: { label: "Aguardar 5 min", config: { duration: 5, unit: "minutes" } } },
          { id: "ws_msg2", type: "message", position: { x: 250, y: 450 }, data: { label: "Menu de opções", config: { messageType: "text", text: "Para te atender melhor, me conta:\n\n1️⃣ Quero conhecer os produtos\n2️⃣ Tenho uma dúvida específica\n3️⃣ Quero falar com um consultor\n4️⃣ Já sou cliente" } } },
          { id: "ws_wait2", type: "wait", position: { x: 250, y: 600 }, data: { label: "Aguardar 1 hora", config: { duration: 1, unit: "hours" } } },
          { id: "ws_msg3", type: "message", position: { x: 250, y: 740 }, data: { label: "Engajamento", config: { messageType: "text", text: "{{lead.name}}, vi que você ainda não escolheu uma opção. 😊\n\nPosso te ajudar com alguma dúvida específica?" } } },
        ]
        edges = [
          { id: "e1", source: "ws_trigger", target: "ws_msg1", sourceHandle: "default" },
          { id: "e2", source: "ws_msg1", target: "ws_wait1", sourceHandle: "default" },
          { id: "e3", source: "ws_wait1", target: "ws_msg2", sourceHandle: "default" },
          { id: "e4", source: "ws_msg2", target: "ws_wait2", sourceHandle: "default" },
          { id: "e5", source: "ws_wait2", target: "ws_msg3", sourceHandle: "default" },
        ]

      } else if (template === "reactivate_cold") {
        name = "Reativar lead frio"
        description = "Sequência de reativação para leads que pararam de responder: duas tentativas espaçadas por 3 dias, depois marca como perdido."
        nodes = [
          { id: "rc_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Tag adicionada", config: { triggerType: "tag_added", tag: "lead-frio" } } },
          { id: "rc_bh", type: "business_hours", position: { x: 250, y: 160 }, data: { label: "Horário Comercial", config: { timezone: "America/Sao_Paulo", schedule: { mon: { enabled: true, start: "09:00", end: "18:00" }, tue: { enabled: true, start: "09:00", end: "18:00" }, wed: { enabled: true, start: "09:00", end: "18:00" }, thu: { enabled: true, start: "09:00", end: "18:00" }, fri: { enabled: true, start: "09:00", end: "18:00" }, sat: { enabled: false, start: "09:00", end: "13:00" }, sun: { enabled: false, start: "09:00", end: "12:00" } } } } },
          { id: "rc_msg1", type: "message", position: { x: 60, y: 320 }, data: { label: "Primeira tentativa", config: { messageType: "text", text: "Oi, {{lead.name}}! 👋 Tudo bem?\n\nFaz um tempo que não falamos e queria saber se ainda posso te ajudar com algo. Aproveita que temos condições especiais esta semana! 🎁" } } },
          { id: "rc_wait1", type: "wait", position: { x: 60, y: 480 }, data: { label: "Aguardar 3 dias", config: { duration: 3, unit: "days" } } },
          { id: "rc_msg2", type: "message", position: { x: 60, y: 620 }, data: { label: "Última tentativa", config: { messageType: "text", text: "{{lead.name}}, esta é minha última mensagem para não ser inconveniente. 🙏\n\nSe mudar de ideia, estarei aqui! Qualquer coisa é só chamar." } } },
          { id: "rc_wait2", type: "wait", position: { x: 60, y: 760 }, data: { label: "Aguardar 1 dia", config: { duration: 1, unit: "days" } } },
          { id: "rc_lost", type: "action", position: { x: 60, y: 900 }, data: { label: "Marcar como Perdido", config: { actionType: "set_lead_status", status: "lost" } } },
          { id: "rc_end", type: "action", position: { x: 440, y: 320 }, data: { label: "Encerrar (fora do horário)", config: { actionType: "end_automation" } } },
        ]
        edges = [
          { id: "e1", source: "rc_trigger", target: "rc_bh", sourceHandle: "default" },
          { id: "e2", source: "rc_bh", target: "rc_msg1", sourceHandle: "within" },
          { id: "e3", source: "rc_bh", target: "rc_end", sourceHandle: "outside" },
          { id: "e4", source: "rc_msg1", target: "rc_wait1", sourceHandle: "default" },
          { id: "e5", source: "rc_wait1", target: "rc_msg2", sourceHandle: "default" },
          { id: "e6", source: "rc_msg2", target: "rc_wait2", sourceHandle: "default" },
          { id: "e7", source: "rc_wait2", target: "rc_lost", sourceHandle: "default" },
        ]

      } else if (template === "meeting_reminder") {
        name = "Confirmação + lembrete de reunião"
        description = "Quando a tag 'reuniao-agendada' é adicionada, confirma o agendamento e envia lembrete automático na véspera."
        nodes = [
          { id: "mr_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Tag adicionada", config: { triggerType: "tag_added", tag: "reuniao-agendada" } } },
          { id: "mr_confirm", type: "message", position: { x: 250, y: 160 }, data: { label: "Confirmação", config: { messageType: "text", text: "✅ Olá, {{lead.name}}! Sua reunião está confirmada!\n\nAssim que se aproximar a data vou te mandar um lembrete. 📅\n\nQualquer dúvida, é só chamar!" } } },
          { id: "mr_wait", type: "wait", position: { x: 250, y: 310 }, data: { label: "Aguardar 23 horas", config: { duration: 23, unit: "hours" } } },
          { id: "mr_reminder", type: "message", position: { x: 250, y: 450 }, data: { label: "Lembrete véspera", config: { messageType: "text", text: "⏰ Olá, {{lead.name}}! Lembrete: temos nossa reunião agendada!\n\nEstaremos esperando por você. Até logo! 😊" } } },
          { id: "mr_note", type: "action", position: { x: 250, y: 600 }, data: { label: "Criar nota", config: { actionType: "create_note", content: "Lembrete de reunião enviado automaticamente." } } },
        ]
        edges = [
          { id: "e1", source: "mr_trigger", target: "mr_confirm", sourceHandle: "default" },
          { id: "e2", source: "mr_confirm", target: "mr_wait", sourceHandle: "default" },
          { id: "e3", source: "mr_wait", target: "mr_reminder", sourceHandle: "default" },
          { id: "e4", source: "mr_reminder", target: "mr_note", sourceHandle: "default" },
        ]

      } else if (template === "post_sale_nps") {
        name = "NPS e satisfação pós-venda"
        description = "Três dias após a venda, envia pesquisa de satisfação ao cliente e registra o feedback automaticamente no histórico."
        nodes = [
          { id: "nps_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Lead movido no Kanban", config: { triggerType: "deal_stage_changed" } } },
          { id: "nps_wait", type: "wait", position: { x: 250, y: 160 }, data: { label: "Aguardar 3 dias", config: { duration: 3, unit: "days" } } },
          { id: "nps_bh", type: "business_hours", position: { x: 250, y: 300 }, data: { label: "Horário Comercial", config: { timezone: "America/Sao_Paulo", schedule: { mon: { enabled: true, start: "09:00", end: "18:00" }, tue: { enabled: true, start: "09:00", end: "18:00" }, wed: { enabled: true, start: "09:00", end: "18:00" }, thu: { enabled: true, start: "09:00", end: "18:00" }, fri: { enabled: true, start: "09:00", end: "18:00" }, sat: { enabled: false, start: "09:00", end: "13:00" }, sun: { enabled: false, start: "09:00", end: "12:00" } } } } },
          { id: "nps_msg", type: "message", position: { x: 60, y: 460 }, data: { label: "Pesquisa de satisfação", config: { messageType: "text", text: "Olá, {{lead.name}}! 😊 Passando para saber como foi sua experiência conosco.\n\nNuma escala de 0 a 10, o quanto você nos recomendaria para um amigo?\n\n0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟\n\nSua opinião é muito importante! 🙏" } } },
          { id: "nps_note", type: "action", position: { x: 60, y: 620 }, data: { label: "Criar nota", config: { actionType: "create_note", content: "Pesquisa NPS enviada 3 dias após o fechamento da venda." } } },
          { id: "nps_end", type: "action", position: { x: 440, y: 460 }, data: { label: "Encerrar", config: { actionType: "end_automation" } } },
        ]
        edges = [
          { id: "e1", source: "nps_trigger", target: "nps_wait", sourceHandle: "default" },
          { id: "e2", source: "nps_wait", target: "nps_bh", sourceHandle: "default" },
          { id: "e3", source: "nps_bh", target: "nps_msg", sourceHandle: "within" },
          { id: "e4", source: "nps_bh", target: "nps_end", sourceHandle: "outside" },
          { id: "e5", source: "nps_msg", target: "nps_note", sourceHandle: "default" },
        ]

      } else if (template === "instagram_welcome") {
        name = "Lead do Instagram → Atendimento"
        description = "Quando um lead chega pelo Instagram, envia boas-vindas personalizadas para o canal, atribui responsável e notifica a equipe."
        nodes = [
          { id: "ig_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Lead via Instagram", config: { triggerType: "lead_from_instagram" } } },
          { id: "ig_msg", type: "message", position: { x: 250, y: 160 }, data: { label: "Boas-vindas Instagram", config: { messageType: "text", text: "Olá, {{lead.name}}! 📸 Que bom te ver por aqui!\n\nVi que você veio pelo Instagram. Como posso te ajudar hoje?" } } },
          { id: "ig_assign", type: "action", position: { x: 250, y: 310 }, data: { label: "Atribuir responsável", config: { actionType: "assign_owner", params: { strategy: "round_robin" } } } },
          { id: "ig_tag", type: "action", position: { x: 250, y: 460 }, data: { label: "Tag: instagram", config: { actionType: "add_tag", params: { tag: "instagram" } } } },
          { id: "ig_notify", type: "action", position: { x: 250, y: 610 }, data: { label: "Notificação interna", config: { actionType: "internal_notification", role: "admin", message: "📸 Novo lead via Instagram!\n\nNome: {{lead.name}}\nCaiu em: {{lead.stage_name}}\n\nAtenda agora!" } } },
        ]
        edges = [
          { id: "e1", source: "ig_trigger", target: "ig_msg", sourceHandle: "default" },
          { id: "e2", source: "ig_msg", target: "ig_assign", sourceHandle: "default" },
          { id: "e3", source: "ig_assign", target: "ig_tag", sourceHandle: "default" },
          { id: "e4", source: "ig_tag", target: "ig_notify", sourceHandle: "default" },
        ]

      } else if (template === "proposal_followup") {
        name = "Follow-up de proposta enviada"
        description = "Quando o lead chega na etapa de proposta, aguarda 48h e envia acompanhamento. Se não responder em 3 dias, envia mensagem de urgência."
        nodes = [
          { id: "pf_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Lead movido no Kanban", config: { triggerType: "deal_stage_changed" } } },
          { id: "pf_wait1", type: "wait", position: { x: 250, y: 160 }, data: { label: "Aguardar 48 horas", config: { duration: 48, unit: "hours" } } },
          { id: "pf_bh", type: "business_hours", position: { x: 250, y: 300 }, data: { label: "Horário Comercial", config: { timezone: "America/Sao_Paulo", schedule: { mon: { enabled: true, start: "09:00", end: "18:00" }, tue: { enabled: true, start: "09:00", end: "18:00" }, wed: { enabled: true, start: "09:00", end: "18:00" }, thu: { enabled: true, start: "09:00", end: "18:00" }, fri: { enabled: true, start: "09:00", end: "18:00" }, sat: { enabled: false, start: "09:00", end: "13:00" }, sun: { enabled: false, start: "09:00", end: "12:00" } } } } },
          { id: "pf_msg1", type: "message", position: { x: 60, y: 460 }, data: { label: "Follow-up da proposta", config: { messageType: "text", text: "Olá, {{lead.name}}! 😊 Passando para saber se você teve a chance de analisar nossa proposta.\n\nTem alguma dúvida que eu possa esclarecer?" } } },
          { id: "pf_wait2", type: "wait", position: { x: 60, y: 610 }, data: { label: "Aguardar 3 dias", config: { duration: 3, unit: "days" } } },
          { id: "pf_msg2", type: "message", position: { x: 60, y: 750 }, data: { label: "Mensagem de urgência", config: { messageType: "text", text: "{{lead.name}}, nossa proposta ainda está válida por mais alguns dias! ⏳\n\nGostaria de conversar antes que expire? Posso reservar um horário especial para você." } } },
          { id: "pf_end", type: "action", position: { x: 440, y: 460 }, data: { label: "Encerrar", config: { actionType: "end_automation" } } },
        ]
        edges = [
          { id: "e1", source: "pf_trigger", target: "pf_wait1", sourceHandle: "default" },
          { id: "e2", source: "pf_wait1", target: "pf_bh", sourceHandle: "default" },
          { id: "e3", source: "pf_bh", target: "pf_msg1", sourceHandle: "within" },
          { id: "e4", source: "pf_bh", target: "pf_end", sourceHandle: "outside" },
          { id: "e5", source: "pf_msg1", target: "pf_wait2", sourceHandle: "default" },
          { id: "e6", source: "pf_wait2", target: "pf_msg2", sourceHandle: "default" },
        ]

      } else if (template === "qualification_flow") {
        name = "Qualificação automática"
        description = "Envia perguntas de qualificação logo no primeiro contato, aguarda a resposta e encaminha para o vendedor certo."
        nodes = [
          { id: "qf_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Primeira mensagem recebida", config: { triggerType: "first_message" } } },
          { id: "qf_bh", type: "business_hours", position: { x: 250, y: 160 }, data: { label: "Horário Comercial", config: { timezone: "America/Sao_Paulo", schedule: { mon: { enabled: true, start: "09:00", end: "18:00" }, tue: { enabled: true, start: "09:00", end: "18:00" }, wed: { enabled: true, start: "09:00", end: "18:00" }, thu: { enabled: true, start: "09:00", end: "18:00" }, fri: { enabled: true, start: "09:00", end: "18:00" }, sat: { enabled: false, start: "09:00", end: "13:00" }, sun: { enabled: false, start: "09:00", end: "12:00" } } } } },
          { id: "qf_qual", type: "message", position: { x: 60, y: 320 }, data: { label: "Perguntas de qualificação", config: { messageType: "text", text: "Olá, {{lead.name}}! 😊 Para te atender melhor:\n\n*Qual é o seu maior desafio hoje?*\n\n1️⃣ Preciso aumentar minhas vendas\n2️⃣ Quero automatizar processos\n3️⃣ Estou buscando reduzir custos\n4️⃣ Outro motivo\n\nResponda com o número da opção!" } } },
          { id: "qf_wait", type: "wait", position: { x: 60, y: 480 }, data: { label: "Aguardar 30 min", config: { duration: 30, unit: "minutes" } } },
          { id: "qf_assign", type: "action", position: { x: 60, y: 620 }, data: { label: "Atribuir responsável", config: { actionType: "assign_owner", params: { strategy: "round_robin" } } } },
          { id: "qf_notify", type: "action", position: { x: 60, y: 770 }, data: { label: "Notificação ao vendedor", config: { actionType: "internal_notification", role: "admin", message: "🎯 Lead qualificado pronto para atendimento!\n\nNome: {{lead.name}}\nRetornou em 30min — atenda agora!" } } },
          { id: "qf_off", type: "message", position: { x: 440, y: 320 }, data: { label: "Fora do horário", config: { messageType: "text", text: "Olá, {{lead.name}}! 🌙 Recebemos sua mensagem!\n\nNosso horário é segunda a sexta, das 9h às 18h. Retornamos amanhã cedo! 😊" } } },
        ]
        edges = [
          { id: "e1", source: "qf_trigger", target: "qf_bh", sourceHandle: "default" },
          { id: "e2", source: "qf_bh", target: "qf_qual", sourceHandle: "within" },
          { id: "e3", source: "qf_bh", target: "qf_off", sourceHandle: "outside" },
          { id: "e4", source: "qf_qual", target: "qf_wait", sourceHandle: "default" },
          { id: "e5", source: "qf_wait", target: "qf_assign", sourceHandle: "default" },
          { id: "e6", source: "qf_assign", target: "qf_notify", sourceHandle: "default" },
        ]

      } else if (template === "client_onboarding") {
        name = "Onboarding de novo cliente"
        description = "Após o fechamento da venda, conduz o cliente por uma jornada de onboarding com mensagens progressivas ao longo de 8 dias."
        nodes = [
          { id: "ob_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Lead movido no Kanban", config: { triggerType: "deal_stage_changed" } } },
          { id: "ob_welcome", type: "message", position: { x: 250, y: 160 }, data: { label: "Boas-vindas ao cliente", config: { messageType: "text", text: "🎉 Bem-vindo(a) à família, {{lead.name}}!\n\nEstamos muito felizes em ter você conosco. Nas próximas horas enviarei algumas informações importantes para você aproveitar ao máximo. 🚀" } } },
          { id: "ob_wait1", type: "wait", position: { x: 250, y: 310 }, data: { label: "Aguardar 1 dia", config: { duration: 1, unit: "days" } } },
          { id: "ob_tips", type: "message", position: { x: 250, y: 450 }, data: { label: "Dicas de uso", config: { messageType: "text", text: "💡 {{lead.name}}, aqui vão as primeiras dicas para você aproveitar ao máximo:\n\n✅ Dica 1: Configure seu perfil completamente\n✅ Dica 2: Explore as principais funcionalidades\n✅ Dica 3: Qualquer dúvida, estamos aqui!\n\nTem alguma pergunta?" } } },
          { id: "ob_wait2", type: "wait", position: { x: 250, y: 600 }, data: { label: "Aguardar 7 dias", config: { duration: 7, unit: "days" } } },
          { id: "ob_check", type: "message", position: { x: 250, y: 740 }, data: { label: "Check-in de satisfação", config: { messageType: "text", text: "{{lead.name}}, já faz uma semana que você está conosco! 🥳\n\nComo está sendo sua experiência até agora? O que podemos melhorar?\n\nSua opinião faz toda a diferença! 💙" } } },
          { id: "ob_note", type: "action", position: { x: 250, y: 890 }, data: { label: "Criar nota", config: { actionType: "create_note", content: "Onboarding concluído: boas-vindas + dicas (dia 1) + check-in (dia 8)." } } },
        ]
        edges = [
          { id: "e1", source: "ob_trigger", target: "ob_welcome", sourceHandle: "default" },
          { id: "e2", source: "ob_welcome", target: "ob_wait1", sourceHandle: "default" },
          { id: "e3", source: "ob_wait1", target: "ob_tips", sourceHandle: "default" },
          { id: "e4", source: "ob_tips", target: "ob_wait2", sourceHandle: "default" },
          { id: "e5", source: "ob_wait2", target: "ob_check", sourceHandle: "default" },
          { id: "e6", source: "ob_check", target: "ob_note", sourceHandle: "default" },
        ]

      } else if (template === "campaign_response") {
        name = "Resposta a campanha → Atendente"
        description = "Quando um lead responde a uma campanha de disparo, verifica o horário, manda mensagem de oferta e transfere para atendimento humano."
        nodes = [
          { id: "cr_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Resposta a Campanha", config: { triggerType: "broadcast_response" } } },
          { id: "cr_bh", type: "business_hours", position: { x: 250, y: 160 }, data: { label: "Horário Comercial", config: { timezone: "America/Sao_Paulo", schedule: { mon: { enabled: true, start: "09:00", end: "18:00" }, tue: { enabled: true, start: "09:00", end: "18:00" }, wed: { enabled: true, start: "09:00", end: "18:00" }, thu: { enabled: true, start: "09:00", end: "18:00" }, fri: { enabled: true, start: "09:00", end: "18:00" }, sat: { enabled: false, start: "09:00", end: "13:00" }, sun: { enabled: false, start: "09:00", end: "12:00" } } } } },
          { id: "cr_offer", type: "message", position: { x: 60, y: 320 }, data: { label: "Mensagem de oferta", config: { messageType: "text", text: "Que ótimo que você respondeu, {{lead.name}}! 🎉\n\nTemos uma condição especial preparada para você. Vou te conectar agora com um de nossos consultores!" } } },
          { id: "cr_transfer", type: "action", position: { x: 60, y: 480 }, data: { label: "Transferir para atendente", config: { actionType: "transfer_to_agent", transitionMessage: "Um consultor vai te atender agora! 😊" } } },
          { id: "cr_off", type: "message", position: { x: 440, y: 320 }, data: { label: "Fora do horário", config: { messageType: "text", text: "Recebemos sua resposta, {{lead.name}}! 😊\n\nNosso atendimento é das 9h às 18h, seg a sex. Entraremos em contato assim que abrirmos! ⏰" } } },
        ]
        edges = [
          { id: "e1", source: "cr_trigger", target: "cr_bh", sourceHandle: "default" },
          { id: "e2", source: "cr_bh", target: "cr_offer", sourceHandle: "within" },
          { id: "e3", source: "cr_bh", target: "cr_off", sourceHandle: "outside" },
          { id: "e4", source: "cr_offer", target: "cr_transfer", sourceHandle: "default" },
        ]

      } else if (template === "urgency_vs_value") {
        name = "A/B Test – Urgência vs. Valor"
        description = "Testa duas estratégias de persuasão: mensagem com senso de urgência (prazo/escassez) versus mensagem focada no valor entregue."
        nodes = [
          { id: "uv_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Lead criado", config: { triggerType: "lead_created" } } },
          { id: "uv_split", type: "ab_split", position: { x: 250, y: 160 }, data: { label: "A/B Split 50/50", config: { split_a: 50 } } },
          { id: "uv_msg_a", type: "message", position: { x: 60, y: 320 }, data: { label: "Variante A – Urgência", config: { messageType: "text", text: "{{lead.name}}, temos uma oferta *exclusiva* que vence em 48 horas! ⏳\n\nSão poucas vagas disponíveis. Quer garantir a sua agora?" } } },
          { id: "uv_msg_b", type: "message", position: { x: 440, y: 320 }, data: { label: "Variante B – Valor", config: { messageType: "text", text: "Olá, {{lead.name}}! 👋 Imagina ter [resultado principal] sem precisar [principal dor].\n\nÉ exatamente isso que ajudamos nossos clientes a conquistar. Posso te mostrar como?" } } },
          { id: "uv_tag_a", type: "action", position: { x: 60, y: 490 }, data: { label: "Tag: ab-urgencia", config: { actionType: "add_tag", params: { tag: "ab-urgencia" } } } },
          { id: "uv_tag_b", type: "action", position: { x: 440, y: 490 }, data: { label: "Tag: ab-valor", config: { actionType: "add_tag", params: { tag: "ab-valor" } } } },
          { id: "uv_wait_a", type: "wait", position: { x: 60, y: 640 }, data: { label: "Aguardar 2 dias", config: { duration: 2, unit: "days" } } },
          { id: "uv_wait_b", type: "wait", position: { x: 440, y: 640 }, data: { label: "Aguardar 2 dias", config: { duration: 2, unit: "days" } } },
          { id: "uv_follow_a", type: "action", position: { x: 60, y: 790 }, data: { label: "Atribuir responsável (A)", config: { actionType: "assign_owner", params: { strategy: "round_robin" } } } },
          { id: "uv_follow_b", type: "action", position: { x: 440, y: 790 }, data: { label: "Atribuir responsável (B)", config: { actionType: "assign_owner", params: { strategy: "round_robin" } } } },
        ]
        edges = [
          { id: "e1", source: "uv_trigger", target: "uv_split", sourceHandle: "default" },
          { id: "e2", source: "uv_split", target: "uv_msg_a", sourceHandle: "a" },
          { id: "e3", source: "uv_split", target: "uv_msg_b", sourceHandle: "b" },
          { id: "e4", source: "uv_msg_a", target: "uv_tag_a", sourceHandle: "default" },
          { id: "e5", source: "uv_msg_b", target: "uv_tag_b", sourceHandle: "default" },
          { id: "e6", source: "uv_tag_a", target: "uv_wait_a", sourceHandle: "default" },
          { id: "e7", source: "uv_tag_b", target: "uv_wait_b", sourceHandle: "default" },
          { id: "e8", source: "uv_wait_a", target: "uv_follow_a", sourceHandle: "default" },
          { id: "e9", source: "uv_wait_b", target: "uv_follow_b", sourceHandle: "default" },
        ]

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
