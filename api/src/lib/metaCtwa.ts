import { prisma } from "./prisma.js"

export async function enrichLeadFromCtwa(
  orgId: string,
  leadId: string,
  ctwaAdId: string,
  ctwaClid?: string | null
): Promise<void> {
  const capiSettings = await prisma.metaCapiSettings
    .findFirst({ where: { organizationId: orgId }, select: { accessToken: true } })
    .catch(() => null)

  if (!capiSettings?.accessToken) return

  try {
    const url = `https://graph.facebook.com/v19.0/${ctwaAdId}?fields=id,name,adset{id,name,campaign{id,name}}&access_token=${capiSettings.accessToken}`
    const res = await fetch(url)
    const data = (await res.json()) as any
    if (!data?.id) return

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        metaAdId: data.id,
        metaAdName: data.name || null,
        metaAdsetId: data.adset?.id || null,
        metaAdsetName: data.adset?.name || null,
        metaCampaignId: data.adset?.campaign?.id || null,
        metaCampaignName: data.adset?.campaign?.name || null,
        ...(ctwaClid ? { fbc: ctwaClid } : {}),
      },
    })
  } catch (e) {
    console.error("[metaCtwa] enrichLeadFromCtwa failed:", e)
  }
}
