import "dotenv/config"
import Fastify from "fastify"
import multipart from "@fastify/multipart"
import corsPlugin from "./plugins/cors.js"
import authPlugin from "./plugins/auth.js"
import socketPlugin from "./plugins/socket.js"
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

const port = Number(process.env.PORT) || 3000

try {
  await server.listen({ port, host: "0.0.0.0" })
  console.log(`API rodando em http://localhost:${port}`)
} catch (err) {
  server.log.error(err)
  process.exit(1)
}
