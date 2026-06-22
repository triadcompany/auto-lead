import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope } from "../lib/auth.js"

export default async function miscRoutes(fastify: FastifyInstance) {
  // GET /cnpj/:cnpj — consulta dados de empresa via BrasilAPI (substitui cnpj-lookup)
  fastify.get<{ Params: { cnpj: string } }>("/cnpj/:cnpj", async (req, reply) => {
    const clean = req.params.cnpj.replace(/\D/g, "")
    if (clean.length !== 14) return reply.code(400).send({ error: "CNPJ deve ter 14 dígitos" })

    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`)
    if (!res.ok) {
      if (res.status === 404) return reply.code(404).send({ error: "CNPJ não encontrado" })
      return reply.code(502).send({ error: "Erro ao consultar CNPJ" })
    }
    const data = (await res.json()) as any
    return {
      cnpj: clean,
      company_name: data.razao_social || "",
      trade_name: data.nome_fantasia || "",
      owner_name: data.qsa?.[0]?.nome_socio || "",
      status: data.descricao_situacao_cadastral || "",
      main_activity: data.cnae_fiscal_descricao || "",
      address: [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(", "),
      city: data.municipio || "",
      state: data.uf || "",
      raw: data,
    }
  })

  // GET /vehicles — lista veículos da org
  fastify.get<{ Querystring: { status?: string; limit?: string; offset?: string } }>(
    "/vehicles",
    async (req) => {
      return prisma.vehicle.findMany({
        where: {
          ...orgScope(req),
          ...(req.query.status && { status: req.query.status }),
        },
        orderBy: { createdAt: "desc" },
        take: Number(req.query.limit) || 100,
        skip: Number(req.query.offset) || 0,
      })
    }
  )

  // POST /vehicles
  fastify.post<{
    Body: {
      brand: string
      model: string
      year: number
      fuel_type?: string
      transmission?: string
      mileage?: number
      color?: string
      price?: number
      description?: string
      images?: string[]
    }
  }>("/vehicles", async (req, reply) => {
    const vehicle = await prisma.vehicle.create({
      data: {
        organizationId: req.auth.orgId,
        brand: req.body.brand,
        model: req.body.model,
        year: req.body.year,
        fuelType: req.body.fuel_type || null,
        transmission: req.body.transmission || null,
        mileage: req.body.mileage || null,
        color: req.body.color || null,
        price: req.body.price || null,
        description: req.body.description || null,
        images: req.body.images || [],
        createdBy: req.auth.userId,
      },
    })
    return reply.code(201).send(vehicle)
  })

  // PATCH /vehicles/:id
  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/vehicles/:id",
    async (req, reply) => {
      const { fuel_type, ...rest } = req.body as any
      const updated = await prisma.vehicle.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data: { ...rest, ...(fuel_type !== undefined && { fuelType: fuel_type }), updatedAt: new Date() },
      })
      if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
      return { success: true }
    }
  )

  // DELETE /vehicles/:id
  fastify.delete<{ Params: { id: string } }>("/vehicles/:id", async (req, reply) => {
    const deleted = await prisma.vehicle.deleteMany({
      where: { id: req.params.id, ...orgScope(req) },
    })
    if (deleted.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // GET /lead-sources — lista fontes de leads
  fastify.get("/lead-sources", async (req) => {
    return prisma.leadSource.findMany({
      where: { ...orgScope(req) },
      orderBy: { name: "asc" },
    })
  })

  // POST /lead-sources
  fastify.post<{ Body: { name: string } }>("/lead-sources", async (req, reply) => {
    const source = await prisma.leadSource.create({
      data: { organizationId: req.auth.orgId, name: req.body.name },
    })
    return reply.code(201).send(source)
  })

  // GET /prospects — lista prospects
  fastify.get<{ Querystring: { status?: string; limit?: string } }>("/prospects", async (req) => {
    return prisma.prospect.findMany({
      where: {
        ...orgScope(req),
        ...(req.query.status && { status: req.query.status }),
      },
      orderBy: { createdAt: "desc" },
      take: Number(req.query.limit) || 100,
    })
  })

  // POST /prospects
  fastify.post<{
    Body: { name: string; phone?: string; email?: string; source?: string; notes?: string }
  }>("/prospects", async (req, reply) => {
    const prospect = await prisma.prospect.create({
      data: {
        organizationId: req.auth.orgId,
        name: req.body.name,
        phone: req.body.phone || null,
        email: req.body.email || null,
        source: req.body.source || null,
        notes: req.body.notes || null,
        createdBy: req.auth.userId,
      },
    })
    return reply.code(201).send(prospect)
  })
}
