import type { FastifyRequest, FastifyReply } from "fastify"

export const orgScope = (req: FastifyRequest) => ({
  organizationId: (req as any).auth?.orgId as string,
})

export const userId = (req: FastifyRequest): string =>
  (req as any).auth?.userId as string

/** Retorna o profileId (UUID no banco) — use para colunas created_by/assigned_to. */
export const profileId = (req: FastifyRequest): string =>
  (req as any).auth?.profileId as string

export const isAdmin = (req: FastifyRequest): boolean =>
  (req as any).auth?.role === "admin"

/**
 * Garante que o usuário é admin da org. Retorna true se autorizado;
 * caso contrário envia 403 e retorna false — o handler deve dar `return`.
 *
 *   if (!requireAdmin(req, reply)) return
 */
export function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  if ((req as any).auth?.role !== "admin") {
    reply.code(403).send({ error: "Forbidden", message: "Apenas administradores podem executar esta ação" })
    return false
  }
  return true
}

/**
 * Valida que o :id da rota corresponde à org do usuário autenticado.
 * Previne IDOR em rotas que recebem organizationId na URL.
 */
export function requireOwnOrg(req: FastifyRequest, reply: FastifyReply, id: string): boolean {
  if (id !== (req as any).auth?.orgId) {
    reply.code(403).send({ error: "Forbidden", message: "Acesso negado a esta organização" })
    return false
  }
  return true
}
