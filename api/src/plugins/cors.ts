import fp from "fastify-plugin"
import corsPlugin from "@fastify/cors"
import type { FastifyInstance } from "fastify"

async function cors(fastify: FastifyInstance) {
  await fastify.register(corsPlugin, {
    origin: process.env.FRONTEND_URL || "http://localhost:8080",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-n8n-signature", "x-evolution-signature"],
  })
}

export default fp(cors, { name: "cors" })
