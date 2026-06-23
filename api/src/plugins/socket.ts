import fp from "fastify-plugin"
import { Server } from "socket.io"
import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"

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
      const { verifyToken } = await import("@clerk/backend")
      const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })

      const clerkUserId = payload.sub
      const profile = await prisma.profile.findFirst({
        where: { clerkUserId },
        select: { id: true, organizationId: true },
      })

      if (!profile?.organizationId) return next(new Error("No organization found for user"))

      socket.data.orgId = profile.organizationId
      socket.data.userId = clerkUserId
      socket.data.profileId = profile.id
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
