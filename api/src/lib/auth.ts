import type { FastifyRequest, FastifyReply } from "fastify"
import { prisma } from "./prisma.js"

export type ActiveProfileResult = {
  profile: { id: string; organizationId: string; role: string } | null
  status: 401 | 403 | null
  message: string | null
}

/**
 * Um clerkUserId pode ter 1 Profile por organização (multi-org). Escolhe qual
 * é a organização ativa desta requisição, nessa prioridade:
 *   1. requestedOrgId (header X-Org-Id) — se pertencer ao usuário
 *   2. UsersProfile.lastActiveOrganizationId — última organização usada
 *   3. o profile mais antigo (fallback determinístico)
 *
 * `profile` vem null quando `status`/`message` estão preenchidos — confira
 * `profile` antes de usar o resultado.
 */
export async function resolveActiveProfile(
  clerkUserId: string,
  requestedOrgId?: string
): Promise<ActiveProfileResult> {
  const profiles = await prisma.profile.findMany({
    where: { clerkUserId, organizationId: { not: null } },
    select: { id: true, organizationId: true, role: true },
    orderBy: { createdAt: "asc" },
  })

  if (profiles.length === 0) {
    return { profile: null, status: 401, message: "No organization found for user" }
  }

  let profile = requestedOrgId ? profiles.find((p) => p.organizationId === requestedOrgId) : undefined

  if (requestedOrgId && !profile) {
    return { profile: null, status: 403, message: "Not a member of this organization" }
  }

  if (!profile) {
    const usersProfile = await prisma.usersProfile.findUnique({
      where: { clerkUserId },
      select: { lastActiveOrganizationId: true },
    })
    profile = profiles.find((p) => p.organizationId === usersProfile?.lastActiveOrganizationId)
  }

  if (!profile) profile = profiles[0]

  return { profile: profile as { id: string; organizationId: string; role: string }, status: null, message: null }
}

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
