import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"
import { emit } from "../plugins/socket.js"

export default async function tasksRoutes(fastify: FastifyInstance) {
  // GET /tasks
  fastify.get<{
    Querystring: {
      lead_id?: string
      assigned_to?: string
      status?: string
      priority?: string
      limit?: string
      offset?: string
    }
  }>("/tasks", async (req) => {
    const { lead_id, assigned_to, status, priority, limit, offset } = req.query
    return prisma.task.findMany({
      where: {
        ...orgScope(req),
        ...(lead_id && { leadId: lead_id }),
        ...(assigned_to && { assignedTo: assigned_to }),
        ...(status && { status: status as any }),
        ...(priority && { priority: priority as any }),
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: Number(limit) || 100,
      skip: Number(offset) || 0,
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        lead: { select: { id: true, name: true } },
      },
    })
  })

  // GET /tasks/:id
  fastify.get<{ Params: { id: string } }>("/tasks/:id", async (req, reply) => {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, ...orgScope(req) },
      include: { assignee: true, lead: true },
    })
    if (!task) return reply.code(404).send({ error: "Not found" })
    return task
  })

  // POST /tasks
  fastify.post<{
    Body: {
      lead_id?: string | null
      titulo: string
      descricao?: string
      priority?: "baixa" | "media" | "alta"
      status?: "pendente" | "em_andamento" | "concluida"
      due_date?: string
      assigned_to?: string
      conversation_id?: string
    }
  }>("/tasks", async (req, reply) => {
    const task = await prisma.task.create({
      data: {
        organizationId: req.auth.orgId,
        leadId: req.body.lead_id || null,
        titulo: req.body.titulo,
        descricao: req.body.descricao || null,
        priority: (req.body.priority as any) || "media",
        status: (req.body.status as any) || "pendente",
        dueDate: req.body.due_date ? new Date(req.body.due_date) : null,
        assignedTo: req.body.assigned_to || null,
        conversationId: req.body.conversation_id || null,
        createdBy: req.auth.userId,
      },
    })
    emit(req.auth.orgId, "task:created", { task })
    return reply.code(201).send(task)
  })

  // PATCH /tasks/:id
  fastify.patch<{
    Params: { id: string }
    Body: {
      titulo?: string
      descricao?: string
      priority?: "baixa" | "media" | "alta"
      status?: "pendente" | "em_andamento" | "concluida"
      due_date?: string | null
      assigned_to?: string | null
    }
  }>("/tasks/:id", async (req, reply) => {
    const { titulo, descricao, priority, status, due_date, assigned_to } = req.body
    const updated = await prisma.task.updateMany({
      where: { id: req.params.id, ...orgScope(req) },
      data: {
        ...(titulo !== undefined && { titulo }),
        ...(descricao !== undefined && { descricao }),
        ...(priority !== undefined && { priority: priority as any }),
        ...(status !== undefined && { status: status as any }),
        ...(due_date !== undefined && { dueDate: due_date ? new Date(due_date) : null }),
        ...(assigned_to !== undefined && { assignedTo: assigned_to }),
        updatedAt: new Date(),
      },
    })
    if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
    emit(req.auth.orgId, "task:updated", { taskId: req.params.id, ...req.body })
    return { success: true }
  })

  // DELETE /tasks/:id
  fastify.delete<{ Params: { id: string } }>("/tasks/:id", async (req, reply) => {
    const deleted = await prisma.task.deleteMany({
      where: { id: req.params.id, ...orgScope(req) },
    })
    if (deleted.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })
}
