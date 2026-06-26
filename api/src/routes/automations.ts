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
    data: { label: "Mensagem inicial", config: { text: "Olá {{nome}}, tudo bem? Posso te ajudar?" } },
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
    data: { label: "Lembrete", config: { text: "Oi {{nome}}, passando para confirmar se ainda precisa de ajuda." } },
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


      // ── CORRECTED TEMPLATES (all use proper config paths and {{nome}} variable) ──

      } else if (template === "welcome_business_hours") {
        name = "Boas-vindas com Horário Comercial"
        description = "Envia boas-vindas para novos contatos dentro do horário comercial; fora do horário, avisa quando retornará."
        nodes = [
          { id: "wbh_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Primeira mensagem recebida", config: { triggerType: "first_message" } } },
          { id: "wbh_bh", type: "business_hours", position: { x: 250, y: 160 }, data: { label: "Horário Comercial", config: { timezone: "America/Sao_Paulo", schedule: { mon: { enabled: true, start: "09:00", end: "18:00" }, tue: { enabled: true, start: "09:00", end: "18:00" }, wed: { enabled: true, start: "09:00", end: "18:00" }, thu: { enabled: true, start: "09:00", end: "18:00" }, fri: { enabled: true, start: "09:00", end: "18:00" }, sat: { enabled: false, start: "09:00", end: "13:00" }, sun: { enabled: false, start: "09:00", end: "12:00" } } } } },
          { id: "wbh_msg1", type: "message", position: { x: 60, y: 320 }, data: { label: "Boas-vindas", config: { messageType: "text", text: "Olá, {{nome}}! 👋 Obrigado por entrar em contato!\n\nComo posso te ajudar hoje? Me conta um pouco mais sobre o que você procura. 😊" } } },
          { id: "wbh_msg2", type: "message", position: { x: 60, y: 480 }, data: { label: "Menu de opções", config: { messageType: "text", text: "Para te atender melhor, escolha uma opção:\n\n1️⃣ Quero conhecer os produtos\n2️⃣ Tenho interesse em uma proposta\n3️⃣ Já sou cliente e preciso de suporte\n4️⃣ Outra dúvida" } } },
          { id: "wbh_off", type: "message", position: { x: 440, y: 320 }, data: { label: "Fora do horário", config: { messageType: "text", text: "Olá, {{nome}}! 🌙 Recebemos sua mensagem, obrigado!\n\nNosso horário de atendimento é:\n*Segunda a Sexta: 9h às 18h*\n\nRetornaremos assim que abrirmos! Fique tranquilo(a). 😊" } } },
        ]
        edges = [
          { id: "e1", source: "wbh_trigger", target: "wbh_bh", sourceHandle: "default" },
          { id: "e2", source: "wbh_bh", target: "wbh_msg1", sourceHandle: "within" },
          { id: "e3", source: "wbh_msg1", target: "wbh_msg2", sourceHandle: "default" },
          { id: "e4", source: "wbh_bh", target: "wbh_off", sourceHandle: "outside" },
        ]

      } else if (template === "welcome_sequence") {
        name = "Sequência de boas-vindas em 3 etapas"
        description = "Envia três mensagens progressivas: boas-vindas imediata, menu após 5 minutos e mensagem de engajamento após 1 hora."
        nodes = [
          { id: "ws_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Primeira mensagem recebida", config: { triggerType: "first_message" } } },
          { id: "ws_msg1", type: "message", position: { x: 250, y: 160 }, data: { label: "Boas-vindas imediata", config: { messageType: "text", text: "Olá, {{nome}}! 👋 Que bom ter você aqui!\n\nJá estou te respondendo, pode falar! 😊" } } },
          { id: "ws_wait1", type: "wait", position: { x: 250, y: 310 }, data: { label: "Aguardar 5 min", config: { duration: 5, unit: "minutes" } } },
          { id: "ws_msg2", type: "message", position: { x: 250, y: 450 }, data: { label: "Menu de opções", config: { messageType: "text", text: "Para te ajudar da melhor forma, me conta:\n\n1️⃣ Quero conhecer os produtos/serviços\n2️⃣ Preciso de uma proposta\n3️⃣ Já sou cliente\n4️⃣ Outra dúvida\n\nBasta responder com o número! 👇" } } },
          { id: "ws_wait2", type: "wait", position: { x: 250, y: 600 }, data: { label: "Aguardar 1 hora", config: { duration: 1, unit: "hours" } } },
          { id: "ws_msg3", type: "message", position: { x: 250, y: 740 }, data: { label: "Engajamento", config: { messageType: "text", text: "{{nome}}, vi que você ainda não respondeu. Sem problema! 😊\n\nSe tiver alguma dúvida ou quiser mais informações, é só chamar. Estamos aqui!" } } },
        ]
        edges = [
          { id: "e1", source: "ws_trigger", target: "ws_msg1", sourceHandle: "default" },
          { id: "e2", source: "ws_msg1", target: "ws_wait1", sourceHandle: "default" },
          { id: "e3", source: "ws_wait1", target: "ws_msg2", sourceHandle: "default" },
          { id: "e4", source: "ws_msg2", target: "ws_wait2", sourceHandle: "default" },
          { id: "e5", source: "ws_wait2", target: "ws_msg3", sourceHandle: "default" },
        ]

      } else if (template === "qualification_flow") {
        name = "Qualificação automática"
        description = "Envia perguntas de qualificação no primeiro contato, aguarda a resposta e encaminha para o vendedor certo."
        nodes = [
          { id: "qf_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Primeira mensagem recebida", config: { triggerType: "first_message" } } },
          { id: "qf_bh", type: "business_hours", position: { x: 250, y: 160 }, data: { label: "Horário Comercial", config: { timezone: "America/Sao_Paulo", schedule: { mon: { enabled: true, start: "09:00", end: "18:00" }, tue: { enabled: true, start: "09:00", end: "18:00" }, wed: { enabled: true, start: "09:00", end: "18:00" }, thu: { enabled: true, start: "09:00", end: "18:00" }, fri: { enabled: true, start: "09:00", end: "18:00" }, sat: { enabled: false, start: "09:00", end: "13:00" }, sun: { enabled: false, start: "09:00", end: "12:00" } } } } },
          { id: "qf_qual", type: "message", position: { x: 60, y: 320 }, data: { label: "Qualificação", config: { messageType: "text", text: "Olá, {{nome}}! 😊 Para te atender da melhor forma, me conta:\n\n*Qual é o seu maior desafio hoje?*\n\n1️⃣ Aumentar as vendas\n2️⃣ Automatizar processos\n3️⃣ Reduzir custos\n4️⃣ Outro motivo\n\nResponda com o número da opção!" } } },
          { id: "qf_wait", type: "wait", position: { x: 60, y: 480 }, data: { label: "Aguardar 30 min", config: { duration: 30, unit: "minutes" } } },
          { id: "qf_notify", type: "action", position: { x: 60, y: 630 }, data: { label: "Alertar equipe de vendas", config: { actionType: "internal_notification", params: { message: "🎯 Lead qualificado aguardando atendimento!\n\nNome: {{nome}}\nTelefone: {{telefone}}\n\nResponde logo para não perder!" } } } },
          { id: "qf_off", type: "message", position: { x: 440, y: 320 }, data: { label: "Fora do horário", config: { messageType: "text", text: "Olá, {{nome}}! 🌙 Recebemos sua mensagem!\n\nNosso atendimento é de segunda a sexta, das 9h às 18h. Retornaremos amanhã cedo! 😊" } } },
        ]
        edges = [
          { id: "e1", source: "qf_trigger", target: "qf_bh", sourceHandle: "default" },
          { id: "e2", source: "qf_bh", target: "qf_qual", sourceHandle: "within" },
          { id: "e3", source: "qf_bh", target: "qf_off", sourceHandle: "outside" },
          { id: "e4", source: "qf_qual", target: "qf_wait", sourceHandle: "default" },
          { id: "e5", source: "qf_wait", target: "qf_notify", sourceHandle: "default" },
        ]

      } else if (template === "instagram_welcome") {
        name = "Lead do Instagram → Atendimento"
        description = "Quando um lead chega pelo Instagram, envia boas-vindas personalizadas, adiciona tag e notifica a equipe."
        nodes = [
          { id: "ig_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Lead via Instagram", config: { triggerType: "lead_from_instagram" } } },
          { id: "ig_msg", type: "message", position: { x: 250, y: 160 }, data: { label: "Boas-vindas Instagram", config: { messageType: "text", text: "Olá, {{nome}}! 📸 Que bom ter você aqui!\n\nVi que você veio pelo Instagram. Como posso te ajudar hoje? 😊" } } },
          { id: "ig_tag", type: "action", position: { x: 250, y: 310 }, data: { label: "Tag: instagram", config: { actionType: "add_tag", params: { tag: "instagram" } } } },
          { id: "ig_notify", type: "action", position: { x: 250, y: 460 }, data: { label: "Notificar equipe", config: { actionType: "internal_notification", params: { message: "📸 Novo lead via Instagram!\n\nNome: {{nome}}\nTelefone: {{telefone}}\n\nAtenda agora antes que esfrie! 🔥" } } } },
        ]
        edges = [
          { id: "e1", source: "ig_trigger", target: "ig_msg", sourceHandle: "default" },
          { id: "e2", source: "ig_msg", target: "ig_tag", sourceHandle: "default" },
          { id: "e3", source: "ig_tag", target: "ig_notify", sourceHandle: "default" },
        ]

      } else if (template === "campaign_response") {
        name = "Resposta a campanha → Atendente"
        description = "Quando um lead responde a um disparo, verifica o horário, envia mensagem de oferta e transfere para atendimento humano."
        nodes = [
          { id: "cr_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Resposta a Campanha", config: { triggerType: "broadcast_response" } } },
          { id: "cr_bh", type: "business_hours", position: { x: 250, y: 160 }, data: { label: "Horário Comercial", config: { timezone: "America/Sao_Paulo", schedule: { mon: { enabled: true, start: "09:00", end: "18:00" }, tue: { enabled: true, start: "09:00", end: "18:00" }, wed: { enabled: true, start: "09:00", end: "18:00" }, thu: { enabled: true, start: "09:00", end: "18:00" }, fri: { enabled: true, start: "09:00", end: "18:00" }, sat: { enabled: false, start: "09:00", end: "13:00" }, sun: { enabled: false, start: "09:00", end: "12:00" } } } } },
          { id: "cr_offer", type: "message", position: { x: 60, y: 320 }, data: { label: "Oferta personalizada", config: { messageType: "text", text: "Que ótimo que você respondeu, {{nome}}! 🎉\n\nPreparei uma condição especial pra você. Deixa eu te conectar com nosso consultor agora!" } } },
          { id: "cr_transfer", type: "action", position: { x: 60, y: 480 }, data: { label: "Transferir para atendente", config: { actionType: "transfer_to_agent", params: { transfer_message: "Um consultor vai te atender agora, {{nome}}! 😊 Já já te respondo." } } } },
          { id: "cr_off", type: "message", position: { x: 440, y: 320 }, data: { label: "Fora do horário", config: { messageType: "text", text: "Recebemos sua resposta, {{nome}}! 😊\n\nNosso atendimento é das 9h às 18h, de segunda a sexta. Entraremos em contato assim que abrirmos! ⏰" } } },
        ]
        edges = [
          { id: "e1", source: "cr_trigger", target: "cr_bh", sourceHandle: "default" },
          { id: "e2", source: "cr_bh", target: "cr_offer", sourceHandle: "within" },
          { id: "e3", source: "cr_bh", target: "cr_off", sourceHandle: "outside" },
          { id: "e4", source: "cr_offer", target: "cr_transfer", sourceHandle: "default" },
        ]

      } else if (template === "followup_24h") {
        name = "Follow-up 24h após contato"
        description = "Envia uma mensagem inicial e, após 24 horas, faz um acompanhamento automático dentro do horário comercial."
        nodes = [
          { id: "fu_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Primeira mensagem recebida", config: { triggerType: "first_message" } } },
          { id: "fu_msg1", type: "message", position: { x: 250, y: 160 }, data: { label: "Primeiro contato", config: { messageType: "text", text: "Olá, {{nome}}! 👋 Obrigado por entrar em contato conosco!\n\nEm breve um de nossos consultores vai te atender. Enquanto isso, pode me contar mais sobre o que você precisa?" } } },
          { id: "fu_wait", type: "wait", position: { x: 250, y: 310 }, data: { label: "Aguardar 24h", config: { duration: 24, unit: "hours" } } },
          { id: "fu_bh", type: "business_hours", position: { x: 250, y: 450 }, data: { label: "Horário Comercial", config: { timezone: "America/Sao_Paulo", schedule: { mon: { enabled: true, start: "09:00", end: "18:00" }, tue: { enabled: true, start: "09:00", end: "18:00" }, wed: { enabled: true, start: "09:00", end: "18:00" }, thu: { enabled: true, start: "09:00", end: "18:00" }, fri: { enabled: true, start: "09:00", end: "18:00" }, sat: { enabled: false, start: "09:00", end: "13:00" }, sun: { enabled: false, start: "09:00", end: "12:00" } } } } },
          { id: "fu_followup", type: "message", position: { x: 60, y: 600 }, data: { label: "Lembrete", config: { messageType: "text", text: "Oi, {{nome}}! 😊 Passando para ver se ficou alguma dúvida.\n\nPodemos conversar? É só me chamar que já te respondo!" } } },
          { id: "fu_end", type: "action", position: { x: 440, y: 600 }, data: { label: "Encerrar (fora do horário)", config: { actionType: "end_automation" } } },
        ]
        edges = [
          { id: "e1", source: "fu_trigger", target: "fu_msg1", sourceHandle: "default" },
          { id: "e2", source: "fu_msg1", target: "fu_wait", sourceHandle: "default" },
          { id: "e3", source: "fu_wait", target: "fu_bh", sourceHandle: "default" },
          { id: "e4", source: "fu_bh", target: "fu_followup", sourceHandle: "within" },
          { id: "e5", source: "fu_bh", target: "fu_end", sourceHandle: "outside" },
        ]

      } else if (template === "reactivate_cold") {
        name = "Reativar lead frio"
        description = "Sequência de reativação para leads que pararam de responder: duas tentativas com 3 dias de intervalo, depois marca como perdido."
        nodes = [
          { id: "rc_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Tag adicionada", config: { triggerType: "tag_added", tag: "lead-frio" } } },
          { id: "rc_bh", type: "business_hours", position: { x: 250, y: 160 }, data: { label: "Horário Comercial", config: { timezone: "America/Sao_Paulo", schedule: { mon: { enabled: true, start: "09:00", end: "18:00" }, tue: { enabled: true, start: "09:00", end: "18:00" }, wed: { enabled: true, start: "09:00", end: "18:00" }, thu: { enabled: true, start: "09:00", end: "18:00" }, fri: { enabled: true, start: "09:00", end: "18:00" }, sat: { enabled: false, start: "09:00", end: "13:00" }, sun: { enabled: false, start: "09:00", end: "12:00" } } } } },
          { id: "rc_msg1", type: "message", position: { x: 60, y: 320 }, data: { label: "1ª tentativa de reativação", config: { messageType: "text", text: "Oi, {{nome}}! 👋 Tudo bem?\n\nFaz um tempo que não falamos e queria saber se ainda posso te ajudar com algo. Temos novidades que podem te interessar! 🎁" } } },
          { id: "rc_wait1", type: "wait", position: { x: 60, y: 480 }, data: { label: "Aguardar 3 dias", config: { duration: 3, unit: "days" } } },
          { id: "rc_msg2", type: "message", position: { x: 60, y: 620 }, data: { label: "Última tentativa", config: { messageType: "text", text: "{{nome}}, esta é minha última mensagem para não te incomodar. 🙏\n\nSe mudar de ideia sobre nos conhecer, estarei por aqui! Qualquer coisa é só chamar. Abraço!" } } },
          { id: "rc_wait2", type: "wait", position: { x: 60, y: 760 }, data: { label: "Aguardar 2 dias", config: { duration: 2, unit: "days" } } },
          { id: "rc_lost", type: "action", position: { x: 60, y: 900 }, data: { label: "Marcar como Perdido", config: { actionType: "set_lead_status", params: { status: "lost" } } } },
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

      } else if (template === "proposal_followup") {
        name = "Follow-up de proposta enviada"
        description = "Após mover o lead para a etapa de proposta, aguarda 48h e faz acompanhamento. Sem reação em 3 dias, envia mensagem de urgência."
        nodes = [
          { id: "pf_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Lead movido no Kanban", config: { triggerType: "deal_stage_changed" } } },
          { id: "pf_wait1", type: "wait", position: { x: 250, y: 160 }, data: { label: "Aguardar 48 horas", config: { duration: 48, unit: "hours" } } },
          { id: "pf_bh", type: "business_hours", position: { x: 250, y: 300 }, data: { label: "Horário Comercial", config: { timezone: "America/Sao_Paulo", schedule: { mon: { enabled: true, start: "09:00", end: "18:00" }, tue: { enabled: true, start: "09:00", end: "18:00" }, wed: { enabled: true, start: "09:00", end: "18:00" }, thu: { enabled: true, start: "09:00", end: "18:00" }, fri: { enabled: true, start: "09:00", end: "18:00" }, sat: { enabled: false, start: "09:00", end: "13:00" }, sun: { enabled: false, start: "09:00", end: "12:00" } } } } },
          { id: "pf_msg1", type: "message", position: { x: 60, y: 460 }, data: { label: "Follow-up da proposta", config: { messageType: "text", text: "Olá, {{nome}}! 😊 Passando para saber se você teve a chance de analisar nossa proposta.\n\nTem alguma dúvida que eu possa esclarecer? Estou à disposição!" } } },
          { id: "pf_wait2", type: "wait", position: { x: 60, y: 610 }, data: { label: "Aguardar 3 dias", config: { duration: 3, unit: "days" } } },
          { id: "pf_msg2", type: "message", position: { x: 60, y: 750 }, data: { label: "Mensagem de urgência", config: { messageType: "text", text: "{{nome}}, nossa proposta ainda está válida! ⏳\n\nGostaria de conversarmos antes que ela expire? Posso garantir uma condição especial se fecharmos ainda esta semana. 💪" } } },
          { id: "pf_end", type: "action", position: { x: 440, y: 460 }, data: { label: "Encerrar (fora do horário)", config: { actionType: "end_automation" } } },
        ]
        edges = [
          { id: "e1", source: "pf_trigger", target: "pf_wait1", sourceHandle: "default" },
          { id: "e2", source: "pf_wait1", target: "pf_bh", sourceHandle: "default" },
          { id: "e3", source: "pf_bh", target: "pf_msg1", sourceHandle: "within" },
          { id: "e4", source: "pf_bh", target: "pf_end", sourceHandle: "outside" },
          { id: "e5", source: "pf_msg1", target: "pf_wait2", sourceHandle: "default" },
          { id: "e6", source: "pf_wait2", target: "pf_msg2", sourceHandle: "default" },
        ]

      } else if (template === "meeting_reminder") {
        name = "Confirmação + lembrete de reunião"
        description = "Quando a tag reuniao-agendada é adicionada, confirma o agendamento e envia lembrete automático na véspera."
        nodes = [
          { id: "mr_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Tag adicionada", config: { triggerType: "tag_added", tag: "reuniao-agendada" } } },
          { id: "mr_confirm", type: "message", position: { x: 250, y: 160 }, data: { label: "Confirmação do agendamento", config: { messageType: "text", text: "✅ Olá, {{nome}}! Sua reunião está confirmada!\n\nVou te mandar um lembrete na véspera para garantir que não esquecemos. 📅\n\nQualquer dúvida ou necessidade de remarcar, é só me chamar!" } } },
          { id: "mr_wait", type: "wait", position: { x: 250, y: 310 }, data: { label: "Aguardar 23 horas", config: { duration: 23, unit: "hours" } } },
          { id: "mr_reminder", type: "message", position: { x: 250, y: 450 }, data: { label: "Lembrete na véspera", config: { messageType: "text", text: "⏰ {{nome}}, lembrete: temos nossa reunião agendada!\n\nEstaremos esperando por você. Qualquer eventualidade, me avise com antecedência. Até logo! 😊" } } },
          { id: "mr_note", type: "action", position: { x: 250, y: 600 }, data: { label: "Registrar no histórico", config: { actionType: "create_note", params: { content: "Lembrete de reunião enviado automaticamente 23h antes do horário agendado." } } } },
        ]
        edges = [
          { id: "e1", source: "mr_trigger", target: "mr_confirm", sourceHandle: "default" },
          { id: "e2", source: "mr_confirm", target: "mr_wait", sourceHandle: "default" },
          { id: "e3", source: "mr_wait", target: "mr_reminder", sourceHandle: "default" },
          { id: "e4", source: "mr_reminder", target: "mr_note", sourceHandle: "default" },
        ]

      } else if (template === "notify_new_lead") {
        name = "Novo lead → Notificar equipe"
        description = "Assim que um lead é criado, envia notificação pelo WhatsApp para os admins e envia boas-vindas ao lead."
        nodes = [
          { id: "nnl_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Lead criado", config: { triggerType: "lead_created" } } },
          { id: "nnl_notify", type: "action", position: { x: 250, y: 160 }, data: { label: "Notificar admins", config: { actionType: "internal_notification", params: { message: "🔔 Novo lead no CRM!\n\nNome: {{nome}}\nTelefone: {{telefone}}\nE-mail: {{email}}\n\nAcesse o CRM e atenda agora!" } } } },
          { id: "nnl_msg", type: "message", position: { x: 250, y: 310 }, data: { label: "Boas-vindas ao lead", config: { messageType: "text", text: "Olá, {{nome}}! 👋 Obrigado por entrar em contato!\n\nSua mensagem foi recebida e um de nossos consultores vai te atender em breve. Pode ficar tranquilo(a)! 😊" } } },
        ]
        edges = [
          { id: "e1", source: "nnl_trigger", target: "nnl_notify", sourceHandle: "default" },
          { id: "e2", source: "nnl_notify", target: "nnl_msg", sourceHandle: "default" },
        ]

      } else if (template === "deal_won_capi") {
        name = "Venda Fechada → Meta CAPI + Parabéns"
        description = "Quando o lead é movido para a etapa de ganho, dispara Purchase no Meta CAPI, envia mensagem de parabéns e registra no histórico."
        nodes = [
          { id: "dwc_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Lead movido no Kanban", config: { triggerType: "deal_stage_changed" } } },
          { id: "dwc_capi", type: "action", position: { x: 250, y: 160 }, data: { label: "Meta CAPI – Purchase", config: { actionType: "send_meta_event", params: { event_name: "Purchase", value: 0, currency: "BRL" } } } },
          { id: "dwc_msg", type: "message", position: { x: 250, y: 310 }, data: { label: "Mensagem de parabéns", config: { messageType: "text", text: "🎉 Parabéns, {{nome}}! Que alegria confirmar sua compra!\n\nEstamos muito felizes em ter você como cliente. Em breve entraremos em contato com os próximos passos.\n\nObrigado pela confiança! 🙏" } } },
          { id: "dwc_note", type: "action", position: { x: 250, y: 460 }, data: { label: "Registrar no histórico", config: { actionType: "create_note", params: { content: "Venda fechada. Evento Purchase enviado ao Meta CAPI automaticamente." } } } },
          { id: "dwc_status", type: "action", position: { x: 250, y: 610 }, data: { label: "Marcar como Ganho", config: { actionType: "set_lead_status", params: { status: "won" } } } },
        ]
        edges = [
          { id: "e1", source: "dwc_trigger", target: "dwc_capi", sourceHandle: "default" },
          { id: "e2", source: "dwc_capi", target: "dwc_msg", sourceHandle: "default" },
          { id: "e3", source: "dwc_msg", target: "dwc_note", sourceHandle: "default" },
          { id: "e4", source: "dwc_note", target: "dwc_status", sourceHandle: "default" },
        ]

      } else if (template === "post_sale_nps") {
        name = "NPS e satisfação pós-venda"
        description = "Três dias após a venda, envia pesquisa de satisfação de 0 a 10 e registra o resultado no histórico do lead."
        nodes = [
          { id: "nps_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Lead movido no Kanban", config: { triggerType: "deal_stage_changed" } } },
          { id: "nps_wait", type: "wait", position: { x: 250, y: 160 }, data: { label: "Aguardar 3 dias", config: { duration: 3, unit: "days" } } },
          { id: "nps_bh", type: "business_hours", position: { x: 250, y: 300 }, data: { label: "Horário Comercial", config: { timezone: "America/Sao_Paulo", schedule: { mon: { enabled: true, start: "09:00", end: "18:00" }, tue: { enabled: true, start: "09:00", end: "18:00" }, wed: { enabled: true, start: "09:00", end: "18:00" }, thu: { enabled: true, start: "09:00", end: "18:00" }, fri: { enabled: true, start: "09:00", end: "18:00" }, sat: { enabled: false, start: "09:00", end: "13:00" }, sun: { enabled: false, start: "09:00", end: "12:00" } } } } },
          { id: "nps_msg", type: "message", position: { x: 60, y: 460 }, data: { label: "Pesquisa NPS", config: { messageType: "text", text: "Olá, {{nome}}! 😊 Passando para saber como está sendo sua experiência conosco.\n\nNuma escala de *0 a 10*, o quanto você nos recomendaria a um amigo?\n\n0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟\n\nSua opinião nos ajuda a melhorar! 🙏" } } },
          { id: "nps_note", type: "action", position: { x: 60, y: 620 }, data: { label: "Registrar pesquisa enviada", config: { actionType: "create_note", params: { content: "Pesquisa de satisfação NPS enviada 3 dias após o fechamento da venda." } } } },
          { id: "nps_end", type: "action", position: { x: 440, y: 460 }, data: { label: "Encerrar (fora do horário)", config: { actionType: "end_automation" } } },
        ]
        edges = [
          { id: "e1", source: "nps_trigger", target: "nps_wait", sourceHandle: "default" },
          { id: "e2", source: "nps_wait", target: "nps_bh", sourceHandle: "default" },
          { id: "e3", source: "nps_bh", target: "nps_msg", sourceHandle: "within" },
          { id: "e4", source: "nps_bh", target: "nps_end", sourceHandle: "outside" },
          { id: "e5", source: "nps_msg", target: "nps_note", sourceHandle: "default" },
        ]

      } else if (template === "client_onboarding") {
        name = "Onboarding de novo cliente"
        description = "Após o fechamento da venda, conduz o cliente por uma jornada de onboarding com mensagens progressivas ao longo de 8 dias."
        nodes = [
          { id: "ob_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Lead movido no Kanban", config: { triggerType: "deal_stage_changed" } } },
          { id: "ob_welcome", type: "message", position: { x: 250, y: 160 }, data: { label: "Boas-vindas ao cliente", config: { messageType: "text", text: "🎉 Bem-vindo(a) à família, {{nome}}!\n\nEstamos muito felizes em ter você como cliente. Nos próximos dias vou te mandar algumas informações importantes para você aproveitar ao máximo. 🚀" } } },
          { id: "ob_wait1", type: "wait", position: { x: 250, y: 310 }, data: { label: "Aguardar 1 dia", config: { duration: 1, unit: "days" } } },
          { id: "ob_tips", type: "message", position: { x: 250, y: 450 }, data: { label: "Dicas iniciais", config: { messageType: "text", text: "💡 {{nome}}, aqui vão as primeiras dicas para você começar bem:\n\n✅ Complete seu cadastro no sistema\n✅ Explore o painel principal\n✅ Salve nosso contato para suporte\n\nTem alguma dúvida? Pode perguntar à vontade!" } } },
          { id: "ob_wait2", type: "wait", position: { x: 250, y: 600 }, data: { label: "Aguardar 7 dias", config: { duration: 7, unit: "days" } } },
          { id: "ob_check", type: "message", position: { x: 250, y: 740 }, data: { label: "Check-in de satisfação", config: { messageType: "text", text: "{{nome}}, já faz uma semana que você está conosco! 🥳\n\nComo está sendo sua experiência até agora? Alguma dúvida ou coisa que posso melhorar?\n\nSua opinião faz toda a diferença para nós! 💙" } } },
          { id: "ob_note", type: "action", position: { x: 250, y: 890 }, data: { label: "Registrar conclusão do onboarding", config: { actionType: "create_note", params: { content: "Onboarding concluído: boas-vindas (dia 0) + dicas (dia 1) + check-in de satisfação (dia 8)." } } } },
        ]
        edges = [
          { id: "e1", source: "ob_trigger", target: "ob_welcome", sourceHandle: "default" },
          { id: "e2", source: "ob_welcome", target: "ob_wait1", sourceHandle: "default" },
          { id: "e3", source: "ob_wait1", target: "ob_tips", sourceHandle: "default" },
          { id: "e4", source: "ob_tips", target: "ob_wait2", sourceHandle: "default" },
          { id: "e5", source: "ob_wait2", target: "ob_check", sourceHandle: "default" },
          { id: "e6", source: "ob_check", target: "ob_note", sourceHandle: "default" },
        ]

      } else if (template === "ab_test_welcome") {
        name = "A/B Test – Mensagem de boas-vindas"
        description = "Divide os novos contatos em dois grupos para testar versões diferentes de boas-vindas e descobrir qual converte melhor."
        nodes = [
          { id: "ab_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Primeira mensagem recebida", config: { triggerType: "first_message" } } },
          { id: "ab_split", type: "ab_split", position: { x: 250, y: 160 }, data: { label: "A/B Split 50/50", config: { split_a: 50 } } },
          { id: "ab_msg_a", type: "message", position: { x: 60, y: 320 }, data: { label: "Variante A – Direta", config: { messageType: "text", text: "Olá, {{nome}}! 👋 Seja bem-vindo(a)!\n\nSou da equipe de atendimento. Pode me contar o que você procura que já te ajudo! 😊" } } },
          { id: "ab_msg_b", type: "message", position: { x: 440, y: 320 }, data: { label: "Variante B – Curiosidade", config: { messageType: "text", text: "Oi, {{nome}}! 😊 Que bom te ver aqui!\n\nMuitos dos nossos clientes chegam com o mesmo desafio que você provavelmente tem. Me conta: o que te trouxe até a gente?" } } },
          { id: "ab_tag_a", type: "action", position: { x: 60, y: 490 }, data: { label: "Tag: ab-direto", config: { actionType: "add_tag", params: { tag: "ab-direto" } } } },
          { id: "ab_tag_b", type: "action", position: { x: 440, y: 490 }, data: { label: "Tag: ab-curiosidade", config: { actionType: "add_tag", params: { tag: "ab-curiosidade" } } } },
        ]
        edges = [
          { id: "e1", source: "ab_trigger", target: "ab_split", sourceHandle: "default" },
          { id: "e2", source: "ab_split", target: "ab_msg_a", sourceHandle: "a" },
          { id: "e3", source: "ab_split", target: "ab_msg_b", sourceHandle: "b" },
          { id: "e4", source: "ab_msg_a", target: "ab_tag_a", sourceHandle: "default" },
          { id: "e5", source: "ab_msg_b", target: "ab_tag_b", sourceHandle: "default" },
        ]

      } else if (template === "urgency_vs_value") {
        name = "A/B Test – Urgência vs. Valor"
        description = "Testa urgência (prazo/escassez) contra proposta de valor. Rastreia com tags e notifica a equipe após 2 dias."
        nodes = [
          { id: "uv_trigger", type: "trigger", position: { x: 250, y: 30 }, data: { label: "Lead criado", config: { triggerType: "lead_created" } } },
          { id: "uv_split", type: "ab_split", position: { x: 250, y: 160 }, data: { label: "A/B Split 50/50", config: { split_a: 50 } } },
          { id: "uv_msg_a", type: "message", position: { x: 60, y: 320 }, data: { label: "Variante A – Urgência", config: { messageType: "text", text: "Olá, {{nome}}! ⏳ Temos uma oferta exclusiva com vagas limitadas!\n\nSe fecharmos ainda esta semana, consigo uma condição especial que não estará disponível depois. Quer saber mais?" } } },
          { id: "uv_msg_b", type: "message", position: { x: 440, y: 320 }, data: { label: "Variante B – Valor", config: { messageType: "text", text: "Olá, {{nome}}! 👋 Nossos clientes costumam chegar com um desafio em comum.\n\nO que te trouxe até a gente? Me conta um pouco mais que eu te mostro como podemos resolver! 😊" } } },
          { id: "uv_tag_a", type: "action", position: { x: 60, y: 490 }, data: { label: "Tag: ab-urgencia", config: { actionType: "add_tag", params: { tag: "ab-urgencia" } } } },
          { id: "uv_tag_b", type: "action", position: { x: 440, y: 490 }, data: { label: "Tag: ab-valor", config: { actionType: "add_tag", params: { tag: "ab-valor" } } } },
          { id: "uv_wait_a", type: "wait", position: { x: 60, y: 640 }, data: { label: "Aguardar 2 dias", config: { duration: 2, unit: "days" } } },
          { id: "uv_wait_b", type: "wait", position: { x: 440, y: 640 }, data: { label: "Aguardar 2 dias", config: { duration: 2, unit: "days" } } },
          { id: "uv_notify_a", type: "action", position: { x: 60, y: 790 }, data: { label: "Alertar equipe (A)", config: { actionType: "internal_notification", params: { message: "📊 A/B Test – Variante URGÊNCIA\n\nLead: {{nome}} | {{telefone}}\n2 dias sem conversão. Hora de agir!" } } } },
          { id: "uv_notify_b", type: "action", position: { x: 440, y: 790 }, data: { label: "Alertar equipe (B)", config: { actionType: "internal_notification", params: { message: "📊 A/B Test – Variante VALOR\n\nLead: {{nome}} | {{telefone}}\n2 dias sem conversão. Hora de agir!" } } } },
        ]
        edges = [
          { id: "e1", source: "uv_trigger", target: "uv_split", sourceHandle: "default" },
          { id: "e2", source: "uv_split", target: "uv_msg_a", sourceHandle: "a" },
          { id: "e3", source: "uv_split", target: "uv_msg_b", sourceHandle: "b" },
          { id: "e4", source: "uv_msg_a", target: "uv_tag_a", sourceHandle: "default" },
          { id: "e5", source: "uv_msg_b", target: "uv_tag_b", sourceHandle: "default" },
          { id: "e6", source: "uv_tag_a", target: "uv_wait_a", sourceHandle: "default" },
          { id: "e7", source: "uv_tag_b", target: "uv_wait_b", sourceHandle: "default" },
          { id: "e8", source: "uv_wait_a", target: "uv_notify_a", sourceHandle: "default" },
          { id: "e9", source: "uv_wait_b", target: "uv_notify_b", sourceHandle: "default" },
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
