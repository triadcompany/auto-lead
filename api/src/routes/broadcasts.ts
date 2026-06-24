import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"

async function evolutionFetch(path: string, body: unknown, apiKey: string, baseUrl: string) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(body),
  })
}

export default async function broadcastsRoutes(fastify: FastifyInstance) {
  // GET /broadcasts — lista campanhas
  fastify.get<{ Querystring: { status?: string; limit?: string } }>(
    "/broadcasts",
    async (req) => {
      try {
        return await prisma.broadcastCampaign.findMany({
          where: {
            ...orgScope(req),
            ...(req.query.status && { status: req.query.status }),
          },
          orderBy: { createdAt: "desc" },
          take: Number(req.query.limit) || 50,
        })
      } catch {
        return []
      }
    }
  )

  // GET /broadcasts/:id
  fastify.get<{ Params: { id: string } }>("/broadcasts/:id", async (req, reply) => {
    try {
      const campaign = await prisma.broadcastCampaign.findFirst({
        where: { id: req.params.id, ...orgScope(req) },
        include: { recipients: true },
      })
      if (!campaign) return reply.code(404).send({ error: "Not found" })
      return campaign
    } catch {
      return reply.code(404).send({ error: "Not found" })
    }
  })

  // POST /broadcasts — cria campanha
  fastify.post<{
    Body: {
      name: string
      instance_name: string
      payload_type: string
      payload: Record<string, unknown>
      buttons?: Array<{ label: string; value: string }>
      settings?: Record<string, unknown>
      scheduled_at?: string
      delay_seconds?: number
      enable_automation?: boolean
      automation_id?: string
      response_window_hours?: number
      source_type?: string
      source_filters?: Record<string, unknown>
      profileId?: string
    }
  }>("/broadcasts", async (req, reply) => {
    const {
      name, instance_name, payload_type, payload, buttons, settings,
      scheduled_at, delay_seconds, enable_automation, automation_id,
      response_window_hours, source_type, source_filters,
    } = req.body
    try {
      const campaign = await prisma.broadcastCampaign.create({
        data: {
          organizationId: req.auth.orgId,
          name,
          instanceName: instance_name || "",
          payloadType: payload_type || "text",
          payload: (payload || {}) as any,
          buttons: (buttons || null) as any,
          settings: (settings || null) as any,
          status: "draft",
          scheduledAt: scheduled_at ? new Date(scheduled_at) : null,
          delaySeconds: delay_seconds || 5,
          createdBy: req.auth.profileId || null,
          enableAutomation: enable_automation || false,
          automationId: automation_id || null,
          responseWindowHours: response_window_hours || 24,
          sourceType: source_type || null,
          sourceFilters: (source_filters || null) as any,
        },
      })
      return reply.code(201).send(campaign)
    } catch (e: any) {
      fastify.log.error({ err: e }, "POST /broadcasts failed")
      return reply.code(500).send({ error: e.message })
    }
  })

  // PATCH /broadcasts/:id
  fastify.patch<{
    Params: { id: string }
    Body: Record<string, unknown>
  }>("/broadcasts/:id", async (req, reply) => {
    try {
      const updated = await prisma.broadcastCampaign.updateMany({
        where: { id: req.params.id, ...orgScope(req), status: { in: ["draft", "paused"] } },
        data: { ...req.body as any, updatedAt: new Date() },
      })
      if (!updated.count) return reply.code(404).send({ error: "Not found or campaign already running" })
      return { success: true }
    } catch {
      return reply.code(404).send({ error: "Not found or campaign already running" })
    }
  })

  // DELETE /broadcasts/:id
  fastify.delete<{ Params: { id: string } }>("/broadcasts/:id", async (req, reply) => {
    try {
      const deleted = await prisma.broadcastCampaign.deleteMany({
        where: { id: req.params.id, ...orgScope(req), status: { in: ["draft", "paused", "completed", "failed"] } },
      })
      if (!deleted.count) return reply.code(404).send({ error: "Not found or campaign is running" })
      return { success: true }
    } catch {
      return reply.code(404).send({ error: "Not found or campaign is running" })
    }
  })

  // POST /broadcasts/:id/recipients — adiciona destinatários
  fastify.post<{
    Params: { id: string }
    Body: { recipients: Array<{ phone: string; name?: string; variables?: Record<string, unknown> }> }
  }>("/broadcasts/:id/recipients", async (req, reply) => {
    const inserts = req.body.recipients.map((r) => ({
      campaignId: req.params.id,
      organizationId: req.auth.orgId,
      phone: r.phone,
      name: r.name || null,
      variables: (r.variables || {}) as any,
      status: "pending",
    }))
    try {
      const created = await prisma.broadcastRecipient.createMany({
        data: inserts,
        skipDuplicates: true,
      })
      await prisma.broadcastCampaign.update({
        where: { id: req.params.id },
        data: { totalRecipients: inserts.length, updatedAt: new Date() },
      })
      return reply.code(201).send({ added: created.count || 0 })
    } catch (e: any) {
      fastify.log.error({ err: e }, "POST /broadcasts/:id/recipients failed")
      return reply.code(500).send({ error: e.message })
    }
  })

  // GET /broadcasts/:id/recipients
  fastify.get<{
    Params: { id: string }
    Querystring: { status?: string; limit?: string; offset?: string }
  }>("/broadcasts/:id/recipients", async (req) => {
    try {
      return await prisma.broadcastRecipient.findMany({
        where: {
          campaignId: req.params.id,
          organizationId: req.auth.orgId,
          ...(req.query.status && { status: req.query.status }),
        },
        take: Number(req.query.limit) || 100,
        skip: Number(req.query.offset) || 0,
      })
    } catch {
      return []
    }
  })

  // POST /broadcasts/:id/start — inicia envio
  fastify.post<{ Params: { id: string } }>("/broadcasts/:id/start", async (req, reply) => {
    try {
      const campaign = await prisma.broadcastCampaign.findFirst({
        where: { id: req.params.id, ...orgScope(req), status: { in: ["draft", "paused"] } },
      })
      if (!campaign) return reply.code(404).send({ error: "Campaign not found or not startable" })

      await prisma.broadcastCampaign.update({
        where: { id: req.params.id },
        data: { status: "running", startedAt: new Date() },
      })

      setImmediate(() => processCampaign(req.params.id, campaign).catch(console.error))

      return { started: true }
    } catch (e: any) {
      return reply.code(500).send({ error: e.message })
    }
  })

  // POST /broadcasts/:id/retry — reencaminha destinatários com falha
  fastify.post<{ Params: { id: string } }>("/broadcasts/:id/retry", async (req, reply) => {
    try {
      const campaign = await prisma.broadcastCampaign.findFirst({
        where: { id: req.params.id, ...orgScope(req), status: { notIn: ["running"] } },
      })
      if (!campaign) return reply.code(404).send({ error: "Campaign not found or already running" })

      const { count } = await prisma.broadcastRecipient.updateMany({
        where: { campaignId: req.params.id, status: { in: ["failed", "skipped"] } },
        data: { status: "pending", errorMessage: null, sentAt: null },
      })
      if (count === 0) return reply.code(400).send({ error: "No failed recipients to retry" })

      await prisma.broadcastCampaign.update({
        where: { id: req.params.id },
        data: { status: "running", startedAt: new Date() },
      })

      const updated = await prisma.broadcastCampaign.findFirst({ where: { id: req.params.id } })
      setImmediate(() => processCampaign(req.params.id, updated!).catch(console.error))

      return { retrying: count }
    } catch (e: any) {
      return reply.code(500).send({ error: e.message })
    }
  })

  // POST /broadcasts/:id/cancel — cancela campanha (qualquer status não-running ou running)
  fastify.post<{ Params: { id: string } }>("/broadcasts/:id/cancel", async (req, reply) => {
    try {
      const updated = await prisma.broadcastCampaign.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data: { status: "cancelled" },
      })
      if (!updated.count) return reply.code(404).send({ error: "Campaign not found" })
      return { cancelled: true }
    } catch (e: any) {
      return reply.code(500).send({ error: e.message })
    }
  })

  // POST /broadcasts/:id/pause
  fastify.post<{ Params: { id: string } }>("/broadcasts/:id/pause", async (req, reply) => {
    try {
      const updated = await prisma.broadcastCampaign.updateMany({
        where: { id: req.params.id, ...orgScope(req), status: "running" },
        data: { status: "paused" },
      })
      if (!updated.count) return reply.code(404).send({ error: "Campaign not running" })
      return { paused: true }
    } catch {
      return reply.code(404).send({ error: "Campaign not running" })
    }
  })

  // POST /broadcasts/upload-media — faz upload de mídia para campanha no MinIO
  fastify.post("/broadcasts/upload-media", async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: "Nenhum arquivo enviado" })

    const { uploadFile } = await import("../services/storage.js")
    const buffer = await data.toBuffer()
    const key = `broadcasts/${req.auth.orgId}/${Date.now()}-${data.filename}`
    const url = await uploadFile(key, buffer, data.mimetype)

    return { url }
  })
}

// ── Background processor ──────────────────────────────────────────────────

async function processCampaign(campaignId: string, campaign: any) {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "") || ""
  const apiKey = process.env.EVOLUTION_API_KEY || ""
  const delayMs = (campaign.delaySeconds || 5) * 1000

  while (true) {
    const current = await prisma.broadcastCampaign.findFirst({
      where: { id: campaignId, status: "running" },
    }).catch(() => null)
    if (!current) break

    const recipient = await prisma.broadcastRecipient.findFirst({
      where: { campaignId, status: "pending" },
      orderBy: { createdAt: "asc" },
    }).catch(() => null)

    if (!recipient) {
      await prisma.broadcastCampaign.update({
        where: { id: campaignId },
        data: { status: "completed", completedAt: new Date() },
      }).catch(() => null)
      break
    }

    await prisma.broadcastRecipient.update({
      where: { id: recipient.id },
      data: { status: "sending" },
    }).catch(() => null)

    try {
      const phone = recipient.phone.replace(/\D/g, "")
      const payload = campaign.payload as Record<string, any>
      const payloadType: string = campaign.payloadType || "text"

      let res: Response
      if (payloadType === "text") {
        const text = renderTemplate(payload.text || "", recipient)
        res = await evolutionFetch(
          `/message/sendText/${campaign.instanceName}`,
          { number: phone, text },
          apiKey, baseUrl
        )
      } else if (payloadType === "interactive") {
        const text = renderTemplate(payload.text || "", recipient)
        const campaignButtons = (campaign.buttons as Array<{ label: string; value: string }>) || []
        if (campaignButtons.length === 0) {
          // fallback: send as plain text
          res = await evolutionFetch(
            `/message/sendText/${campaign.instanceName}`,
            { number: phone, text },
            apiKey, baseUrl
          )
        } else {
          res = await evolutionFetch(
            `/message/sendButtons/${campaign.instanceName}`,
            {
              number: phone,
              title: text.split("\n")[0] || text,
              description: text,
              footer: "",
              buttons: campaignButtons.map((b, i) => ({
                type: "reply",
                displayText: b.label,
                id: b.value || `btn_${i}`,
              })),
            },
            apiKey, baseUrl
          )
          if (!res.ok) {
            const errText = await res.text().catch(() => "")
            console.error(`[broadcasts] sendButtons failed ${res.status}:`, errText)
            // fallback: send as plain text
            res = await evolutionFetch(
              `/message/sendText/${campaign.instanceName}`,
              { number: phone, text },
              apiKey, baseUrl
            )
          }
        }
      } else if (payloadType === "image") {
        const mediaData = payload.media_url || payload.mediaUrl || ""
        const isBase64 = mediaData.startsWith("data:")
        const body: Record<string, any> = {
          number: phone,
          mediatype: "image",
          caption: renderTemplate(payload.caption || "", recipient),
        }
        if (isBase64) {
          const [header, base64] = mediaData.split(",")
          const mimetype = (header.match(/data:([^;]+)/) || [])[1] || "image/jpeg"
          body.media = base64
          body.mimetype = mimetype
          body.fileName = "imagem.jpg"
        } else {
          body.url = mediaData
        }
        res = await evolutionFetch(`/message/sendMedia/${campaign.instanceName}`, body, apiKey, baseUrl)
        if (!res.ok) {
          const errText = await res.text().catch(() => "")
          console.error(`[broadcasts] sendMedia failed ${res.status}:`, errText)
        }
      } else if (payloadType === "audio") {
        const audioData = payload.audio_url || payload.audioUrl || ""
        const isBase64 = audioData.startsWith("data:")
        const body: Record<string, any> = { number: phone }
        if (isBase64) {
          const [, base64] = audioData.split(",")
          body.audio = base64
          body.encoding = true
        } else {
          body.audio = audioData
        }
        res = await evolutionFetch(`/message/sendWhatsAppAudio/${campaign.instanceName}`, body, apiKey, baseUrl)
        if (!res.ok) {
          const errText = await res.text().catch(() => "")
          console.error(`[broadcasts] sendWhatsAppAudio failed ${res.status}:`, errText)
        }
      } else if (payloadType === "document") {
        const docData = payload.media_url || payload.mediaUrl || ""
        const isBase64 = docData.startsWith("data:")
        const body: Record<string, any> = {
          number: phone,
          mediatype: "document",
          caption: renderTemplate(payload.caption || "", recipient),
          fileName: payload.file_name || payload.fileName || "documento",
        }
        if (isBase64) {
          const [, base64] = docData.split(",")
          body.media = base64
        } else {
          body.url = docData
        }
        res = await evolutionFetch(`/message/sendMedia/${campaign.instanceName}`, body, apiKey, baseUrl)
        if (!res.ok) {
          const errText = await res.text().catch(() => "")
          console.error(`[broadcasts] sendMedia(doc) failed ${res.status}:`, errText)
        }
      } else {
        const text = renderTemplate(payload.text || "", recipient)
        res = await evolutionFetch(`/message/sendText/${campaign.instanceName}`, { number: phone, text }, apiKey, baseUrl)
      }

      const ok = res.ok

      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: {
          status: ok ? "sent" : "failed",
          sentAt: ok ? new Date() : null,
          errorMessage: ok ? null : `HTTP ${res.status}`,
        },
      }).catch(() => null)

      if (ok) {
        await prisma.broadcastCampaign.update({
          where: { id: campaignId },
          data: { sentCount: { increment: 1 } },
        }).catch(() => null)
      } else {
        await prisma.broadcastCampaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        }).catch(() => null)
      }
    } catch (err: any) {
      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: "failed", errorMessage: err.message },
      }).catch(() => null)
      await prisma.broadcastCampaign.update({
        where: { id: campaignId },
        data: { failedCount: { increment: 1 } },
      }).catch(() => null)
    }

    await new Promise((r) => setTimeout(r, delayMs))
  }
}

function renderTemplate(template: string, recipient: { name?: string | null; variables?: Record<string, unknown> | null }) {
  let text = template.replace(/\{\{nome\}\}/gi, recipient.name || "")
  for (const [k, v] of Object.entries(recipient.variables || {})) {
    text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, "gi"), String(v ?? ""))
  }
  return text
}
