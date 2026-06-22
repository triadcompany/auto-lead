import "dotenv/config"
import Fastify from "fastify"
import corsPlugin from "./plugins/cors.js"
import authPlugin from "./plugins/auth.js"
import socketPlugin from "./plugins/socket.js"
import pipelinesRoutes from "./routes/pipelines.js"
import leadsRoutes from "./routes/leads.js"

const server = Fastify({ logger: true })

await server.register(corsPlugin)
await server.register(authPlugin)
await server.register(socketPlugin)

server.get("/health", async () => ({ status: "ok" }))

await server.register(pipelinesRoutes)
await server.register(leadsRoutes)

const port = Number(process.env.PORT) || 3000

try {
  await server.listen({ port, host: "0.0.0.0" })
  console.log(`API rodando em http://localhost:${port}`)
} catch (err) {
  server.log.error(err)
  process.exit(1)
}
