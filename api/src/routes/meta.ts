import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"
import { emit } from "../plugins/socket.js"
import { createHmac, createHash } from "crypto"

// ── Helpers ────────────────────────────────────────────────────────────────

async function hashSHA256(value: string): Promise<string> {
  return createHash("sha256").update(value).digest("hex")
}

function verifyHmac(body: string, signature: string, secret: string): boolean {
  const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex")
  return signature === expected
}

async function graphFetch(path: string, token: string, opts: RequestInit = {}) {
  return fetch(`https://graph.facebook.com/v19.0${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  })
}

// ── Routes ─────────────────────────────────────────────────────────────────

export default async function metaRoutes(fastify: FastifyInstance) {
  // ── OAuth callback (substitui meta-oauth-callback) — pública ──
  fastify.get<{
    Querystring: {
      code?: string
      state?: string
      error?: string
    }
  }>("/meta/oauth/callback", async (req, reply) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080"
    const { code, state, error: errorParam } = req.query

    if (errorParam) {
      return reply.redirect(`${frontendUrl}/settings?tab=integrations&meta=error&reason=${errorParam}`)
    }
    if (!code || !state) {
      return reply.redirect(`${frontendUrl}/settings?tab=integrations&meta=error&reason=missing_params`)
    }

    let orgId: string
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"))
      orgId = decoded.org_id
      if (!orgId) throw new Error()
    } catch {
      return reply.redirect(`${frontendUrl}/settings?tab=integrations&meta=error&reason=invalid_state`)
    }

    const appId = process.env.META_APP_ID!
    const appSecret = process.env.META_APP_SECRET!
    const redirectUri = process.env.META_REDIRECT_URI!

    // Exchange code for short-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        `client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `client_secret=${appSecret}&code=${code}`
    )
    const tokenData = (await tokenRes.json()) as any
    if (tokenData.error) {
      return reply.redirect(`${frontendUrl}/settings?tab=integrations&meta=error&reason=token_exchange`)
    }

    // Exchange for long-lived token (~60 days)
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&client_id=${appId}&` +
        `client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
    )
    const longTokenData = (await longTokenRes.json()) as any
    if (longTokenData.error) {
      return reply.redirect(`${frontendUrl}/settings?tab=integrations&meta=error&reason=long_token`)
    }

    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${longTokenData.access_token}`
    )
    const meData = (await meRes.json()) as any

    const expiresAt = longTokenData.expires_in
      ? new Date(Date.now() + longTokenData.expires_in * 1000)
      : null

    await (prisma as any).metaAccount?.upsert?.({
      where: { organizationId: orgId },
      update: {
        metaUserId: meData.id,
        metaUserName: meData.name,
        accessToken: longTokenData.access_token,
        tokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      },
      create: {
        organizationId: orgId,
        metaUserId: meData.id,
        metaUserName: meData.name,
        accessToken: longTokenData.access_token,
        tokenExpiresAt: expiresAt,
      },
    }).catch(console.error)

    return reply.redirect(`${frontendUrl}/settings?tab=integrations&meta=connected`)
  })

  // ── Meta webhook verification (GET) — pública ──
  fastify.get<{
    Querystring: { "hub.mode"?: string; "hub.verify_token"?: string; "hub.challenge"?: string }
  }>("/meta/webhook", async (req, reply) => {
    const mode = req.query["hub.mode"]
    const token = req.query["hub.verify_token"]
    const challenge = req.query["hub.challenge"]
    const verifyToken = process.env.META_VERIFY_TOKEN || "meta_webhook_autolead_v1"

    if (!mode && !token && !challenge) return { ok: true }

    if (mode === "subscribe" && token === verifyToken) {
      return reply.send(challenge)
    }
    return reply.code(403).send("Forbidden")
  })

  // ── Meta webhook events (POST) — pública ──
  fastify.post<{ Body: Record<string, unknown> }>("/meta/webhook", async (req) => {
    const body = req.body as any

    for (const entry of body.entry || []) {
      const pageId = entry.id as string
      if (!pageId) continue

      const connection = await (prisma as any).instagramConnection?.findFirst?.({
        where: { pageId },
      }).catch(() => null)

      if (!connection) continue
      const orgId = connection.organizationId

      for (const msg of entry.messaging || []) {
        emit(orgId, "message:received", { source: "instagram", page_id: pageId, message: msg })
      }
    }

    return "EVENT_RECEIVED"
  })

  // ── Ingest Meta lead via n8n (POST) — pública, HMAC-signed ──
  fastify.post<{
    Body: { integration_id: string; lead_data: Record<string, unknown> }
  }>("/meta/leads/ingest", async (req, reply) => {
    const secret = process.env.N8N_INGEST_SECRET
    if (secret) {
      const sig = req.headers["x-n8n-signature"] as string | undefined
      const rawBody = JSON.stringify(req.body)
      if (!sig || !verifyHmac(rawBody, sig, secret)) {
        return reply.code(401).send({ error: "Invalid signature" })
      }
    }

    const { integration_id, lead_data } = req.body
    if (!integration_id || !lead_data) {
      return reply.code(400).send({ error: "Missing integration_id or lead_data" })
    }

    const integration = await (prisma as any).metaIntegration?.findFirst?.({
      where: { id: integration_id, status: "active" },
      include: { metaAccount: true },
    }).catch(() => null)

    if (!integration) return reply.code(404).send({ error: "Integration not found or inactive" })

    const orgId = integration.metaAccount?.organizationId || integration.organizationId
    const fieldMapping: Record<string, string> = integration.fieldMapping || {}

    const mapped: Record<string, unknown> = {}
    for (const [metaField, crmField] of Object.entries(fieldMapping)) {
      if (lead_data[metaField] !== undefined) mapped[crmField] = lead_data[metaField]
    }

    // Fallback seller: first profile in org
    let sellerId = integration.sellerId
    if (!sellerId) {
      const profile = await prisma.profile.findFirst({ where: { organizationId: orgId } })
      sellerId = profile?.id || null
    }
    if (!sellerId) return reply.code(400).send({ error: "No sellers found for organization" })

    const lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        stageId: integration.stageId,
        sellerId,
        createdBy: sellerId,
        source: "meta_lead_ads",
        name: (mapped.name || lead_data.full_name || lead_data.name || "Lead Meta") as string,
        phone: (mapped.phone || lead_data.phone_number || lead_data.phone || "") as string,
        email: (mapped.email || lead_data.email || null) as string | null,
        interest: (mapped.interest || null) as string | null,
        observations: (mapped.observations || null) as string | null,
      },
    })

    await (prisma as any).metaIntegration?.update?.({
      where: { id: integration_id },
      data: { lastLeadAt: new Date() },
    }).catch(() => null)

    emit(orgId, "lead:created", { lead, source: "meta_lead_ads" })

    return reply.code(201).send({ success: true, lead_id: lead.id })
  })

  // ── Graph proxy — lista pages e formulários (substitui meta-graph-proxy) ──
  fastify.get<{
    Querystring: { action: string; page_id?: string; form_id?: string }
  }>("/meta/graph", async (req, reply) => {
    const account = await (prisma as any).metaAccount?.findFirst?.({
      where: { ...orgScope(req) },
    }).catch(() => null)

    if (!account) return reply.code(404).send({ error: "Meta account not connected" })
    const token = account.accessToken

    const { action, page_id, form_id } = req.query

    if (action === "pages") {
      const res = await graphFetch(`/me/accounts?fields=id,name,access_token&access_token=${token}`, token)
      const data = (await res.json()) as any
      if (data.error) return reply.code(400).send({ error: data.error.message })
      return { pages: data.data || [] }
    }

    if (action === "forms") {
      if (!page_id) return reply.code(400).send({ error: "Missing page_id" })
      const pageRes = await graphFetch(`/${page_id}?fields=access_token&access_token=${token}`, token)
      const pageData = (await pageRes.json()) as any
      const pageToken = pageData.access_token || token
      const formsRes = await graphFetch(
        `/${page_id}/leadgen_forms?fields=id,name,status&access_token=${pageToken}`,
        token
      )
      const formsData = (await formsRes.json()) as any
      if (formsData.error) return reply.code(400).send({ error: formsData.error.message })
      return { forms: formsData.data || [] }
    }

    if (action === "form_fields") {
      if (!form_id) return reply.code(400).send({ error: "Missing form_id" })
      const res = await graphFetch(`/${form_id}?fields=questions&access_token=${token}`, token)
      const data = (await res.json()) as any
      if (data.error) return reply.code(400).send({ error: data.error.message })
      return {
        fields: (data.questions || []).map((q: any) => ({
          key: q.key || q.type,
          label: q.label || q.type,
          type: q.type,
        })),
      }
    }

    return reply.code(400).send({ error: `Unknown action: ${action}` })
  })

  // ── Conversions API — envia evento para o pixel (substitui send-meta-event) ──
  fastify.post<{
    Body: {
      lead_id: string
      event_name: "Lead" | "Lead_Super_Qualificado" | "Lead_Veio_Loja" | "Purchase"
      stage_name?: string
    }
  }>("/meta/events", async (req, reply) => {
    const { lead_id, event_name, stage_name } = req.body

    const lead = await prisma.lead.findFirst({
      where: { id: lead_id, ...orgScope(req) },
    })
    if (!lead) return reply.code(404).send({ error: "Lead not found" })

    const integration = await (prisma as any).metaIntegration?.findFirst?.({
      where: { organizationId: req.auth.orgId, isActive: true },
    }).catch(() => null)

    if (!integration) return { ok: false, message: "Meta integration not configured" }

    const eventEnabledMap: Record<string, boolean> = {
      Lead: integration.trackLeadQualificado,
      Lead_Super_Qualificado: integration.trackLeadSuperQualificado,
      Purchase: integration.trackLeadComprou,
      Lead_Veio_Loja: integration.trackLeadVeioLoja,
    }
    if (!eventEnabledMap[event_name]) return { ok: false, message: "Event disabled" }

    const userData: Record<string, unknown> = {}
    if (lead.email) userData.em = [await hashSHA256(lead.email.toLowerCase().trim())]
    if (lead.phone) userData.ph = [await hashSHA256(lead.phone.replace(/\D/g, ""))]
    if (lead.name) {
      const parts = lead.name.trim().split(" ")
      userData.fn = [await hashSHA256(parts[0].toLowerCase())]
      if (parts.length > 1) userData.ln = [await hashSHA256(parts[parts.length - 1].toLowerCase())]
    }

    const customData: Record<string, unknown> = { currency: "BRL", content_category: "Automotive" }
    if (event_name === "Purchase" && (lead as any).valorNegocio) {
      customData.value = Number((lead as any).valorNegocio)
    }
    if (lead.interest) customData.content_name = lead.interest
    if (lead.source) customData.lead_source = lead.source
    if (stage_name) customData.lead_stage = stage_name

    const eventId = `${lead_id}_${event_name}_${Date.now()}`
    const payload: Record<string, unknown> = {
      data: [
        {
          event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: "other",
          user_data: userData,
          custom_data: customData,
        },
      ],
    }
    if (integration.testMode) payload.test_event_code = "TEST12345"

    const metaRes = await fetch(
      `https://graph.facebook.com/v18.0/${integration.pixelId}/events?access_token=${integration.accessToken}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    )
    const metaResult = (await metaRes.json()) as any

    await (prisma as any).metaEventsLog?.create?.({
      data: {
        organizationId: req.auth.orgId,
        leadId: lead_id,
        eventName: event_name,
        eventId,
        payload,
        response: metaResult,
        success: metaRes.ok,
        errorMessage: !metaRes.ok ? JSON.stringify(metaResult) : null,
      },
    }).catch(() => null)

    if (!metaRes.ok) return reply.code(500).send({ ok: false, error: metaResult })
    return { ok: true, meta_response: metaResult }
  })

  // ── Integrations CRUD ──

  fastify.get("/meta/integrations", async (req) => {
    return (prisma as any).metaIntegration?.findMany?.({
      where: { ...orgScope(req) },
    }).catch(() => [])
  })

  fastify.post<{ Body: Record<string, unknown> }>("/meta/integrations", async (req, reply) => {
    const data = await (prisma as any).metaIntegration?.create?.({
      data: { ...req.body, organizationId: req.auth.orgId },
    }).catch((e: Error) => reply.code(500).send({ error: e.message }))
    return reply.code(201).send(data)
  })

  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/meta/integrations/:id",
    async (req, reply) => {
      const updated = await (prisma as any).metaIntegration?.updateMany?.({
        where: { id: req.params.id, ...orgScope(req) },
        data: req.body,
      }).catch(() => null)
      if (!updated?.count) return reply.code(404).send({ error: "Not found" })
      return { success: true }
    }
  )

  fastify.delete<{ Params: { id: string } }>("/meta/integrations/:id", async (req, reply) => {
    const deleted = await (prisma as any).metaIntegration?.deleteMany?.({
      where: { id: req.params.id, ...orgScope(req) },
    }).catch(() => null)
    if (!deleted?.count) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // ── CAPI Settings (GET + POST action dispatcher) ──
  fastify.get("/meta/capi-settings", async (req) => {
    const settings = await (prisma as any).metaCapiSettings?.findFirst?.({
      where: { organizationId: req.auth.orgId },
    }).catch(() => null)
    return settings || null
  })

  fastify.post<{ Body: Record<string, unknown> }>("/meta/capi-settings", async (req, reply) => {
    const body = req.body as any
    const { action, payload, organization_id } = body
    const orgId = req.auth.orgId || organization_id

    if (action === "get") {
      const settings = await (prisma as any).metaCapiSettings?.findFirst?.({
        where: { organizationId: orgId },
      }).catch(() => null)
      return settings || null
    }

    if (action === "save") {
      const data = {
        pixelId: payload?.pixel_id,
        accessToken: payload?.access_token,
        testEventCode: payload?.test_event_code || null,
        enabled: payload?.enabled ?? false,
        updatedAt: new Date(),
      }
      const existing = await (prisma as any).metaCapiSettings?.findFirst?.({
        where: { organizationId: orgId },
      }).catch(() => null)

      if (existing) {
        await (prisma as any).metaCapiSettings?.update?.({
          where: { id: existing.id },
          data,
        }).catch((e: Error) => reply.code(500).send({ ok: false, message: e.message }))
      } else {
        await (prisma as any).metaCapiSettings?.create?.({
          data: { ...data, organizationId: orgId },
        }).catch((e: Error) => reply.code(500).send({ ok: false, message: e.message }))
      }
      return { ok: true }
    }

    if (action === "test") {
      const settings = await (prisma as any).metaCapiSettings?.findFirst?.({
        where: { organizationId: orgId },
      }).catch(() => null)
      if (!settings) return reply.code(404).send({ ok: false, message: "Configuração não encontrada" })

      // Tokens CAPI são System User tokens — só têm permissão de envio, não de leitura do pixel.
      // O teste correto é enviar um evento mínimo para a Conversions API.
      const testPayload: Record<string, unknown> = {
        data: [{
          event_name: "Lead",
          event_time: Math.floor(Date.now() / 1000),
          event_id: `test_${Date.now()}`,
          action_source: "other",
          user_data: { client_user_agent: "test" },
        }],
      }
      if (settings.testEventCode) testPayload.test_event_code = settings.testEventCode

      const res = await fetch(
        `https://graph.facebook.com/v18.0/${settings.pixelId}/events?access_token=${settings.accessToken}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(testPayload) }
      )
      const data = (await res.json()) as any
      if (res.ok && (data.events_received !== undefined || data.fbtrace_id)) {
        const received = data.events_received ?? 1
        const extra = settings.testEventCode ? ` Verifique no Gerenciador de Eventos → Teste de Eventos.` : ""
        return { ok: true, message: `Conexão OK! ${received} evento(s) aceito(s) pela Meta.${extra}` }
      }
      const errMsg = data.error?.message || "Erro desconhecido"
      return reply.code(400).send({ ok: false, message: errMsg })
    }

    if (action === "queue_logs") {
      const events = await (prisma as any).metaCapiEvent?.findMany?.({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }).catch(() => [])
      return { ok: true, items: events || [] }
    }

    if (action === "check") {
      const [settings, org] = await Promise.all([
        (prisma as any).metaCapiSettings?.findFirst?.({ where: { organizationId: orgId } }).catch(() => null),
        prisma.organization.findFirst({ where: { id: orgId } }).catch(() => null),
      ])
      return {
        ok: true,
        user_id: (req as any).auth?.userId || orgId || null,
        organization_id: orgId || null,
        org_exists: !!org,
        is_admin: true,
        settings_exists: !!settings,
      }
    }

    if (action === "queue_action") {
      return { ok: true, message: "Ação registrada" }
    }

    return reply.code(400).send({ ok: false, message: `Unknown action: ${action}` })
  })

  // ── CAPI Events log ──
  fastify.get("/meta/capi-events", async (req) => {
    const events = await (prisma as any).metaCapiEvent?.findMany?.({
      where: { organizationId: req.auth.orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }).catch(() => [])
    return events || []
  })

  // ── Test connection ──
  fastify.post("/meta/test-connection", async (req, reply) => {
    const integration = await (prisma as any).metaIntegration?.findFirst?.({
      where: { organizationId: req.auth.orgId, isActive: true },
    }).catch(() => null)
    if (!integration) return reply.code(404).send({ error: "No active integration" })
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${integration.pixelId}?access_token=${integration.accessToken}&fields=id,name`
    )
    const data = await res.json() as any
    if (res.ok && data.id) return { ok: true, pixel_name: data.name || data.id }
    return reply.code(400).send({ ok: false, error: data.error?.message || "Unknown error" })
  })
}
