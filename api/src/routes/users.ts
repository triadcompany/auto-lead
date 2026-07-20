import type { FastifyInstance } from "fastify"
import { prisma } from "../lib/prisma.js"
import { orgScope, requireAdmin } from "../lib/auth.js"

async function sendInviteEmail(opts: {
  toEmail: string
  toName: string
  orgName: string
  inviteUrl: string
  inviterName: string
}): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn("[invite] RESEND_API_KEY not set — skipping email send. Invite URL:", opts.inviteUrl)
    return
  }

  const from = process.env.FROM_EMAIL || "AutoLead <noreply@autolead.com.br>"

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
      <h2 style="margin:0 0 8px">Você foi convidado!</h2>
      <p style="color:#555;margin:0 0 24px">
        <strong>${opts.inviterName}</strong> convidou você para entrar na organização
        <strong>${opts.orgName}</strong> no Auto Lead.
      </p>
      <a href="${opts.inviteUrl}"
         style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;
                padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
        Aceitar convite
      </a>
      <p style="margin:24px 0 0;font-size:13px;color:#888">
        Ou acesse: <a href="${opts.inviteUrl}" style="color:#f97316">${opts.inviteUrl}</a>
      </p>
      <p style="margin:16px 0 0;font-size:12px;color:#aaa">
        Se você não esperava este convite, ignore este email.
      </p>
    </div>
  `

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [opts.toEmail],
      subject: `Convite para ${opts.orgName} no Auto Lead`,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error("[invite] Resend error:", res.status, body)
    throw new Error(`Failed to send invite email: ${res.status}`)
  }
}

export default async function usersRoutes(fastify: FastifyInstance) {
  // GET /users — lista membros da org
  fastify.get("/users", async (req) => {
    return prisma.profile.findMany({
      where: { ...orgScope(req) },
      select: {
        id: true,
        clerkUserId: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        whatsappE164: true,
        onboardingCompleted: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    })
  })

  // GET /users/me — perfil do usuário na organização ativa
  fastify.get("/users/me", async (req, reply) => {
    const profile = await prisma.profile.findUnique({
      where: { id: req.auth.profileId },
      include: { organization: true },
    })
    if (!profile) return reply.code(404).send({ error: "Profile not found" })
    return profile
  })

  // GET /users/me/organizations — todas as organizações do usuário (multi-org)
  fastify.get("/users/me/organizations", async (req) => {
    const profiles = await prisma.profile.findMany({
      where: { clerkUserId: req.auth.userId, organizationId: { not: null } },
      select: {
        organizationId: true,
        role: true,
        organization: { select: { name: true, logoUrl: true } },
      },
      orderBy: { createdAt: "asc" },
    })
    return profiles.map((p) => ({
      organization_id: p.organizationId,
      name: p.organization?.name || "",
      role: p.role,
      logo_url: p.organization?.logoUrl || null,
      is_current: p.organizationId === req.auth.orgId,
    }))
  })

  // POST /users/me/active-org — troca a organização ativa (persiste pra próxima sessão)
  fastify.post<{ Body: { organization_id: string } }>("/users/me/active-org", async (req, reply) => {
    const { organization_id } = req.body
    const target = await prisma.profile.findFirst({
      where: { clerkUserId: req.auth.userId, organizationId: organization_id },
      select: { organizationId: true, role: true, organization: { select: { name: true } } },
    })
    if (!target) {
      return reply.code(403).send({ error: "Not a member of this organization" })
    }

    await prisma.usersProfile.upsert({
      where: { clerkUserId: req.auth.userId },
      update: { lastActiveOrganizationId: organization_id },
      create: { clerkUserId: req.auth.userId, lastActiveOrganizationId: organization_id },
    })

    return {
      org_id: target.organizationId,
      role: target.role,
      name: target.organization?.name || "",
    }
  })

  // POST /users/sync — sincroniza usuário do Clerk (substitui sync-clerk-user + sync-login)
  fastify.post<{
    Body: {
      clerk_user_id: string
      email: string
      name: string
      avatar_url?: string
      organization_id?: string
    }
  }>("/users/sync", async (req, reply) => {
    const { clerk_user_id, email, name, avatar_url, organization_id } = req.body
    if (!organization_id) {
      return reply.code(400).send({ error: "organization_id is required" })
    }

    const profile = await prisma.profile.upsert({
      where: { clerkUserId_organizationId: { clerkUserId: clerk_user_id, organizationId: organization_id } },
      update: {
        email,
        name,
        ...(avatar_url && { avatarUrl: avatar_url }),
        updatedAt: new Date(),
      },
      create: {
        clerkUserId: clerk_user_id,
        email,
        name,
        ...(avatar_url && { avatarUrl: avatar_url }),
        ...(organization_id && { organizationId: organization_id }),
      },
    })
    return reply.code(200).send(profile)
  })

  // PATCH /users/:id/profile — atualiza perfil (substitui update-user-profile)
  fastify.patch<{
    Params: { id: string }
    Body: { name?: string; whatsapp_e164?: string; avatar_url?: string }
  }>("/users/:id/profile", async (req, reply) => {
    if (req.params.id !== req.auth.profileId && req.auth.role !== "admin") {
      return reply.code(403).send({ error: "Forbidden", message: "Você só pode editar o próprio perfil" })
    }
    const updated = await prisma.profile.updateMany({
      where: { id: req.params.id, ...orgScope(req) },
      data: {
        ...(req.body.name && { name: req.body.name }),
        ...(req.body.whatsapp_e164 && { whatsappE164: req.body.whatsapp_e164 }),
        ...(req.body.avatar_url && { avatarUrl: req.body.avatar_url }),
        updatedAt: new Date(),
      },
    })
    if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // PATCH /users/:id/role — atualiza role (substitui update-user-role)
  fastify.patch<{ Params: { id: string }; Body: { role: "admin" | "seller" } }>(
    "/users/:id/role",
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return
      const updated = await prisma.profile.updateMany({
        where: { id: req.params.id, ...orgScope(req) },
        data: { role: req.body.role, updatedAt: new Date() },
      })
      if (updated.count === 0) return reply.code(404).send({ error: "Not found" })
      return { success: true }
    }
  )

  // DELETE /users/:id — remove usuário (substitui delete-user)
  fastify.delete<{ Params: { id: string } }>("/users/:id", async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    if (req.params.id === req.auth.profileId) {
      return reply.code(400).send({ error: "Você não pode remover a si mesmo" })
    }
    const deleted = await prisma.profile.deleteMany({
      where: { id: req.params.id, ...orgScope(req) },
    })
    if (deleted.count === 0) return reply.code(404).send({ error: "Not found" })
    return { success: true }
  })

  // GET /invitations/:token — valida convite (rota PÚBLICA, sem auth)
  // Retorna { ok, invitation } ou { ok:false, code, error } com códigos que o front entende.
  fastify.get<{ Params: { token: string } }>("/invitations/:token", async (req, reply) => {
    const invite = await prisma.userInvitation.findUnique({
      where: { id: req.params.token },
    }).catch(() => null)

    if (!invite) {
      return { ok: false, code: "NOT_FOUND", error: "Convite não encontrado." }
    }
    if (invite.status === "accepted") {
      return { ok: false, code: "ACCEPTED", error: "Este convite já foi aceito.", email: invite.email }
    }
    if (invite.status === "canceled" || invite.status === "revoked") {
      return { ok: false, code: "REVOKED", error: "Este convite foi revogado." }
    }
    if (invite.status !== "pending") {
      return { ok: false, code: "INVALID", error: "Convite inválido." }
    }

    const org = await prisma.organization.findUnique({
      where: { id: invite.organizationId },
      select: { name: true },
    }).catch(() => null)

    return {
      ok: true,
      invitation: {
        id: invite.id,
        email: invite.email,
        name: invite.name,
        role: invite.role,
        organization_id: invite.organizationId,
        organization_name: org?.name || "Organização",
        expires_at: null,
      },
    }
  })

  // GET /users/invitations/:token/validate — compat (rota protegida antiga)
  fastify.get<{ Params: { token: string } }>("/users/invitations/:token/validate", async (req, reply) => {
    const invite = await prisma.userInvitation.findFirst({
      where: { id: req.params.token, status: "pending" },
    }).catch(() => null)

    if (!invite) return reply.code(404).send({ error: "Invitation not found or expired" })
    return invite
  })

  // POST /users/invite — convida usuário
  fastify.post<{ Body: { email: string; role: string; name?: string; forceResend?: boolean } }>(
    "/users/invite",
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return
      const { email, role, name, forceResend } = req.body
      const { orgId } = req.auth
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080"

      // Verifica convite pendente
      const existing = await prisma.userInvitation.findFirst({
        where: { organizationId: orgId, email, status: "pending" },
      }).catch(() => null)

      if (existing && !forceResend) {
        return reply.code(409).send({ code: "INVITE_PENDING", message: "Já existe um convite pendente para este email" })
      }

      // Cancela convite anterior ao reenviar
      if (existing && forceResend) {
        await prisma.userInvitation.update({
          where: { id: existing.id },
          data: { status: "canceled", updatedAt: new Date() },
        }).catch(() => null)
      }

      const safeRole = (role === "admin" ? "admin" : "seller") as "admin" | "seller"

      const invite = await prisma.userInvitation.create({
        data: {
          organizationId: orgId,
          email,
          role: safeRole,
          name: name || email,
          status: "pending",
        },
      })

      const inviteUrl = `${frontendUrl}/invite?token=${invite.id}`

      // Fetch org name + inviter name for the email
      const [org, inviter] = await Promise.all([
        prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
        prisma.profile.findUnique({ where: { id: req.auth.profileId }, select: { name: true } }),
      ])

      sendInviteEmail({
        toEmail: email,
        toName: name || email,
        orgName: org?.name || "Auto Lead",
        inviteUrl,
        inviterName: inviter?.name || "Administrador",
      }).catch(err => console.error("[invite] sendInviteEmail failed:", err))

      return reply.code(201).send({ inviteUrl, invitationId: invite.id, email })
    }
  )

  // POST /users/invitations/:token/accept — aceita convite
  fastify.post<{ Params: { token: string }; Body: { clerk_user_id: string } }>(
    "/users/invitations/:token/accept",
    async (req, reply) => {
      const invite = await prisma.userInvitation.findFirst({
        where: { id: req.params.token, status: "pending" },
      }).catch(() => null)

      if (!invite) return reply.code(404).send({ error: "Invitation not found or expired" })

      await prisma.profile.upsert({
        where: { clerkUserId_organizationId: { clerkUserId: req.body.clerk_user_id, organizationId: invite.organizationId } },
        update: { role: invite.role, updatedAt: new Date() },
        create: {
          clerkUserId: req.body.clerk_user_id,
          email: invite.email,
          name: invite.name || invite.email,
          organizationId: invite.organizationId,
          role: invite.role,
        },
      })

      await prisma.userInvitation.update({
        where: { id: req.params.token },
        data: { status: "accepted", updatedAt: new Date() },
      }).catch(() => null)

      return { success: true }
    }
  )
}
