import { prisma } from "./prisma.js"
import { createHash } from "crypto"

export interface ReplyRouterConfig {
  yes_keywords: string[]
  no_keywords: string[]
  timeout_amount?: number
  timeout_unit?: string
}

// ── text helpers ─────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
}

export function matchReply(
  text: string,
  config: ReplyRouterConfig
): "yes" | "no" | "other" {
  const normalized = normalizeText(text)
  const yes = (config.yes_keywords || []).map(normalizeText)
  const no = (config.no_keywords || []).map(normalizeText)

  if (yes.some((kw) => normalized.includes(kw))) return "yes"
  if (no.some((kw) => normalized.includes(kw))) return "no"
  return "other"
}

function renderTemplate(
  text: string,
  ctx: Record<string, any>
): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const parts = key.trim().split(".")
    let val: any = ctx
    for (const p of parts) val = val?.[p]
    return val != null ? String(val) : ""
  })
}

// ── Evolution API send ────────────────────────────────────────────────────────

async function sendWhatsAppText(
  instanceName: string,
  phone: string,
  text: string
): Promise<void> {
  const base = process.env.EVOLUTION_API_URL?.replace(/\/$/, "") || ""
  const apiKey = process.env.EVOLUTION_API_KEY || ""
  await fetch(`${base}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: phone, text }),
  }).catch((e) => console.error("[automationRunner] sendText failed:", e))
}

// ── find paused run ───────────────────────────────────────────────────────────

export async function findPausedReplyRouterRun(
  orgId: string,
  phone: string
): Promise<{ runId: string; nodeId: string; nodeConfig: ReplyRouterConfig; instanceName: string } | null> {
  // find leads in this org with this phone
  const lead = await prisma.lead.findFirst({
    where: { organizationId: orgId, phone: { contains: phone.slice(-8) } },
  }).catch(() => null)
  if (!lead) return null

  // find paused run for this lead
  const run = await prisma.automationRun.findFirst({
    where: {
      organizationId: orgId,
      leadId: lead.id,
      status: "paused",
      currentNodeId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
  }).catch(() => null)
  if (!run || !run.currentNodeId) return null

  // load the flow to check if currentNode is reply_router
  const flow = await prisma.automationFlow.findFirst({
    where: { automationId: run.automationId, organizationId: orgId },
    orderBy: { version: "desc" },
  }).catch(() => null)
  if (!flow) return null

  const nodes = (flow.nodes as any[]) || []
  const node = nodes.find((n: any) => n.id === run.currentNodeId)
  if (!node || node.type !== "reply_router") return null

  const nodeConfig: ReplyRouterConfig = node.data?.config || {}

  // get whatsapp instance for this org
  const integration = await (prisma as any).whatsappIntegration?.findFirst?.({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  }).catch(() => null)

  return {
    runId: run.id,
    nodeId: run.currentNodeId,
    nodeConfig,
    instanceName: integration?.instanceName || "",
  }
}

// ── resume run ────────────────────────────────────────────────────────────────

export async function resumeRun(
  runId: string,
  branch: string,
  replyText: string
): Promise<void> {
  const run = await prisma.automationRun.findUnique({ where: { id: runId } }).catch(() => null)
  if (!run) return

  const ctx = ((run.context as any) || {}) as Record<string, any>
  const updatedCtx = { ...ctx, reply_text: replyText, reply_branch: branch }

  // find the next node for this branch
  const flow = await prisma.automationFlow.findFirst({
    where: { automationId: run.automationId, organizationId: run.organizationId },
    orderBy: { version: "desc" },
  }).catch(() => null)
  if (!flow) return

  const edges = (flow.edges as any[]) || []
  const edge = edges.find(
    (e: any) => e.source === run.currentNodeId && e.sourceHandle === branch
  ) || edges.find(
    (e: any) => e.source === run.currentNodeId
  )

  await prisma.automationRun.update({
    where: { id: runId },
    data: { status: "running", context: updatedCtx as any, updatedAt: new Date() },
  }).catch(() => null)

  if (!edge) {
    await prisma.automationRun.update({
      where: { id: runId },
      data: { status: "completed", completedAt: new Date(), updatedAt: new Date() },
    }).catch(() => null)
    return
  }

  await runFromNode(runId, edge.target, flow, updatedCtx)
}

// ── node executor ─────────────────────────────────────────────────────────────

async function runFromNode(
  runId: string,
  nodeId: string,
  flow: { nodes: any; edges: any; automationId: string },
  ctx: Record<string, any>,
  depth = 0
): Promise<void> {
  if (depth > 20) return // loop guard

  const nodes = (flow.nodes as any[]) || []
  const edges = (flow.edges as any[]) || []
  const node = nodes.find((n: any) => n.id === nodeId)
  if (!node) {
    await prisma.automationRun.update({
      where: { id: runId },
      data: { status: "completed", completedAt: new Date(), updatedAt: new Date() },
    }).catch(() => null)
    return
  }

  const nodeType: string = node.type || ""
  const config = node.data?.config || {}

  await prisma.automationRun.update({
    where: { id: runId },
    data: { currentNodeId: nodeId, updatedAt: new Date() },
  }).catch(() => null)

  if (nodeType === "message") {
    const text = renderTemplate(config.text || "", ctx)
    const phone: string = ctx.lead_phone || ctx.phone || ""
    const instanceName: string = ctx.instance_name || ""
    if (phone && instanceName) {
      await sendWhatsAppText(instanceName, phone, text)
    }
    // continue to next node
    const nextEdge = edges.find((e: any) => e.source === nodeId)
    if (nextEdge) {
      await runFromNode(runId, nextEdge.target, flow, ctx, depth + 1)
    } else {
      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: "completed", completedAt: new Date(), updatedAt: new Date() },
      }).catch(() => null)
    }

  } else if (nodeType === "reply_router") {
    const timeoutMs = toMs(config.timeout_amount || 24, config.timeout_unit || "hours")
    const nextRunAt = new Date(Date.now() + timeoutMs)
    await prisma.automationRun.update({
      where: { id: runId },
      data: {
        status: "paused",
        currentNodeId: nodeId,
        nextRunAt,
        context: { ...ctx, router_config: config } as any,
        updatedAt: new Date(),
      },
    }).catch(() => null)
    // schedule timeout
    setTimeout(() => handleRouterTimeout(runId, nodeId).catch(console.error), timeoutMs)

  } else if (nodeType === "delay") {
    const ms = toMs(config.amount || 1, config.unit || "minutes")
    const nextRunAt = new Date(Date.now() + ms)
    await prisma.automationRun.update({
      where: { id: runId },
      data: { status: "paused", currentNodeId: nodeId, nextRunAt, updatedAt: new Date() },
    }).catch(() => null)
    setTimeout(async () => {
      const nextEdge = edges.find((e: any) => e.source === nodeId)
      if (!nextEdge) {
        await prisma.automationRun.update({
          where: { id: runId },
          data: { status: "completed", completedAt: new Date(), updatedAt: new Date() },
        }).catch(() => null)
        return
      }
      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: "running", updatedAt: new Date() },
      }).catch(() => null)
      await runFromNode(runId, nextEdge.target, flow, ctx, depth + 1)
    }, ms)

  } else if (nodeType === "condition") {
    const field: string = config.field || ""
    const operator: string = config.operator || "equals"
    const expected: string = config.value || ""
    const actual = field.split(".").reduce((o: any, k: string) => o?.[k], ctx)
    let result = false
    if (operator === "equals") result = String(actual) === expected
    else if (operator === "not_equals") result = String(actual) !== expected
    else if (operator === "contains") result = String(actual).includes(expected)
    else if (operator === "not_contains") result = !String(actual).includes(expected)
    else if (operator === "is_empty") result = !actual
    else if (operator === "is_not_empty") result = !!actual

    const handle = result ? "true" : "false"
    const nextEdge =
      edges.find((e: any) => e.source === nodeId && e.sourceHandle === handle) ||
      edges.find((e: any) => e.source === nodeId)
    if (nextEdge) {
      await runFromNode(runId, nextEdge.target, flow, ctx, depth + 1)
    } else {
      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: "completed", completedAt: new Date(), updatedAt: new Date() },
      }).catch(() => null)
    }

  } else if (nodeType === "wait_for_reply") {
    // identical to reply_router — pause and wait for inbound message
    const timeoutMs = toMs(config.timeout_amount || 24, config.timeout_unit || "hours")
    const nextRunAt = new Date(Date.now() + timeoutMs)
    await prisma.automationRun.update({
      where: { id: runId },
      data: {
        status: "paused",
        currentNodeId: nodeId,
        nextRunAt,
        context: { ...ctx, router_config: config } as any,
        updatedAt: new Date(),
      },
    }).catch(() => null)
    setTimeout(() => handleRouterTimeout(runId, nodeId).catch(console.error), timeoutMs)

  } else if (nodeType === "action") {
    const actionType: string = config.actionType || ""

    if (actionType === "end_automation") {
      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: "completed", completedAt: new Date(), updatedAt: new Date() },
      }).catch(() => null)
      return
    }

    if (actionType === "move_stage") {
      const stageId: string | undefined = config.params?.stage_id
      if (stageId && ctx.lead_id) {
        await prisma.lead.update({
          where: { id: ctx.lead_id },
          data: { stageId, updatedAt: new Date() },
        }).catch(() => null)
      }
    }

    if (actionType === "assign_owner") {
      const sellerId: string | undefined = config.params?.owner_id
      if (sellerId && sellerId !== "auto" && ctx.lead_id) {
        await prisma.lead.update({
          where: { id: ctx.lead_id },
          data: { sellerId, updatedAt: new Date() },
        }).catch(() => null)
      }
    }

    if (actionType === "update_lead") {
      const updates: Record<string, any> = {}
      if (config.params?.name) updates.name = renderTemplate(config.params.name, ctx)
      if (config.params?.email) updates.email = renderTemplate(config.params.email, ctx)
      if (config.params?.interest) updates.interest = renderTemplate(config.params.interest, ctx)
      if (config.params?.observations) updates.observations = renderTemplate(config.params.observations, ctx)
      if (config.params?.valor_negocio != null) updates.valorNegocio = Number(config.params.valor_negocio)
      if (ctx.lead_id && Object.keys(updates).length > 0) {
        await prisma.lead.update({
          where: { id: ctx.lead_id },
          data: { ...updates, updatedAt: new Date() },
        }).catch(() => null)
      }
    }

    if (actionType === "add_tag") {
      const tag: string = config.params?.tag || ""
      if (tag && ctx.lead_id) {
        const lead = await prisma.lead.findUnique({
          where: { id: ctx.lead_id },
          select: { tags: true },
        }).catch(() => null)
        const currentTags: string[] = (lead?.tags as string[]) || []
        if (!currentTags.includes(tag)) {
          await prisma.lead.update({
            where: { id: ctx.lead_id },
            data: { tags: [...currentTags, tag], updatedAt: new Date() },
          }).catch(() => null)
        }
      }
    }

    if (actionType === "send_whatsapp") {
      const text = renderTemplate(config.params?.message || "", ctx)
      const phone: string = ctx.lead_phone || ctx.phone || ""
      const instanceName: string = ctx.instance_name || ""
      if (phone && instanceName && text) {
        await sendWhatsAppText(instanceName, phone, text)
      }
    }

    if (actionType === "send_meta_event") {
      const eventName: string = config.params?.event_name || "Lead"
      const value = config.params?.value
        ? parseFloat(renderTemplate(String(config.params.value), ctx)) || undefined
        : undefined
      const currency: string = config.params?.currency || "BRL"
      const orgId: string = ctx.organization_id || ""
      const leadId: string | undefined = ctx.lead_id
      if (orgId && leadId) {
        await sendMetaCapiForLead(orgId, leadId, eventName, value, currency).catch(() => null)
      }
    }

    // continue to next node
    const nextEdge = edges.find((e: any) => e.source === nodeId)
    if (nextEdge) {
      await runFromNode(runId, nextEdge.target, flow, ctx, depth + 1)
    } else {
      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: "completed", completedAt: new Date(), updatedAt: new Date() },
      }).catch(() => null)
    }

  } else {
    // unknown node type: skip to next
    const nextEdge = edges.find((e: any) => e.source === nodeId)
    if (nextEdge) {
      await runFromNode(runId, nextEdge.target, flow, ctx, depth + 1)
    } else {
      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: "completed", completedAt: new Date(), updatedAt: new Date() },
      }).catch(() => null)
    }
  }
}

// ── timeout handler ───────────────────────────────────────────────────────────

async function handleRouterTimeout(runId: string, nodeId: string): Promise<void> {
  const run = await prisma.automationRun.findUnique({ where: { id: runId } }).catch(() => null)
  if (!run || run.status !== "paused" || run.currentNodeId !== nodeId) return

  await resumeRun(runId, "timeout", "")
}

// ── meta capi helper ──────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  return createHash("sha256").update(text).digest("hex")
}

async function sendMetaCapiForLead(
  orgId: string,
  leadId: string,
  eventName: string,
  value?: number,
  currency?: string,
  extraParams?: Record<string, string>
): Promise<void> {
  const settings = await (prisma as any).metaCapiSettings?.findFirst?.({
    where: { organizationId: orgId, enabled: true },
  }).catch(() => null)
  if (!settings?.pixelId || !settings?.accessToken) return

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { name: true, phone: true, email: true, valorNegocio: true },
  }).catch(() => null)
  if (!lead) return

  const userData: Record<string, unknown> = {}
  if (lead.email) userData.em = [await sha256(lead.email.toLowerCase().trim())]
  if (lead.phone) userData.ph = [await sha256(lead.phone.replace(/\D/g, ""))]
  if (lead.name) {
    const parts = lead.name.trim().split(" ")
    userData.fn = [await sha256(parts[0].toLowerCase())]
    if (parts.length > 1) userData.ln = [await sha256(parts[parts.length - 1].toLowerCase())]
  }

  const customData: Record<string, unknown> = {
    currency: currency || "BRL",
    ...extraParams,
  }
  if (value != null) customData.value = value
  else if (eventName === "Purchase" && lead.valorNegocio) customData.value = lead.valorNegocio

  const eventId = `${leadId}_${eventName}_${Date.now()}`
  const payload: Record<string, unknown> = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: "other",
      user_data: userData,
      custom_data: customData,
    }],
  }
  if (settings.testEventCode) payload.test_event_code = settings.testEventCode

  await fetch(
    `https://graph.facebook.com/v18.0/${settings.pixelId}/events?access_token=${settings.accessToken}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
  ).catch((e) => console.error("[automationRunner] Meta CAPI error:", e))
}

// ── fire automation trigger ───────────────────────────────────────────────────

export async function fireAutomationTrigger(
  orgId: string,
  triggerType: string,
  leadId: string | null,
  extraCtx: Record<string, any> = {}
): Promise<void> {
  const automations = await prisma.automation.findMany({
    where: { organizationId: orgId, isActive: true },
    select: { id: true },
  }).catch(() => [] as { id: string }[])

  if (automations.length === 0) return

  // Build lead context
  let leadCtx: Record<string, any> = {}
  if (leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, name: true, phone: true, email: true, valorNegocio: true, stageId: true },
    }).catch(() => null)
    if (lead) {
      leadCtx = {
        lead_id: lead.id,
        lead_phone: lead.phone,
        lead_email: lead.email || "",
        nome: lead.name,
        telefone: lead.phone,
        email: lead.email || "",
        valor_negocio: lead.valorNegocio ?? 0,
        etapa: lead.stageId || "",
      }
    }
  }

  // Get WhatsApp instance
  const wapp = await (prisma as any).whatsappIntegration?.findFirst?.({
    where: { organizationId: orgId },
    select: { instanceName: true },
  }).catch(() => null)

  const baseCtx: Record<string, any> = {
    ...leadCtx,
    ...extraCtx,
    organization_id: orgId,
    instance_name: wapp?.instanceName || extraCtx.instance_name || "",
  }

  for (const { id: automationId } of automations) {
    const flow = await prisma.automationFlow.findFirst({
      where: { automationId },
      orderBy: { version: "desc" },
    }).catch(() => null)
    if (!flow) continue

    const nodes = (flow.nodes as any[]) || []
    const edges = (flow.edges as any[]) || []

    const triggerNode = nodes.find(
      (n: any) => n.type === "trigger" && n.data?.config?.triggerType === triggerType
    )
    if (!triggerNode) continue

    const cfg = triggerNode.data?.config || {}

    // first_message: keyword filter + deduplication per phone
    if (triggerType === "first_message") {
      const phone: string = baseCtx.lead_phone || extraCtx.phone || ""
      const channel: string = extraCtx.channel || "whatsapp"

      if (cfg.channel && cfg.channel !== "all" && cfg.channel !== channel) continue

      if (cfg.useKeyword && cfg.keyword) {
        const msgText: string = extraCtx.message_text || ""
        let matched = false
        const normalize = (s: string) =>
          (cfg.ignore_accents_case ?? true)
            ? s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
            : s.trim()
        const normMsg = normalize(msgText)
        const normKw = normalize(cfg.keyword)
        const matchType = cfg.matchType || "contains"
        if (matchType === "contains") matched = normMsg.includes(normKw)
        else if (matchType === "equals") matched = normMsg === normKw
        else if (matchType === "starts_with") matched = normMsg.startsWith(normKw)
        else if (matchType === "regex") {
          try { matched = new RegExp(cfg.keyword, "i").test(msgText) } catch {}
        }
        if (!matched) continue
      }

      if (phone) {
        const already = await (prisma as any).automationFirstContact?.findFirst?.({
          where: { automationId, organizationId: orgId, phone },
        }).catch(() => null)
        if (already) continue
        await (prisma as any).automationFirstContact?.create?.({
          data: { automationId, organizationId: orgId, phone },
        }).catch(() => null)
      }
    }

    // deal_stage_changed / lead_stage_changed: match specific stage
    if (triggerType === "deal_stage_changed" || triggerType === "lead_stage_changed") {
      if (cfg.stage_id && cfg.stage_id !== extraCtx.to_stage_id) continue
    }

    // tag_added: match specific tag
    if (triggerType === "tag_added") {
      if (cfg.tag && cfg.tag !== extraCtx.tag) continue
    }

    // lead_inactive: use lastInboundMessageAt from Lead model
    if (triggerType === "lead_inactive") {
      if (!leadId) continue
      const inactiveDays = Number(cfg.inactive_days) || 7
      const cutoff = new Date(Date.now() - inactiveDays * 86_400_000)
      const leadActivity = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { lastInboundMessageAt: true },
      }).catch(() => null)
      if (leadActivity?.lastInboundMessageAt && leadActivity.lastInboundMessageAt > cutoff) continue
      const recent = await prisma.automationRun.findFirst({
        where: { organizationId: orgId, automationId, leadId, startedAt: { gt: cutoff } },
      }).catch(() => null)
      if (recent) continue
    }

    // owner_assigned: optionally filter by specific seller
    if (triggerType === "owner_assigned") {
      if (cfg.seller_id && cfg.seller_id !== extraCtx.new_seller_id) continue
    }

    const outEdge = edges.find((e: any) => e.source === triggerNode.id)
    if (!outEdge) continue

    const run = await prisma.automationRun.create({
      data: {
        organizationId: orgId,
        automationId,
        leadId: leadId || null,
        entityType: "lead",
        entityId: leadId || null,
        status: "running",
        currentNodeId: outEdge.target,
        context: baseCtx as any,
        startedAt: new Date(),
      },
    }).catch((e: Error) => {
      console.error("[automationRunner] Failed to create run:", e.message)
      return null
    })
    if (!run) continue

    setImmediate(() =>
      runFromNode(run.id, outEdge.target, flow, baseCtx)
        .catch((e) => console.error("[automationRunner] runFromNode error:", e))
    )
  }
}

// ── inactive lead cron check ──────────────────────────────────────────────────

export async function runInactiveLeadCheck(orgId: string): Promise<void> {
  const automations = await prisma.automation.findMany({
    where: { organizationId: orgId, isActive: true },
    select: { id: true },
  }).catch(() => [] as { id: string }[])

  for (const { id: automationId } of automations) {
    const flow = await prisma.automationFlow.findFirst({
      where: { automationId },
      orderBy: { version: "desc" },
    }).catch(() => null)
    if (!flow) continue

    const nodes = (flow.nodes as any[]) || []
    const triggerNode = nodes.find(
      (n: any) => n.type === "trigger" && n.data?.config?.triggerType === "lead_inactive"
    )
    if (!triggerNode) continue

    const inactiveDays = Number(triggerNode.data?.config?.inactive_days) || 7
    const cutoff = new Date(Date.now() - inactiveDays * 86_400_000)

    // find leads with no inbound message in the last N days (using lastInboundMessageAt)
    const leads = await prisma.lead.findMany({
      where: {
        organizationId: orgId,
        createdAt: { lt: cutoff },
        OR: [
          { lastInboundMessageAt: null },
          { lastInboundMessageAt: { lt: cutoff } },
        ],
      },
      select: { id: true, phone: true },
      take: 200,
    }).catch(() => [] as { id: string; phone: string | null }[])

    for (const lead of leads) {
      const alreadyRan = await prisma.automationRun.findFirst({
        where: { organizationId: orgId, automationId, leadId: lead.id, startedAt: { gt: cutoff } },
      }).catch(() => null)
      if (alreadyRan) continue

      await fireAutomationTrigger(orgId, "lead_inactive", lead.id, {
        phone: lead.phone || "",
        inactive_days: inactiveDays,
      })
    }
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function toMs(amount: number, unit: string): number {
  const map: Record<string, number> = {
    seconds: 1_000,
    minutes: 60_000,
    hours: 3_600_000,
    days: 86_400_000,
  }
  return amount * (map[unit] || 3_600_000)
}
