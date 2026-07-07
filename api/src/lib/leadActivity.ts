import { prisma } from "./prisma.js"

export type LeadActivityType =
  | "created" | "stage_changed" | "status_changed" | "assigned"
  | "note" | "task" | "tag" | "message" | "score_changed"

/**
 * Registra uma atividade na timeline do lead. Best-effort: nunca lança
 * (falha de log não pode quebrar a operação principal).
 */
export async function logLeadActivity(opts: {
  orgId: string
  leadId: string
  type: LeadActivityType
  description: string
  metadata?: Record<string, unknown>
  performedBy?: string | null
  performedByName?: string | null
}): Promise<void> {
  try {
    await (prisma as any).leadActivity.create({
      data: {
        organizationId: opts.orgId,
        leadId: opts.leadId,
        type: opts.type,
        description: opts.description,
        metadata: opts.metadata ? (opts.metadata as any) : undefined,
        performedBy: opts.performedBy || null,
        performedByName: opts.performedByName || null,
      },
    })
  } catch (e) {
    console.error("[leadActivity] falha ao registrar:", (e as any)?.message)
  }
}

/**
 * Calcula um score simples (0-100) baseado em sinais de engajamento e dados.
 * Heurística transparente — pode ser refinada depois.
 */
export function computeLeadScore(lead: {
  email?: string | null
  valorNegocio?: number | null
  lastInboundMessageAt?: Date | null
  lastReplyAt?: Date | null
  source?: string | null
  interest?: string | null
  tags?: string[] | null
}): number {
  let score = 0
  if (lead.email) score += 10
  if (lead.interest) score += 10
  if (lead.valorNegocio && lead.valorNegocio > 0) score += 20
  if (lead.tags && lead.tags.length > 0) score += 10
  // Engajamento recente (respondeu nos últimos 7 dias)
  const now = Date.now()
  const weekMs = 7 * 24 * 60 * 60 * 1000
  if (lead.lastInboundMessageAt && now - new Date(lead.lastInboundMessageAt).getTime() < weekMs) score += 30
  else if (lead.lastInboundMessageAt) score += 10
  // Origem paga tende a ter maior intenção
  if (lead.source && /meta|ads|google|paid/i.test(lead.source)) score += 10
  return Math.min(100, score)
}
