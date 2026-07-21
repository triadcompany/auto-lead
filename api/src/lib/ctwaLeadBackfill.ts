import { prisma } from "./prisma.js"
import { enrichLeadFromCtwa } from "./metaCtwa.js"

const FLAG = "ctwa_lead_enrichment_backfill_v1"

/**
 * Leads antigos que vieram de um clique em anúncio (CTWA) mas nunca foram
 * enriquecidos com campanha/conjunto/anúncio/click id — porque a mensagem
 * chegou antes desse fluxo existir, ou o enrich falhou na hora (ex: sem
 * token do Meta configurado ainda). A Conversation correspondente já guarda
 * ctwa_ad_id/ctwa_clid desde antes; usa isso pra reprocessar. As URLs brutas
 * (origem/mídia/miniatura) só existem pra mensagens recebidas depois da
 * mudança no webhook — não tem como recuperar as anteriores, o WhatsApp não
 * reenvia esse contexto depois que a mensagem já passou.
 * Roda uma única vez (marcado em `system_flags`), em background.
 */
export async function backfillCtwaEnrichmentForExistingLeads() {
  const already = await prisma
    .$queryRawUnsafe<{ key: string }[]>(`SELECT key FROM system_flags WHERE key = $1`, FLAG)
    .catch(() => [] as { key: string }[])
  if (already.length > 0) return

  console.log("[backfill-ctwa] iniciando reconciliação de leads sem atribuição de anúncio...")

  try {
    const leads = await prisma.lead.findMany({
      where: { metaAdId: null },
      select: { id: true, organizationId: true, phone: true },
    })

    let enriched = 0
    for (const lead of leads) {
      if (!lead.phone) continue
      const phoneDigits = lead.phone.replace(/\D/g, "").slice(-8)
      if (!phoneDigits) continue

      try {
        const conv = await prisma.conversation.findFirst({
          where: { organizationId: lead.organizationId, contactPhone: { contains: phoneDigits }, ctwaAdId: { not: null } },
          select: { ctwaAdId: true, ctwaClid: true, ctwaSourceUrl: true, ctwaMediaUrl: true, ctwaThumbnailUrl: true },
          orderBy: { createdAt: "desc" },
        })
        if (!conv?.ctwaAdId) continue

        await enrichLeadFromCtwa(lead.organizationId, lead.id, conv.ctwaAdId, {
          fbc: conv.ctwaClid,
          clickId: conv.ctwaClid,
          sourceUrl: conv.ctwaSourceUrl,
          mediaUrl: conv.ctwaMediaUrl,
          thumbnailUrl: conv.ctwaThumbnailUrl,
        })
        enriched++
      } catch (err: any) {
        console.warn(`[backfill-ctwa] falhou para lead=${lead.id}:`, err.message)
      }
    }

    console.log(`[backfill-ctwa] concluído — ${enriched} leads reconciliados`)
  } catch (err: any) {
    console.error("[backfill-ctwa] erro geral, tenta de novo no próximo restart:", err.message)
    return
  }

  await prisma
    .$executeRawUnsafe(`INSERT INTO system_flags (key) VALUES ($1) ON CONFLICT DO NOTHING`, FLAG)
    .catch(() => null)
  console.log("[backfill-ctwa] marcado como concluído")
}
