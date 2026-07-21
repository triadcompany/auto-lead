import fp from "fastify-plugin"
import corsPlugin from "@fastify/cors"
import type { FastifyInstance } from "fastify"

async function cors(fastify: FastifyInstance) {
  const rawOrigins = process.env.FRONTEND_URL || "http://localhost:8080"
  const allowed = rawOrigins.split(",").map((o) => o.trim()).filter(Boolean)

  await fastify.register(corsPlugin, {
    origin: (origin, cb) => {
      if (!origin || allowed.some((o) => o === origin || o === "*")) {
        cb(null, true)
      } else {
        cb(new Error("Not allowed by CORS"), false)
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-n8n-signature", "x-evolution-signature", "x-org-id"],
  })
}

export default fp(cors, { name: "cors" })
