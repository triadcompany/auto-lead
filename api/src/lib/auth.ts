import type { FastifyRequest } from "fastify"

export const orgScope = (req: FastifyRequest) => ({
  organizationId: (req as any).auth?.orgId as string,
})

export const userId = (req: FastifyRequest): string =>
  (req as any).auth?.userId as string
