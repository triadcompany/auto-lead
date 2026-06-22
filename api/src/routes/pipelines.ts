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
  fastify.post<{ Params: { id: string }; Body: { name: string; position: number } }>(
    "/pipelines/:id/stages",
    async (req, reply) => {
      const stage = await prisma.pipelineStage.create({
        data: {
          pipelineId: req.params.id,
          name: req.body.name,
          position: req.body.position,
        },
      })
      return reply.code(201).send(stage)
    }
  )

  // PATCH /pipelines/:pipelineId/stages/:stageId
  fastify.patch<{
    Params: { pipelineId: string; stageId: string }
    Body: { name?: string; position?: number; color?: string }
  }>("/pipelines/:pipelineId/stages/:stageId", async (req, reply) => {
    const updated = await prisma.pipelineStage.updateMany({
      where: {
        id: req.params.stageId,
        pipelineId: req.params.pipelineId,
        pipeline: { organizationId: req.auth.orgId },
      },
      data: req.body,
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
}
