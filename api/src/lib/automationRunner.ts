import { prisma } from "./prisma.js"

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

  } else if (nodeType === "action") {
    const actionType: string = config.actionType || ""
    if (actionType === "end_automation") {
      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: "completed", completedAt: new Date(), updatedAt: new Date() },
      }).catch(() => null)
      return
    }
    // other actions: skip and continue
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
