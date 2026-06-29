export type PlanName = "start" | "scale"
export type BillingCycle = "monthly" | "quarterly" | "semiannual"

export const PLANS = {
  start: {
    pipelines: 2,
    users: 3,
    automations_limit: 2,
    broadcasts: false,
    ai: false,
    meta_ads: false,
    reports_advanced: false,
  },
  scale: {
    pipelines: Infinity,
    users: Infinity,
    automations_limit: Infinity,
    broadcasts: true,
    ai: true,
    meta_ads: true,
    reports_advanced: true,
  },
} as const

export type PlanFeatureKey = keyof typeof PLANS.scale

export function getPriceId(plan: PlanName, cycle: BillingCycle): string {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`
  const priceId = process.env[key]
  if (!priceId) throw new Error(`Missing env var: ${key}`)
  return priceId
}

export function getPlanConfig(plan: PlanName) {
  return PLANS[plan] ?? PLANS.start
}

export const PLAN_PRICES_DISPLAY = {
  start: { monthly: 197, quarterly: 177, quarterly_total: 531, semiannual: 157, semiannual_total: 942 },
  scale: { monthly: 397, quarterly: 357, quarterly_total: 1071, semiannual: 317, semiannual_total: 1902 },
}
