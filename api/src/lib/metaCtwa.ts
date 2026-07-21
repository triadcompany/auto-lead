import { prisma } from "./prisma.js"

export async function enrichLeadFromCtwa(
  orgId: string,
  leadId: string,
  adId: string,
  opts?: {
    fbc?: string | null
    accessToken?: string | null
    clickId?: string | null
    sourceUrl?: string | null
    mediaUrl?: string | null
    thumbnailUrl?: string | null
  }
): Promise<void> {
  let token = opts?.accessToken
  if (!token) {
    const capiSettings = await prisma.metaCapiSettings
      .findFirst({ where: { organizationId: orgId }, select: { accessToken: true } })
      .catch(() => null)
    token = capiSettings?.accessToken || null
  }
  if (!token) return

  try {
    const url = `https://graph.facebook.com/v19.0/${adId}?fields=id,name,adset{id,name,campaign{id,name}}&access_token=${token}`
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
        adSourceId: adId,
        ...(opts?.fbc ? { fbc: opts.fbc } : {}),
        ...(opts?.clickId ? { ctwaClickId: opts.clickId } : {}),
        ...(opts?.sourceUrl ? { adSourceUrl: opts.sourceUrl } : {}),
        ...(opts?.mediaUrl ? { adMediaUrl: opts.mediaUrl } : {}),
        ...(opts?.thumbnailUrl ? { adThumbnailUrl: opts.thumbnailUrl } : {}),
      },
    })
  } catch (e) {
    console.error("[metaCtwa] enrichLeadFromCtwa failed:", e)
  }
}
