import { prisma } from "./prisma.js"
import { createHash } from "crypto"
import { emit } from "../plugins/socket.js"
import { logLeadActivity } from "./leadActivity.js"

// ── distribuição de leads ──────────────────────────────────────────────────────
// Resolve o responsável de um novo lead quando "distribuição automática" está ativa:
//  1) owner_id explícito → usa ele
//  2) usuários configurados na distribuição → round-robin entre eles
//  3) senão → round-robin entre os VENDEDORES da org (fallback: admins)
// O cursor de rodízio é persistido em LeadDistributionSettings.rrCursor.
async function resolveLeadOwner(orgId: string, ownerId?: string): Promise<string | null> {
  if (ownerId) return ownerId

  const settings = await prisma.leadDistributionSettings.findFirst({
    where: { organizationId: orgId },
    include: { users: { where: { isActive: true }, orderBy: { orderPosition: "asc" } } },
  }).catch(() => null)

  // Candidatos: usuários explicitamente configurados na distribuição...
  let candidateIds: string[] = (settings?.users || []).map((u) => u.userId).filter(Boolean)

  // ...ou, se não houver lista configurada, os vendedores da org (senão os admins)
  if (candidateIds.length === 0) {
    const sellers = await prisma.profile.findMany({
      where: { organizationId: orgId, role: "seller" },
      orderBy: { createdAt: "asc" }, select: { id: true },
    }).catch(() => [] as { id: string }[])
    candidateIds = sellers.map((s) => s.id)
    if (candidateIds.length === 0) {
      const admins = await prisma.profile.findMany({
        where: { organizationId: orgId, role: "admin" },
        orderBy: { createdAt: "asc" }, select: { id: true },
      }).catch(() => [] as { id: string }[])
      candidateIds = admins.map((a) => a.id)
    }
  }

  if (candidateIds.length === 0) return null

  // Round-robin com cursor persistido
  const cursor = settings?.rrCursor ?? 0
  const idx = ((cursor % candidateIds.length) + candidateIds.length) % candidateIds.length
  const chosen = candidateIds[idx]

  if (settings) {
    await prisma.leadDistributionSettings.update({
      where: { id: settings.id }, data: { rrCursor: cursor + 1, updatedAt: new Date() },
    }).catch(() => null)
  } else {
    await prisma.leadDistributionSettings.create({
      data: { organizationId: orgId, rrCursor: 1 },
    }).catch(() => null)
  }

  return chosen
}

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
): Promise<boolean> {
  const base = process.env.EVOLUTION_API_URL?.replace(/\/$/, "") || ""
  const apiKey = process.env.EVOLUTION_API_KEY || ""
  try {
    const res = await fetch(`${base}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: phone, text }),
    })
    return res.ok
  } catch (e) {
    console.error("[automationRunner] sendText failed:", e)
    return false
  }
}

async function sendWhatsAppMedia(
  instanceName: string,
  phone: string,
  mediaType: "image" | "video" | "document" | "audio",
  mediaUrl: string,
  opts: { caption?: string; filename?: string; asVoiceNote?: boolean } = {}
): Promise<void> {
  const base = process.env.EVOLUTION_API_URL?.replace(/\/$/, "") || ""
  const apiKey = process.env.EVOLUTION_API_KEY || ""
  const headers = { "Content-Type": "application/json", apikey: apiKey }

  if (mediaType === "audio" && opts.asVoiceNote !== false) {
    await fetch(`${base}/message/sendWhatsAppAudio/${instanceName}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ number: phone, audio: mediaUrl }),
    }).catch((e) => console.error("[automationRunner] sendAudio failed:", e))
    return
  }

  const body: Record<string, any> = {
    number: phone,
    mediatype: mediaType,
    media: mediaUrl,
  }
  if (opts.caption) body.caption = opts.caption
  if (opts.filename) body.fileName = opts.filename

  await fetch(`${base}/message/sendMedia/${instanceName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }).catch((e) => console.error("[automationRunner] sendMedia failed:", e))
}

// ── registro de passos da execução (para "Detalhes da Execução") ───────────────

const ACTION_LABELS: Record<string, string> = {
  create_deal: "Criar negócio", create_lead: "Criar lead", move_stage: "Mover etapa",
  update_lead: "Atualizar lead", add_tag: "Adicionar tag", set_lead_status: "Mudar status",
  send_whatsapp: "Enviar WhatsApp", send_meta_event: "Evento Meta CAPI", create_note: "Criar nota",
  internal_notification: "Notificação interna", transfer_to_agent: "Transferir para vendedor",
  end_automation: "Encerrar automação",
}
const NODE_LABELS: Record<string, string> = {
  trigger: "Gatilho", message: "Enviar mensagem", action: "Ação", delay: "Aguardar",
  wait: "Aguardar", condition: "Condição", reply_router: "Aguardar resposta",
  wait_for_reply: "Aguardar resposta", business_hours: "Horário comercial", ab_split: "Divisão A/B",
}
function nodeLabel(node: any): string {
  if (node?.type === "action") {
    const at = node?.data?.config?.actionType
    return ACTION_LABELS[at] || node?.data?.label || "Ação"
  }
  return node?.data?.label || NODE_LABELS[node?.type] || node?.type || "Bloco"
}
async function recordStep(
  runId: string, nodeId: string, nodeType: string, status: string,
  opts: { label?: string; error?: string } = {}
): Promise<void> {
  await (prisma as any).automationRunStep?.create?.({
    data: {
      runId, nodeId, nodeType, status,
      errorMessage: opts.error || null,
      outputData: opts.label ? ({ label: opts.label } as any) : undefined,
      startedAt: new Date(), completedAt: new Date(),
    },
  }).catch(() => null)
}

// ── find paused run ───────────────────────────────────────────────────────────

export async function findPausedReplyRouterRun(
  orgId: string,
  phone: string
): Promise<{ runId: string; nodeId: string; nodeType: string; nodeConfig: ReplyRouterConfig; instanceName: string } | null> {
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
  if (!node || (node.type !== "reply_router" && node.type !== "wait_for_reply")) return null

  const nodeConfig: ReplyRouterConfig = node.data?.config || {}

  // get whatsapp instance for this org
  const integration = await (prisma as any).whatsappIntegration?.findFirst?.({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  }).catch(() => null)

  return {
    runId: run.id,
    nodeId: run.currentNodeId,
    nodeType: node.type as string,
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
    await recordStep(runId, nodeId, "unknown", "failed", { error: "Bloco não encontrado — fluxo interrompido" })
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

  // Registra o bloco na timeline da execução. Os nós de envio (message/action)
  // registram o status real mais abaixo; os demais são registrados aqui.
  if (nodeType !== "message" && nodeType !== "action") {
    await recordStep(runId, nodeId, nodeType, "completed", { label: nodeLabel(node) })
  }

  if (nodeType === "message") {
    const phone: string = ctx.lead_phone || ctx.phone || ""
    const instanceName: string = ctx.instance_name || ""
    const msgType: string = config.messageType || "text"

    let msgOk = true
    let msgErr: string | undefined
    if (!phone || !instanceName) {
      msgOk = false
      msgErr = !phone ? "Sem telefone no contexto" : "Sem instância de WhatsApp conectada"
    } else {
      if (msgType === "text") {
        const text = renderTemplate(config.text || "", ctx)
        msgOk = await sendWhatsAppText(instanceName, phone, text)
        if (!msgOk) msgErr = "Falha ao enviar pela Evolution"
      } else if (msgType === "image" || msgType === "video") {
        const mediaUrl: string = config.mediaUrl || ""
        const caption = renderTemplate(config.caption || "", ctx)
        if (mediaUrl) await sendWhatsAppMedia(instanceName, phone, msgType, mediaUrl, { caption })
      } else if (msgType === "audio") {
        const mediaUrl: string = config.mediaUrl || ""
        if (mediaUrl) await sendWhatsAppMedia(instanceName, phone, "audio", mediaUrl, { asVoiceNote: config.asVoiceNote ?? true })
      } else if (msgType === "document") {
        const mediaUrl: string = config.mediaUrl || ""
        const caption: string = config.caption || ""
        const filename: string = config.filename || ""
        if (mediaUrl) await sendWhatsAppMedia(instanceName, phone, "document", mediaUrl, { caption, filename })
      }
    }
    await recordStep(runId, nodeId, "message", msgOk ? "completed" : "failed", { label: nodeLabel(node), error: msgErr })
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

  } else if (nodeType === "delay" || nodeType === "wait") {
    const ms = toMs(config.duration || config.amount || 1, config.unit || "minutes")
    const nextRunAt = new Date(Date.now() + ms)
    // Persiste o contexto para permitir recuperação do run após restart da API
    await prisma.automationRun.update({
      where: { id: runId },
      data: { status: "paused", currentNodeId: nodeId, nextRunAt, context: ctx as any, updatedAt: new Date() },
    }).catch(() => null)
    setTimeout(() => {
      // Claim atômico evita execução dupla (setTimeout + worker de recuperação)
      resumeDelayRun(runId, nodeId).catch((e) => console.error("[automation] delay resume error:", e))
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
    let actionOk = true
    let actionErr: string | undefined

    if (actionType === "end_automation") {
      await recordStep(runId, nodeId, "action", "completed", { label: nodeLabel(node) })
      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: "completed", completedAt: new Date(), updatedAt: new Date() },
      }).catch(() => null)
      return
    }

    // Criar negócio (lead) — cria o lead no pipeline/etapa e distribui automaticamente
    if (actionType === "create_deal" || actionType === "create_lead") {
      const p = config.params || {}
      const orgId: string = ctx.organization_id || ""
      const phoneRaw: string = String(ctx.lead_phone || ctx.telefone || ctx.phone || "")
      const phone = phoneRaw.replace(/\D/g, "")

      if (!orgId || !phone) {
        console.warn("[automation] create_deal: sem orgId/telefone no contexto")
      } else {
        // Deduplicação: se já existe lead "aberto" com esse telefone, não recria
        let existing: { id: string } | null = null
        if (p.deduplicate ?? true) {
          existing = await prisma.lead.findFirst({
            where: {
              organizationId: orgId,
              phone: { contains: phone.slice(-8) },
              OR: [{ status: null }, { status: { notIn: ["won", "lost"] } }],
            },
            select: { id: true },
          }).catch(() => null)
        }

        if (existing) {
          ctx.lead_id = existing.id  // segue o fluxo usando o lead existente
        } else {
          // Resolve etapa (usa a 1ª etapa do pipeline se não vier)
          let stageId: string | null = p.stage_id || null
          if (!stageId && p.pipeline_id) {
            const firstStage = await prisma.pipelineStage.findFirst({
              where: { pipelineId: p.pipeline_id },
              orderBy: { position: "asc" }, select: { id: true },
            }).catch(() => null)
            stageId = firstStage?.id || null
          }

          const ownerId = await resolveLeadOwner(orgId, p.owner_id || undefined)
          const name: string = String(ctx.nome || ctx.contact_name || ctx.name || `Lead ${phone.slice(-4)}`)

          const created = await prisma.lead.create({
            data: {
              organizationId: orgId,
              name,
              phone: phoneRaw,
              pipelineId: p.pipeline_id || null,
              stageId,
              sellerId: ownerId,
              source: p.source || ctx.source || "Automação",
              leadSource: p.lead_source || undefined,
              interest: ctx.message_text ? String(ctx.message_text).slice(0, 200) : undefined,
            },
          }).catch((e: any) => {
            console.error("[automation] create_deal falhou:", e?.message)
            return null
          })

          if (created) {
            ctx.lead_id = created.id
            ctx.nome = created.name
            try { emit(orgId, "lead:created", { ...created, stage_name: null }) } catch { /* socket off */ }
            logLeadActivity({
              orgId, leadId: created.id, type: "created",
              description: `Lead criado por automação${ownerId ? " e distribuído" : ""}`,
            }).catch(() => null)
            // Vincula a conversa de WhatsApp existente ao novo lead (se houver)
            await prisma.conversation.updateMany({
              where: { organizationId: orgId, contactPhone: { contains: phone.slice(-8) }, leadId: null },
              data: { leadId: created.id },
            }).catch(() => null)
          }
        }
      }
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

    if (actionType === "transfer_to_agent") {
      // 1. Envia mensagem de transição se configurada
      const transferMsg: string = config.params?.transfer_message || ""
      const phone: string = ctx.lead_phone || ctx.phone || ""
      const instanceName: string = ctx.instance_name || ""
      if (transferMsg && phone && instanceName) {
        await sendWhatsAppText(instanceName, phone, renderTemplate(transferMsg, ctx))
      }
      // 2. Atribui atendente ao lead
      const sellerId: string = config.params?.owner_id || ""
      if (sellerId && ctx.lead_id) {
        await prisma.lead.update({
          where: { id: ctx.lead_id },
          data: { sellerId, updatedAt: new Date() },
        }).catch(() => null)
      }
      // 3. Encerra a automação — conversa agora é de um humano
      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: "completed", completedAt: new Date(), updatedAt: new Date() },
      }).catch(() => null)
      return
    }

    if (actionType === "create_note") {
      const content = renderTemplate(config.params?.content || "", ctx)
      const orgId: string = ctx.organization_id || ""
      const leadId: string | undefined = ctx.lead_id
      if (content && orgId && leadId) {
        const conversation = await prisma.conversation.findFirst({
          where: { organizationId: orgId, leadId },
          orderBy: { lastMessageAt: "desc" },
          select: { id: true },
        }).catch(() => null)
        if (conversation) {
          await prisma.conversationNote.create({
            data: { conversationId: conversation.id, organizationId: orgId, content },
          }).catch(() => null)
        }
      }
    }

    if (actionType === "set_lead_status") {
      const status: string = config.params?.status || "won"
      if (ctx.lead_id && (status === "won" || status === "lost")) {
        await prisma.lead.update({
          where: { id: ctx.lead_id },
          data: { status, updatedAt: new Date() } as any,
        }).catch(() => null)
      }
    }

    if (actionType === "internal_notification") {
      const memberId: string = config.params?.member_id || ""
      const message = renderTemplate(config.params?.message || "", ctx)
      const orgId: string = ctx.organization_id || ""
      if (message && orgId) {
        const integration = await (prisma as any).whatsappIntegration?.findFirst?.({
          where: { organizationId: orgId },
          select: { instanceName: true },
        }).catch(() => null)
        if (integration?.instanceName) {
          const whereClause: any = { organizationId: orgId }
          if (memberId) whereClause.id = memberId
          else whereClause.role = { in: ["admin", "owner"] }
          const profiles = await prisma.profile.findMany({
            where: whereClause,
            select: { whatsappE164: true },
          }).catch(() => [])
          for (const p of profiles) {
            if (p.whatsappE164) {
              await sendWhatsAppText(integration.instanceName, p.whatsappE164, `🔔 Auto-Lead: ${message}`)
            }
          }
        }
      }
    }

    if (actionType === "send_whatsapp") {
      const text = renderTemplate(config.params?.message || "", ctx)
      const phone: string = ctx.lead_phone || ctx.phone || ""
      const instanceName: string = ctx.instance_name || ""
      if (phone && instanceName && text) {
        actionOk = await sendWhatsAppText(instanceName, phone, text)
        if (!actionOk) actionErr = "Falha ao enviar pela Evolution"
      } else {
        actionOk = false
        actionErr = !phone ? "Sem telefone no contexto" : !instanceName ? "Sem instância conectada" : "Mensagem vazia"
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
        const r = await sendMetaCapiForLead(orgId, leadId, eventName, value, currency)
          .catch((e) => { console.error("[automationRunner] meta capi:", e); return { ok: false, error: String(e?.message || e) } })
        if (!r.ok) { actionOk = false; actionErr = r.error || "Falha ao enviar evento à Meta" }
      } else {
        actionOk = false
        actionErr = !leadId ? "Sem lead vinculado — não há dados para enviar à Meta" : "Sem organização no contexto"
      }
    }

    // Registra o bloco de ação com o status apurado
    await recordStep(runId, nodeId, "action", actionOk ? "completed" : "failed", { label: nodeLabel(node), error: actionErr })

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

  } else if (nodeType === "business_hours") {
    const timezone: string = config.timezone || "America/Sao_Paulo"
    const schedule: Record<string, { enabled: boolean; start: string; end: string }> = config.schedule || {}

    const now = new Date()
    const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
    const localDay = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" })
      .format(now)
      .toLowerCase()
      .slice(0, 3)
    const dayKey = dayNames.includes(localDay) ? localDay : dayNames[now.getDay()]

    const localTime = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now)
    const [h, m] = localTime.split(":").map(Number)
    const currentMinutes = h * 60 + m

    const dayConfig = schedule[dayKey] || { enabled: false, start: "09:00", end: "18:00" }
    let within = false
    if (dayConfig.enabled) {
      const [sh, sm] = (dayConfig.start || "09:00").split(":").map(Number)
      const [eh, em] = (dayConfig.end || "18:00").split(":").map(Number)
      within = currentMinutes >= sh * 60 + sm && currentMinutes < eh * 60 + em
    }

    const handle = within ? "within" : "outside"
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

  } else if (nodeType === "ab_split") {
    const splitA = Number(config.split_a ?? 50)
    const handle = Math.random() * 100 < splitA ? "a" : "b"
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

// Retoma um run pausado num nó de delay/wait. Usa claim atômico (paused → running)
// para garantir que apenas UM executor (setTimeout ou worker de recuperação) continue.
async function resumeDelayRun(runId: string, nodeId: string): Promise<void> {
  const claim = await prisma.automationRun.updateMany({
    where: { id: runId, status: "paused", currentNodeId: nodeId },
    data: { status: "running", updatedAt: new Date() },
  }).catch(() => ({ count: 0 }))
  if (!claim.count) return // já foi retomado por outro executor

  const run = await prisma.automationRun.findUnique({ where: { id: runId } }).catch(() => null)
  if (!run) return

  const flow = await prisma.automationFlow.findFirst({
    where: { automationId: run.automationId, organizationId: run.organizationId },
    orderBy: { version: "desc" },
  }).catch(() => null)
  if (!flow) return

  const edges = (flow.edges as any[]) || []
  const nextEdge = edges.find((e: any) => e.source === nodeId)
  if (!nextEdge) {
    await prisma.automationRun.update({
      where: { id: runId },
      data: { status: "completed", completedAt: new Date(), updatedAt: new Date() },
    }).catch(() => null)
    return
  }
  const ctx = ((run.context as any) || {}) as Record<string, any>
  await runFromNode(runId, nextEdge.target, flow as any, ctx)
}

/**
 * Recupera runs pausados cujo prazo (nextRunAt) já venceu.
 * Chamado no startup e periodicamente — garante que delays e timeouts de
 * automações não sejam perdidos quando a API reinicia (ex: deploy).
 */
export async function resumePausedRuns(): Promise<number> {
  const due = await prisma.automationRun.findMany({
    where: { status: "paused", nextRunAt: { not: null, lte: new Date() } },
    select: { id: true, currentNodeId: true, automationId: true, organizationId: true },
    take: 200,
  }).catch(() => [] as any[])

  let resumed = 0
  for (const run of due) {
    if (!run.currentNodeId) continue
    try {
      const flow = await prisma.automationFlow.findFirst({
        where: { automationId: run.automationId, organizationId: run.organizationId },
        orderBy: { version: "desc" },
        select: { nodes: true },
      }).catch(() => null)
      const nodes = ((flow?.nodes as any[]) || [])
      const node = nodes.find((n: any) => n.id === run.currentNodeId)
      const nodeType = node?.type

      if (nodeType === "reply_router" || nodeType === "wait_for_reply") {
        await handleRouterTimeout(run.id, run.currentNodeId)
      } else {
        // delay/wait (ou nó desconhecido) — segue o fluxo
        await resumeDelayRun(run.id, run.currentNodeId)
      }
      resumed++
    } catch (e) {
      console.error("[automation] resumePausedRuns error for run", run.id, e)
    }
  }
  if (resumed > 0) console.log(`[automation] ${resumed} run(s) pausado(s) recuperado(s)`)
  return resumed
}

// ── meta capi helper ──────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  return createHash("sha256").update(text).digest("hex")
}

// Normaliza telefone BR para E.164 (55 + DDD + número) — a Meta casa melhor assim.
function toE164Brazil(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "").replace(/^0+/, "")
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d
  if (d.length === 10 || d.length === 11) return "55" + d
  return d
}

async function sendMetaCapiForLead(
  orgId: string,
  leadId: string,
  eventName: string,
  value?: number,
  currency?: string,
  extraParams?: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const settings = await (prisma as any).metaCapiSettings?.findFirst?.({
    where: { organizationId: orgId, enabled: true },
  }).catch(() => null)
  if (!settings?.pixelId || !settings?.accessToken) {
    return { ok: false, error: "Meta CAPI não configurado ou desativado (pixel/token ausente)" }
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { name: true, phone: true, email: true, valorNegocio: true, cidade: true, estado: true, fbc: true, fbp: true, metaCampaignId: true, metaAdsetId: true, metaAdId: true },
  }).catch(() => null)
  if (!lead) return { ok: false, error: "Lead não encontrado" }

  const userData: Record<string, unknown> = {}
  // Identificadores com hash (SHA256)
  if (lead.email) userData.em = [await sha256(lead.email.toLowerCase().trim())]
  if (lead.phone) userData.ph = [await sha256(toE164Brazil(lead.phone))]
  if (lead.name) {
    const parts = lead.name.trim().split(" ")
    userData.fn = [await sha256(parts[0].toLowerCase())]
    if (parts.length > 1) userData.ln = [await sha256(parts[parts.length - 1].toLowerCase())]
  }
  if (lead.cidade) userData.ct = [await sha256(lead.cidade.toLowerCase().trim())]
  if (lead.estado) {
    // Meta espera código de 2 letras (ex: "sc"). Aceita "SC - Santa Catarina" ou "SC"
    const stateCode = lead.estado.trim().split(/[\s-]/)[0].toLowerCase()
    userData.st = [await sha256(stateCode)]
  }
  // external_id — identificador único do lead no nosso sistema (hashed)
  userData.external_id = [await sha256(leadId)]
  // Cookies do Facebook Pixel — presentes quando lead vem por formulário de captura
  if (lead.fbc) userData.fbc = lead.fbc
  if (lead.fbp) userData.fbp = lead.fbp

  const customData: Record<string, unknown> = {
    currency: currency || "BRL",
    ...extraParams,
  }
  if (value != null) customData.value = value
  else if (eventName === "Purchase" && lead.valorNegocio) customData.value = lead.valorNegocio

  const eventId = `${leadId}_${eventName}_${Date.now()}`
  // Referência de anúncio para melhor atribuição
  const dataEvent: Record<string, unknown> = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: "other",
    user_data: userData,
    custom_data: customData,
  }
  if (lead.metaCampaignId) {
    (dataEvent as any).referral_info = {
      ...(dataEvent as any).referral_info,
      campaign_id: lead.metaCampaignId,
    }
  }
  if (lead.metaAdsetId) {
    (dataEvent as any).referral_info = {
      ...(dataEvent as any).referral_info,
      adgroup_id: lead.metaAdsetId,
    }
  }
  if (lead.metaAdId) {
    (dataEvent as any).referral_info = {
      ...(dataEvent as any).referral_info,
      ad_id: lead.metaAdId,
    }
  }

  const payload: Record<string, unknown> = {
    data: [dataEvent],
  }
  if (settings.testEventCode) payload.test_event_code = settings.testEventCode

  let httpStatus: number | null = null
  let responseJson: any = null
  let ok = false
  let error: string | undefined

  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${settings.pixelId}/events?access_token=${settings.accessToken}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    )
    httpStatus = res.status
    responseJson = await res.json().catch(() => null)

    if (res.ok && responseJson && responseJson.events_received >= 1) {
      ok = true
    } else {
      // Extrai a mensagem de erro da Meta (formato: { error: { message, ... } })
      const metaErr = responseJson?.error
      error = metaErr?.error_user_title || metaErr?.message
        || (res.ok ? `Meta não recebeu o evento (events_received: ${responseJson?.events_received ?? 0})` : `HTTP ${res.status}`)
    }
  } catch (e: any) {
    error = `Erro de rede ao chamar a Meta: ${e?.message || e}`
    console.error("[automationRunner] Meta CAPI error:", e)
  }

  // Auditoria: grava o log (payload já vai com PII hasheada; token fica só na URL)
  await (prisma as any).metaCapiLog?.create?.({
    data: {
      organizationId: orgId,
      leadId,
      metaEvent: eventName,
      status: ok ? "success" : "failed",
      httpStatus: httpStatus ?? undefined,
      requestJson: payload as any,
      responseJson: responseJson as any,
      failReason: error || null,
    },
  }).catch(() => null)

  return { ok, error }
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
