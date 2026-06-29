import { prisma } from "./prisma.js"
import { PLANS, PlanName, PlanFeatureKey } from "./plans.js"

export async function getOrgPlan(orgId: string): Promise<PlanName | null> {
  const sub = await prisma.subscription.findFirst({
    where: { clerkOrganizationId: orgId },
    select: { plan: true, status: true },
  }).catch(() => null)

  if (!sub || !["active", "trialing"].includes(sub.status)) return null
  return (sub.plan as PlanName) || null
}

export async function checkFeature(orgId: string, feature: PlanFeatureKey): Promise<boolean> {
  const plan = await getOrgPlan(orgId)
  if (!plan) return false
  const value = PLANS[plan][feature]
  if (typeof value === "boolean") return value
  return (value as number) > 0
}

export async function checkAutomationLimit(
  orgId: string
): Promise<{ allowed: boolean; limit: number; current: number }> {
  const plan = await getOrgPlan(orgId)
  const limit = plan ? PLANS[plan].automations_limit : 0

  if (limit === Infinity) return { allowed: true, limit: -1, current: 0 }

  const current = await prisma.automation
    .count({ where: { organizationId: orgId, isActive: true } })
    .catch(() => 0)

  return { allowed: current < limit, limit, current }
}
