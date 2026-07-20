import { prisma } from "./prisma.js"

const FLAG = "multi_org_backfill_v1"

/**
 * Restaura vínculos de organização perdidos pelo modelo antigo (1 organização
 * por usuário só). O Clerk é a fonte de verdade de quem pertence a quais
 * organizações — cruza isso com `organizations.clerk_org_id` e cria os
 * `Profile` que faltam. Roda uma única vez (marcado em `system_flags`),
 * em background, sem bloquear o startup do servidor.
 */
export async function backfillMultiOrgFromClerk() {
  const already = await prisma
    .$queryRawUnsafe<{ key: string }[]>(`SELECT key FROM system_flags WHERE key = $1`, FLAG)
    .catch(() => [] as { key: string }[])
  if (already.length > 0) return

  console.log("[backfill-multi-org] iniciando reconciliação via Clerk...")

  try {
    const { createClerkClient } = await import("@clerk/backend")
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

    const users = await prisma.profile.findMany({
      where: { clerkUserId: { not: null } },
      distinct: ["clerkUserId"],
      select: { clerkUserId: true, name: true, email: true, avatarUrl: true },
    })

    let checked = 0
    for (const u of users) {
      if (!u.clerkUserId) continue
      try {
        const memberships = await clerk.users.getOrganizationMembershipList({ userId: u.clerkUserId })
        for (const m of memberships.data) {
          const org = await prisma.organization.findUnique({
            where: { clerkOrgId: m.organization.id },
            select: { id: true },
          })
          if (!org) continue // organização do Clerk sem correspondente no nosso banco

          const role = String(m.role).toLowerCase().includes("admin") ? "admin" : "seller"

          await prisma.profile.upsert({
            where: { clerkUserId_organizationId: { clerkUserId: u.clerkUserId, organizationId: org.id } },
            update: {},
            create: {
              clerkUserId: u.clerkUserId,
              organizationId: org.id,
              role,
              name: u.name,
              email: u.email,
              avatarUrl: u.avatarUrl,
              onboardingCompleted: true,
            },
          })
          checked++
        }
      } catch (err: any) {
        console.warn(`[backfill-multi-org] falhou para clerkUserId=${u.clerkUserId}:`, err.message)
      }
    }

    console.log(`[backfill-multi-org] concluído — ${checked} vínculos verificados/criados`)
  } catch (err: any) {
    console.error("[backfill-multi-org] erro geral, tenta de novo no próximo restart:", err.message)
    return
  }

  await prisma
    .$executeRawUnsafe(`INSERT INTO system_flags (key) VALUES ($1) ON CONFLICT DO NOTHING`, FLAG)
    .catch(() => null)
  console.log("[backfill-multi-org] marcado como concluído")
}
