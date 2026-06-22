import fp from "fastify-plugin"
import { Server } from "socket.io"
import type { FastifyInstance } from "fastify"

let _io: Server

export function getIO(): Server {
  if (!_io) throw new Error("Socket.io not initialized")
  return _io
}

export function emit(orgId: string, event: string, payload: unknown) {
  getIO().to(`org:${orgId}`).emit(event, payload)
}

async function socketPlugin(fastify: FastifyInstance) {
  const io = new Server(fastify.server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:8080",
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) return next(new Error("Missing token"))

    try {
      const { createClerkClient } = await import("@clerk/fastify")
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
      const payload = await clerk.verifyToken(token)

      const orgId = payload.org_id as string | undefined
      if (!orgId) return next(new Error("No organization in token"))

      socket.data.orgId = orgId
      socket.data.userId = payload.sub
      next()
    } catch {
      next(new Error("Invalid token"))
    }
  })

  io.on("connection", (socket) => {
    const orgId = socket.data.orgId as string
    socket.join(`org:${orgId}`)

    socket.on("disconnect", () => {
      socket.leave(`org:${orgId}`)
    })
  })

  _io = io
  fastify.log.info("Socket.io initialized")
}

export default fp(socketPlugin, { name: "socket" })
