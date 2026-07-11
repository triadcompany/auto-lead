import "dotenv/config"
import Fastify from "fastify"
import multipart from "@fastify/multipart"
import corsPlugin from "./plugins/cors.js"
import authPlugin from "./plugins/auth.js"
import socketPlugin from "./plugins/socket.js"
import { prisma } from "./lib/prisma.js"
import pipelinesRoutes from "./routes/pipelines.js"
import leadsRoutes from "./routes/leads.js"
import usersRoutes from "./routes/users.js"
import organizationsRoutes from "./routes/organizations.js"
import whatsappRoutes from "./routes/whatsapp.js"
import instagramRoutes from "./routes/instagram.js"
import metaRoutes from "./routes/meta.js"
import automationsRoutes from "./routes/automations.js"
import broadcastsRoutes from "./routes/broadcasts.js"
import billingRoutes from "./routes/billing.js"
import conversationsRoutes from "./routes/conversations.js"
import tasksRoutes from "./routes/tasks.js"
import aiRoutes from "./routes/ai.js"
import miscRoutes from "./routes/misc.js"
import authRoutes from "./routes/auth.js"
import followupsRoutes from "./routes/followups.js"
import adminRoutes from "./routes/admin.js"
import reportsRoutes from "./routes/reports.js"

const server = Fastify({
  logger: true,
  bodyLimit: 5 * 1024 * 1024, // 5MB global — permite uploads de áudio em base64
})

await server.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })
await server.register(corsPlugin)
await server.register(authPlugin)
await server.register(socketPlugin)

server.get("/health", async () => ({ status: "ok" }))

await server.register(pipelinesRoutes)
await server.register(leadsRoutes)
await server.register(usersRoutes)
await server.register(organizationsRoutes)
await server.register(whatsappRoutes)
await server.register(instagramRoutes)
await server.register(metaRoutes)
await server.register(automationsRoutes)
await server.register(broadcastsRoutes)
await server.register(billingRoutes)
await server.register(conversationsRoutes)
await server.register(tasksRoutes)
await server.register(aiRoutes)
await server.register(miscRoutes)
await server.register(authRoutes)
await server.register(followupsRoutes)
await server.register(adminRoutes)
await server.register(reportsRoutes)

// Migrations automáticas no startup
async function runMigrations() {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE tasks ALTER COLUMN lead_id DROP NOT NULL
    `)
    console.log("[migration] tasks.lead_id agora é nullable")
  } catch (err: any) {
    // Erro esperado se a coluna já é nullable — ignora
    if (!err.message?.includes("already")) {
      console.warn("[migration] tasks.lead_id:", err.message)
    }
  }

  // Migrations idempotentes para as novas features (forecast, scoring, timeline, SLA, metas)
  const statements = [
    `ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS probability INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS is_won BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS is_lost BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT`,
    `CREATE TABLE IF NOT EXISTS lead_activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      lead_id UUID NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata JSONB,
      performed_by UUID,
      performed_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_lead_activities_org_lead ON lead_activities (organization_id, lead_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS sales_goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      profile_id UUID,
      period TEXT NOT NULL,
      target_value DOUBLE PRECISION NOT NULL DEFAULT 0,
      target_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_goals_org_profile_period ON sales_goals (organization_id, COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid), period)`,
    `CREATE TABLE IF NOT EXISTS automation_run_steps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id UUID NOT NULL,
      node_id TEXT NOT NULL,
      node_type TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      input_data JSONB,
      output_data JSONB,
      error_message TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_automation_run_steps_run ON automation_run_steps (run_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS meta_capi_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      lead_id UUID,
      pipeline_id UUID,
      stage_id UUID,
      meta_event TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      http_status INTEGER,
      request_json JSONB,
      response_json JSONB,
      fail_reason TEXT,
      trace_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_meta_capi_logs_org ON meta_capi_logs (organization_id, created_at)`,
  ]
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql)
    } catch (err: any) {
      console.warn("[migration] falhou:", sql.slice(0, 60), "-", err.message)
    }
  }
  console.log("[migration] features (forecast/scoring/timeline/metas) aplicadas")
}

const port = Number(process.env.PORT) || 3000

// Worker de recuperação de automações: retoma runs pausados (delays/timeouts)
// cujo prazo já venceu. Sobrevive a restarts/deploys — os setTimeout em memória não.
async function startAutomationRecovery() {
  const { resumePausedRuns } = await import("./lib/automationRunner.js")
  const tick = () => resumePausedRuns().catch((e) => console.error("[automation] recovery tick error:", e))
  await tick() // roda uma vez no startup
  setInterval(tick, 60_000) // e a cada 60s
}

try {
  await runMigrations()
  await server.listen({ port, host: "0.0.0.0" })
  console.log(`API rodando em http://localhost:${port}`)
  startAutomationRecovery().catch((e) => console.error("[automation] recovery init error:", e))
} catch (err) {
  server.log.error(err)
  process.exit(1)
}
