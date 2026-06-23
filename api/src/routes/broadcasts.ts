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
      return (prisma as any).campaign?.findMany?.({
        where: {
          ...orgScope(req),
          ...(req.query.status && { status: req.query.status }),
        },
        orderBy: { createdAt: "desc" },
        take: Number(req.query.limit) || 50,
      }).catch(() => [])
    }
  )

  // GET /broadcasts/:id
  fastify.get<{ Params: { id: string } }>("/broadcasts/:id", async (req, reply) => {
    const campaign = await (prisma as any).campaign?.findFirst?.({
      where: { id: req.params.id, ...orgScope(req) },
      include: { recipients: true },
    }).catch(() => null)
    if (!campaign) return reply.code(404).send({ error: "Not found" })
    return campaign
  })

  // POST /broadcasts — cria campanha
  fastify.post<{
    Body: {
      name: string
      instance_name: string
      payload_type: string
      payload: Record<string, unknown>
      buttons?: Array<{ label: string; value: string }>
      scheduled_at?: string
      delay_seconds?: number
    }
  }>("/broadcasts", async (req, reply) => {
    const { name, instance_name, payload_type, payload, buttons, scheduled_at, delay_seconds } = req.body
    const campaign = await (prisma as any).campaign?.create?.({
      data: {
        organizationId: req.auth.orgId,
        name,
        instanceName: instance_name,
        payloadType: payload_type,
        payload,
        buttons: buttons || null,
        status: "draft",
        scheduledAt: scheduled_at ? new Date(scheduled_at) : null,
        delaySeconds: delay_seconds || 5,
        createdBy: req.auth.userId,
      },
    }).catch((e: Error) => reply.code(500).send({ error: e.message }))
    return reply.code(201).send(campaign)
  })

  // PATCH /broadcasts/:id
  fastify.patch<{
    Params: { id: string }
    Body: Record<string, unknown>
  }>("/broadcasts/:id", async (req, reply) => {
    const updated = await (prisma as any).campaign?.updateMany?.({
      where: { id: req.params.id, ...orgScope(req), status: { in: ["draft", "paused"] } },
      data: { ...req.body, updatedAt: new Date() },
    }).catch(() => null)
    if (!updated?.count) return reply.code(404).send({ error: "Not found or campaign already running" })
    return { success: true }
  })

  // DELETE /broadcasts/:id
  fastify.delete<{ Params: { id: string } }>("/broadcasts/:id", async (req, reply) => {
    const deleted = await (prisma as any).campaign?.deleteMany?.({
      where: { id: req.params.id, ...orgScope(req), status: { in: ["draft", "paused", "completed", "failed"] } },
    }).catch(() => null)
    if (!deleted?.count) return reply.code(404).send({ error: "Not found or campaign is running" })
    return { success: true }
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
      variables: r.variables || {},
      status: "pending",
    }))
    const created = await (prisma as any).campaignRecipient?.createMany?.({
      data: inserts,
      skipDuplicates: true,
    }).catch((e: Error) => reply.code(500).send({ error: e.message }))
    return reply.code(201).send({ added: created?.count || 0 })
  })

  // GET /broadcasts/:id/recipients
  fastify.get<{
    Params: { id: string }
    Querystring: { status?: string; limit?: string; offset?: string }
  }>("/broadcasts/:id/recipients", async (req) => {
    return (prisma as any).campaignRecipient?.findMany?.({
      where: {
        campaignId: req.params.id,
        organizationId: req.auth.orgId,
        ...(req.query.status && { status: req.query.status }),
      },
      take: Number(req.query.limit) || 100,
      skip: Number(req.query.offset) || 0,
    }).catch(() => [])
  })

  // POST /broadcasts/:id/start — inicia envio
  fastify.post<{ Params: { id: string } }>("/broadcasts/:id/start", async (req, reply) => {
    const campaign = await (prisma as any).campaign?.findFirst?.({
      where: { id: req.params.id, ...orgScope(req), status: { in: ["draft", "paused"] } },
    }).catch(() => null)
    if (!campaign) return reply.code(404).send({ error: "Campaign not found or not startable" })

    await (prisma as any).campaign?.update?.({
      where: { id: req.params.id },
      data: { status: "running", startedAt: new Date() },
    }).catch(() => null)

    // Background: process pending recipients
    setImmediate(() => processCampaign(req.params.id, campaign).catch(console.error))

    return { started: true }
  })

  // POST /broadcasts/:id/pause
  fastify.post<{ Params: { id: string } }>("/broadcasts/:id/pause", async (req, reply) => {
    const updated = await (prisma as any).campaign?.updateMany?.({
      where: { id: req.params.id, ...orgScope(req), status: "running" },
      data: { status: "paused" },
    }).catch(() => null)
    if (!updated?.count) return reply.code(404).send({ error: "Campaign not running" })
    return { paused: true }
  })

  // POST /broadcasts/upload-media — faz upload de mídia para campanha no MinIO
  fastify.post("/broadcasts/upload-media", async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: "Nenhum arquivo enviado" })

    const { uploadFile } = await import("../services/storage.js")
    const buffer = await data.toBuffer()
    const ext = data.filename.split(".").pop() || "bin"
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
    // Check if still running
    const current = await (prisma as any).campaign?.findFirst?.({
      where: { id: campaignId, status: "running" },
    }).catch(() => null)
    if (!current) break

    // Get next pending recipient
    const recipient = await (prisma as any).campaignRecipient?.findFirst?.({
      where: { campaignId, status: "pending" },
      orderBy: { createdAt: "asc" },
    }).catch(() => null)

    if (!recipient) {
      // All done
      await (prisma as any).campaign?.update?.({
        where: { id: campaignId },
        data: { status: "completed", completedAt: new Date() },
      }).catch(() => null)
      break
    }

    // Mark as sending
    await (prisma as any).campaignRecipient?.update?.({
      where: { id: recipient.id },
      data: { status: "sending" },
    }).catch(() => null)

    try {
      const phone = recipient.phone.replace(/\D/g, "")
      const payload = campaign.payload as Record<string, any>
      const text = renderTemplate(payload.text || "", recipient)

      const sendUrl = `/message/sendText/${campaign.instanceName}`
      const res = await evolutionFetch(sendUrl, { number: phone, text }, apiKey, baseUrl)
      const ok = res.ok

      await (prisma as any).campaignRecipient?.update?.({
        where: { id: recipient.id },
        data: {
          status: ok ? "sent" : "failed",
          sentAt: ok ? new Date() : null,
          errorMessage: ok ? null : `HTTP ${res.status}`,
        },
      }).catch(() => null)
    } catch (err: any) {
      await (prisma as any).campaignRecipient?.update?.({
        where: { id: recipient.id },
        data: { status: "failed", errorMessage: err.message },
      }).catch(() => null)
    }

    await new Promise((r) => setTimeout(r, delayMs))
  }
}

function renderTemplate(template: string, recipient: { name?: string; variables?: Record<string, unknown> }) {
  let text = template.replace(/\{\{nome\}\}/gi, recipient.name || "")
  for (const [k, v] of Object.entries(recipient.variables || {})) {
    text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, "gi"), String(v ?? ""))
  }
  return text
}
