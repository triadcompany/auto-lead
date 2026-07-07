import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"

export default async function pipelinesRoutes(fastify: FastifyInstance) {
  // GET /pipelines
  fastify.get("/pipelines", async (req) => {
    return prisma.pipeline.findMany({
      where: { ...orgScope(req) },
      include: { stages: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "asc" },
    })
  })

  // POST /pipelines/ensure-default
  fastify.post("/pipelines/ensure-default", async (req) => {
    const { orgId } = req.auth
    let pipeline = await prisma.pipeline.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
    })

    if (!pipeline) {
      pipeline = await prisma.pipeline.create({
        data: { organizationId: orgId, name: "Pipeline Principal" },
      })
      await prisma.pipelineStage.createMany({
        data: [
          { pipelineId: pipeline.id, name: "Novo Lead", position: 0 },
          { pipelineId: pipeline.id, name: "Em Contato", position: 1 },
          { pipelineId: pipeline.id, name: "Qualificado", position: 2 },
          { pipelineId: pipeline.id, name: "Proposta", position: 3 },
          { pipelineId: pipeline.id, name: "Fechado", position: 4 },
        ],
      })
    }

    return pipeline
  })

  // GET /pipelines/:id/stages
  fastify.get<{ Params: { id: string } }>("/pipelines/:id/stages", async (req) => {
    return prisma.pipelineStage.findMany({
      where: { pipelineId: req.params.id, pipeline: { organizationId: req.auth.orgId } },
      orderBy: { position: "asc" },
    })
  })

  // POST /pipelines
  fastify.post<{ Body: { name: string } }>("/pipelines", async (req, reply) => {
    const pipeline = await prisma.pipeline.create({
      data: { organizationId: req.auth.orgId, name: req.body.name },
    })
    return reply.code(201).send(pipeline)
  })

  // PATCH /pipelines/:id
  fastify.patch<{ Params: { id: string }; Body: { name?: string } }>(
    "/pipelines/:id",
    async (req, reply) => {
      const updated = await prisma.pipeline.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data: { name: req.body.name },
      })
      if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
      return { success: true }
    }
  )

  // DELETE /pipelines/:id
  fastify.delete<{ Params: { id: string } }>("/pipelines/:id", async (req, reply) => {
    const deleted = await prisma.pipeline.deleteMany({
      where: { id: req.params.id, ...orgScope(req) },
    })
    if (deleted.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // POST /pipelines/:id/stages
  fastify.post<{ Params: { id: string }; Body: { name: string; position?: number; color?: string; probability?: number; is_won?: boolean; is_lost?: boolean } }>(
    "/pipelines/:id/stages",
    async (req, reply) => {
      // Calcula próxima posição se não vier
      let position = req.body.position
      if (position === undefined) {
        const last = await prisma.pipelineStage.findFirst({
          where: { pipelineId: req.params.id }, orderBy: { position: "desc" }, select: { position: true },
        })
        position = (last?.position ?? 0) + 1
      }
      const stage = await prisma.pipelineStage.create({
        data: {
          pipelineId: req.params.id,
          name: req.body.name,
          position,
          ...(req.body.color !== undefined && { color: req.body.color }),
          ...(req.body.probability !== undefined && { probability: req.body.probability }),
          ...(req.body.is_won !== undefined && { isWon: req.body.is_won }),
          ...(req.body.is_lost !== undefined && { isLost: req.body.is_lost }),
        },
      })
      return reply.code(201).send(stage)
    }
  )

  // PATCH /pipelines/:pipelineId/stages/:stageId
  fastify.patch<{
    Params: { pipelineId: string; stageId: string }
    Body: { name?: string; position?: number; color?: string; probability?: number; is_won?: boolean; is_lost?: boolean }
  }>("/pipelines/:pipelineId/stages/:stageId", async (req, reply) => {
    const b = req.body
    const updated = await prisma.pipelineStage.updateMany({
      where: {
        id: req.params.stageId,
        pipelineId: req.params.pipelineId,
        pipeline: { organizationId: req.auth.orgId },
      },
      data: {
        ...(b.name !== undefined && { name: b.name }),
        ...(b.position !== undefined && { position: b.position }),
        ...(b.color !== undefined && { color: b.color }),
        ...(b.probability !== undefined && { probability: b.probability }),
        ...(b.is_won !== undefined && { isWon: b.is_won }),
        ...(b.is_lost !== undefined && { isLost: b.is_lost }),
      },
    })
    if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // DELETE /pipelines/:pipelineId/stages/:stageId
  fastify.delete<{ Params: { pipelineId: string; stageId: string } }>(
    "/pipelines/:pipelineId/stages/:stageId",
    async (req, reply) => {
      const deleted = await prisma.pipelineStage.deleteMany({
        where: {
          id: req.params.stageId,
          pipelineId: req.params.pipelineId,
          pipeline: { organizationId: req.auth.orgId },
        },
      })
      if (deleted.count === 0) return reply.code(404).send({ error: "Not found" })
      return { success: true }
    }
  )

  // GET /pipelines/:id/permissions — lista profile_ids com acesso
  fastify.get<{ Params: { id: string } }>("/pipelines/:id/permissions", async (req, reply) => {
    const pipeline = await prisma.pipeline.findFirst({
      where: { id: req.params.id, ...orgScope(req) },
    })
    if (!pipeline) return reply.code(404).send({ error: "Not found" })

    const perms = await prisma.pipelinePermission.findMany({
      where: { pipelineId: req.params.id },
      select: { profileId: true },
    })
    return perms.map((p) => p.profileId)
  })

  // PUT /pipelines/:id/permissions — substitui lista de profile_ids com acesso
  fastify.put<{ Params: { id: string }; Body: { profile_ids: string[] } }>(
    "/pipelines/:id/permissions",
    async (req, reply) => {
      const pipeline = await prisma.pipeline.findFirst({
        where: { id: req.params.id, ...orgScope(req) },
      })
      if (!pipeline) return reply.code(404).send({ error: "Not found" })

      const { profile_ids } = req.body

      await prisma.$transaction([
        prisma.pipelinePermission.deleteMany({ where: { pipelineId: req.params.id } }),
        ...(profile_ids.length > 0
          ? [
              prisma.pipelinePermission.createMany({
                data: profile_ids.map((profileId) => ({
                  pipelineId: req.params.id,
                  profileId,
                  createdBy: req.auth.profileId,
                })),
                skipDuplicates: true,
              }),
            ]
          : []),
      ])

      return { success: true }
    }
  )
}
