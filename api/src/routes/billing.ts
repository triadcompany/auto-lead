import type { FastifyInstance } from "fastify"
import Stripe from "stripe"
import { prisma } from "../lib/prisma.js"
import { getPriceId, PLAN_PRICES_DISPLAY, PLANS, type PlanName, type BillingCycle } from "../lib/plans.js"

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY not set")
  return new Stripe(key, { apiVersion: "2025-08-27.basil" as any })
}

function stripeStatusToInternal(status: string): string {
  switch (status) {
    case "active": return "active"
    case "past_due": return "past_due"
    case "canceled": return "canceled"
    case "trialing": return "trialing"
    default: return "inactive"
  }
}

export default async function billingRoutes(fastify: FastifyInstance) {
  // GET /billing/subscription — status da assinatura atual (substitui check-subscription)
  fastify.get("/billing/subscription", async (req) => {
    const orgId = req.auth.orgId

    // Pega todas as subs da org ordenadas por updatedAt desc — a mais recente vence
    const subs = await prisma.subscription.findMany({
      where: { clerkOrganizationId: orgId },
      orderBy: { updatedAt: "desc" },
    }).catch(() => [] as any[])

    const trialUsed = subs.some((s: any) => s.stripeSubscriptionId?.startsWith("trial_"))

    // Prefere qualquer sub ativa/trialing; senão pega a mais recente
    const sub = subs.find((s: any) => ["active", "trialing"].includes(s.status)) ?? subs[0] ?? null

    if (!sub) {
      return { subscribed: false, plan: null, billing_cycle: null, status: null, current_period_end: null, cancel_at_period_end: false, trial_used: false }
    }

    const isTrial = sub.stripeSubscriptionId?.startsWith("trial_") ?? false

    // Auto-expira trial
    if (sub.status === "trialing" && isTrial && sub.currentPeriodEnd && new Date() > sub.currentPeriodEnd) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "inactive", updatedAt: new Date() } }).catch(() => null)
      return { subscribed: false, plan: sub.plan, billing_cycle: sub.billingCycle, status: "inactive", current_period_end: sub.currentPeriodEnd, cancel_at_period_end: false, trial_used: true, is_trial: true }
    }

    if (!["active", "trialing"].includes(sub.status)) {
      return { subscribed: false, plan: sub.plan, billing_cycle: sub.billingCycle, status: sub.status, current_period_end: sub.currentPeriodEnd, cancel_at_period_end: false, trial_used: trialUsed, is_trial: isTrial }
    }

    return {
      subscribed: true,
      plan: sub.plan,
      billing_cycle: sub.billingCycle,
      status: sub.status,
      current_period_end: sub.currentPeriodEnd,
      cancel_at_period_end: sub.cancelAtPeriodEnd,
      stripe_subscription_id: sub.stripeSubscriptionId,
      trial_used: trialUsed,
      is_trial: isTrial,
    }
  })

  // POST /billing/trial — inicia trial gratuito de 3 dias (Scale, sem cartão)
  fastify.post("/billing/trial", async (req, reply) => {
    const orgId = req.auth.orgId

    const existing = await prisma.subscription.findFirst({ where: { clerkOrganizationId: orgId } }).catch(() => null)
    if (existing) {
      return reply.code(409).send({ error: "trial_already_used", message: "Esta organização já utilizou o período de teste" })
    }

    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 3)

    await prisma.subscription.create({
      data: {
        clerkOrganizationId: orgId,
        clerkUserId: req.auth.userId,
        stripeCustomerId: `trial_${orgId}`,
        stripeSubscriptionId: `trial_${orgId}_${Date.now()}`,
        plan: "scale",
        billingCycle: "monthly",
        status: "trialing",
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEnd,
        cancelAtPeriodEnd: false,
      },
    })

    return { success: true, trial_end: trialEnd, plan: "scale", days: 3 }
  })

  // GET /billing/plans — retorna config de planos para o frontend
  fastify.get("/billing/plans", async () => {
    return {
      plans: {
        start: { features: PLANS.start, prices: PLAN_PRICES_DISPLAY.start },
        scale: { features: PLANS.scale, prices: PLAN_PRICES_DISPLAY.scale },
      },
    }
  })

  // POST /billing/checkout — cria sessão Stripe Checkout
  fastify.post<{
    Body: {
      plan: PlanName
      billing_cycle: BillingCycle
      success_url?: string
      cancel_url?: string
    }
  }>("/billing/checkout", async (req, reply) => {
    const stripe = getStripe()
    const { plan, billing_cycle, success_url, cancel_url } = req.body
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080"

    let price_id: string
    try {
      price_id = getPriceId(plan, billing_cycle)
    } catch {
      return reply.code(400).send({ error: `No price configured for ${plan}/${billing_cycle}` })
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: success_url || `${frontendUrl}/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${frontendUrl}/settings?tab=billing&canceled=true`,
      metadata: {
        clerk_organization_id: req.auth.orgId,
        clerk_user_id: req.auth.userId,
        plan,
        billing_cycle,
      },
    })

    return { checkout_url: session.url, session_id: session.id }
  })

  // POST /billing/sync — sincroniza assinatura após checkout (substitui sync-subscription-from-checkout)
  fastify.post<{ Body: { session_id: string } }>("/billing/sync", async (req, reply) => {
    const stripe = getStripe()
    const { session_id } = req.body

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["subscription"],
    })

    if (session.status !== "complete") {
      return reply.code(400).send({ success: false, error: "Checkout session not complete" })
    }

    const clerkOrgId = session.metadata?.clerk_organization_id
    const clerkUserId = session.metadata?.clerk_user_id
    const plan = session.metadata?.plan
    const billingCycle = session.metadata?.billing_cycle

    if (!clerkOrgId || !clerkUserId || !plan || !billingCycle) {
      return reply.code(400).send({ success: false, error: "Missing metadata in checkout session" })
    }

    const sub = session.subscription as Stripe.Subscription
    if (!sub) return reply.code(400).send({ success: false, error: "No subscription in session" })

    await prisma.subscription.upsert({
      where: { stripeSubscriptionId: sub.id },
      update: {
        clerkOrganizationId: clerkOrgId,
        clerkUserId,
        stripeCustomerId: session.customer as string,
        plan,
        billingCycle: billingCycle === "yearly" ? "yearly" : "monthly",
        status: "active",
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        updatedAt: new Date(),
      },
      create: {
        clerkOrganizationId: clerkOrgId,
        clerkUserId,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: sub.id,
        plan,
        billingCycle: billingCycle === "yearly" ? "yearly" : "monthly",
        status: "active",
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    })

    return { success: true, plan, billing_cycle: billingCycle, status: "active" }
  })

  // POST /billing/portal — cria sessão do Customer Portal Stripe
  fastify.post<{ Body: { return_url?: string } }>("/billing/portal", async (req, reply) => {
    const stripe = getStripe()
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080"

    const sub = await prisma.subscription.findFirst({
      where: { clerkOrganizationId: req.auth.orgId },
    }).catch(() => null)

    if (!sub?.stripeCustomerId) {
      return reply.code(404).send({ error: "No Stripe customer found for this organization" })
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: req.body?.return_url || `${frontendUrl}/settings?tab=billing`,
    })

    return { portal_url: portalSession.url }
  })

  // POST /billing/webhook — recebe eventos Stripe (pública, verifica assinatura)
  fastify.post("/billing/webhook", async (req, reply) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      return reply.code(500).send({ error: "STRIPE_WEBHOOK_SECRET not configured" })
    }

    const stripe = getStripe()
    const sig = req.headers["stripe-signature"] as string
    if (!sig) return reply.code(400).send({ error: "Missing stripe-signature" })

    let event: Stripe.Event
    try {
      // req.rawBody requires rawBody: true in Fastify config; fallback to JSON body
      const body = (req as any).rawBody || JSON.stringify(req.body)
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch {
      return reply.code(400).send({ error: "Invalid signature" })
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const { clerk_organization_id: orgId, clerk_user_id: userId, plan, billing_cycle } = session.metadata || {}
        if (!orgId || !userId || !plan || !billing_cycle) break

        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        await prisma.subscription.upsert({
          where: { stripeSubscriptionId: sub.id },
          update: {
            clerkOrganizationId: orgId,
            clerkUserId: userId,
            stripeCustomerId: session.customer as string,
            plan,
            billingCycle: billing_cycle || "monthly",
            status: "active",
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            updatedAt: new Date(),
          },
          create: {
            clerkOrganizationId: orgId,
            clerkUserId: userId,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: sub.id,
            plan,
            billingCycle: billing_cycle || "monthly",
            status: "active",
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          },
        }).catch(console.error)
        break
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            status: stripeStatusToInternal(sub.status),
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            updatedAt: new Date(),
          },
        }).catch(console.error)
        break
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: "canceled", updatedAt: new Date() },
        }).catch(console.error)
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: invoice.subscription as string },
            data: { status: "past_due", updatedAt: new Date() },
          }).catch(console.error)
        }
        break
      }
    }

    return { received: true }
  })
}
