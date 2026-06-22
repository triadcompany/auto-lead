# Migração Backend: Supabase → Node.js + Fastify + Prisma

**Data:** 2026-06-22  
**Estratégia:** Big bang — reescrita completa, lançamento único  
**Motivação:** Supabase cloud no limite; migrar para infraestrutura própria na VPS Hostinger (Easypanel)

---

## 1. Visão Geral

Substituição completa do backend Supabase (PostgREST + Edge Functions + Realtime + Storage) por uma API Node.js com Fastify, mantendo o banco PostgreSQL existente. O frontend React é reorganizado em monorepo e migrado de `supabase-js` para um cliente HTTP simples.

**O que não muda:** PostgreSQL (banco e dados), Clerk (autenticação), N8N (automações), React + shadcn/ui (frontend).

**O que muda:** Tudo que passa pelo Supabase — Edge Functions viram rotas Fastify, RLS vira middleware, Realtime vira Socket.io, Storage vira MinIO.

---

## 2. Estrutura do Monorepo

```
auto-lead/
├── api/                        # Backend Fastify
│   ├── src/
│   │   ├── routes/             # Um arquivo por domínio
│   │   │   ├── leads.ts
│   │   │   ├── pipelines.ts
│   │   │   ├── whatsapp.ts
│   │   │   ├── instagram.ts
│   │   │   ├── meta.ts
│   │   │   ├── automations.ts
│   │   │   ├── broadcasts.ts
│   │   │   ├── organizations.ts
│   │   │   ├── users.ts
│   │   │   ├── billing.ts
│   │   │   ├── inbox.ts
│   │   │   └── ai.ts
│   │   ├── plugins/
│   │   │   ├── auth.ts         # Clerk JWT verification
│   │   │   ├── cors.ts
│   │   │   └── socket.ts       # Socket.io setup
│   │   ├── services/
│   │   │   ├── storage.ts      # MinIO client
│   │   │   └── realtime.ts     # emit helpers
│   │   └── server.ts           # Entry point
│   ├── prisma/
│   │   └── schema.prisma       # Gerado via `prisma db pull`
│   └── package.json
├── web/                        # Frontend (src/ atual move para cá)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.ts          # Cliente HTTP centralizado
│   │   │   └── socket.ts       # Socket.io client singleton
│   │   └── hooks/
│   │       └── useSocket.ts    # Hook centralizado de Realtime
│   └── package.json
├── docker-compose.yml          # API + MinIO
└── package.json                # Scripts raiz
```

---

## 3. Stack

| Componente | Tecnologia |
|---|---|
| Framework HTTP | Fastify |
| ORM | Prisma |
| Realtime | Socket.io (integrado no Fastify) |
| Storage | MinIO (S3-compatível) |
| Auth | @clerk/fastify |
| S3 Client | @aws-sdk/client-s3 |
| Runtime | Node.js 20 |

---

## 4. Autenticação e Isolamento de Dados

### Substituindo RLS

O plugin `plugins/auth.ts` registra o `@clerk/fastify` globalmente. Todas as rotas protegidas recebem `request.auth = { userId, orgId }` extraído do JWT Clerk.

```ts
// plugins/auth.ts
fastify.register(clerkPlugin, { secretKey: process.env.CLERK_SECRET_KEY })
fastify.addHook("onRequest", async (req) => {
  await req.auth.isSignedIn() // lança 401 se inválido
})
```

**Isolamento por organização** — helper usado em todas as queries:

```ts
// Equivalente ao RLS: organization_id = get_clerk_user_id()
export const orgScope = (req: FastifyRequest) => ({
  organization_id: req.auth.orgId,
})

// Uso nas rotas:
prisma.lead.findMany({ where: { ...orgScope(req) } })
```

### Rotas Públicas (sem auth)

Webhooks externos ficam fora do plugin global e usam validação própria:
- **N8N / ingest-meta-lead:** HMAC-SHA256 via header `x-n8n-signature`
- **Stripe:** `stripe.webhooks.constructEvent()` com webhook secret
- **Meta webhook:** verificação de token do app Meta
- **Evolution (WhatsApp):** secret header configurável

---

## 5. Organização das Rotas

Mapeamento das 65 Edge Functions para rotas Fastify:

| Arquivo de rota | Edge Functions substituídas |
|---|---|
| `leads.ts` | receive-lead-webhook, change-lead-status, update-sale-value, reset-first-touch, inbox-conversation-lead |
| `pipelines.ts` | CRUD pipelines e stages (via PostgREST hoje) |
| `whatsapp.ts` | evolution-create-instance, evolution-delete-instance, evolution-get-qr, evolution-get-status, evolution-send, evolution-webhook, whatsapp-connect, whatsapp-disconnect, whatsapp-send, whatsapp-send-audio, whatsapp-status, whatsapp-webhook, whatsapp-webhook-v2, fix-evolution-webhooks |
| `instagram.ts` | instagram-connect, instagram-exchange, instagram-send-message, instagram-webhook |
| `meta.ts` | meta-oauth-callback, meta-graph-proxy, ingest-meta-lead, meta-webhook, meta-capi-settings, send-meta-event |
| `automations.ts` | automation-trigger, automation-scheduler, automation-worker, automations-api, save-automation, process-event-dispatch, event-dispatcher |
| `broadcasts.ts` | broadcast-worker, process-followups |
| `organizations.ts` | bootstrap-org, update-clerk-org, upload-org-logo, update-sensitive-settings |
| `users.ts` | sync-clerk-user, update-user-profile, update-user-role, invite-user, accept-invitation, manage-invitation, validate-invitation, send-invitation-email, send-confirmation-email, delete-user, migrate-users-to-clerk, clerk-reconcile-users |
| `billing.ts` | create-checkout, customer-portal, stripe-webhook, check-subscription, sync-subscription-from-checkout |
| `inbox.ts` | inbox-debug, inbox-debug-links |
| `ai.ts` | ai-analyze-conversation, ai-auto-reply, ai-agent-profile |
| `misc.ts` | cnpj-lookup, notify-lead-assignment, backfill-group-names, admin-debug, admin-fix-wa-v2-webhook |

---

## 6. Realtime (Socket.io)

### Servidor

Socket.io é integrado no mesmo processo Fastify (sem servidor separado):

```ts
// plugins/socket.ts
const io = new Server(fastify.server, { cors: { origin: FRONTEND_URL } })

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token
  const { userId, orgId } = await verifyClerkToken(token)
  socket.data = { userId, orgId }
  next()
})

io.on("connection", (socket) => {
  socket.join(`org:${socket.data.orgId}`)
})
```

### Emissão de eventos (após mutations na API)

```ts
// services/realtime.ts
export const emit = (orgId: string, event: string, payload: unknown) =>
  io.to(`org:${orgId}`).emit(event, payload)

// Uso em leads.ts após criar lead:
emit(req.auth.orgId, "lead:created", lead)
```

### Eventos

| Evento | Trigger |
|---|---|
| `lead:created` | POST /leads |
| `lead:updated` | PATCH /leads/:id |
| `lead:moved` | PATCH /leads/:id/stage |
| `message:received` | webhook WhatsApp/Instagram |
| `notification:new` | qualquer ação que gera notificação |

### Frontend

```ts
// web/src/lib/socket.ts — singleton
export const socket = io(API_URL, { auth: { token: getClerkToken() } })

// web/src/hooks/useSocket.ts — substitui todos os supabase.channel()
export function useSocket<T>(event: string, handler: (data: T) => void) {
  useEffect(() => {
    socket.on(event, handler)
    return () => socket.off(event, handler)
  }, [event, handler])
}
```

---

## 7. Storage (MinIO)

### Deploy

MinIO sobe como serviço no `docker-compose.yml`:

```yaml
minio:
  image: minio/minio
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
    MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
  volumes:
    - minio_data:/data
```

Exposto via Easypanel com domínio `minio.upw28y.easypanel.host`.

### Service na API

```ts
// services/storage.ts
const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT,
  credentials: { accessKeyId: MINIO_ACCESS_KEY, secretAccessKey: MINIO_SECRET_KEY },
  forcePathStyle: true, // obrigatório para MinIO
})

export async function uploadFile(key: string, buffer: Buffer, contentType: string) {
  await s3.send(new PutObjectCommand({ Bucket: "auto-lead", Key: key, Body: buffer, ContentType: contentType }))
  return `${MINIO_ENDPOINT}/auto-lead/${key}`
}
```

### Buckets

| Bucket | Conteúdo |
|---|---|
| `org-logos` | Logos das organizações |
| `campaign-media` | Mídias de broadcasts e campanhas |

---

## 8. Frontend — Substituição do supabase-js

### Cliente HTTP centralizado

```ts
// web/src/lib/api.ts
const getToken = () => window.Clerk?.session?.getToken()

async function request(method: string, path: string, body?: unknown) {
  const token = await getToken()
  const res = await fetch(API_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw await res.json()
  return res.json()
}

export const api = {
  get: (path: string) => request("GET", path),
  post: (path: string, body: unknown) => request("POST", path, body),
  patch: (path: string, body: unknown) => request("PATCH", path, body),
  delete: (path: string) => request("DELETE", path),
}
```

### Migração dos hooks

Cada hook troca `supabase.from("tabela").select()` por `api.get("/rota")`. A lógica de estado (useState, useEffect, loading, error) permanece idêntica.

```ts
// Antes
const { data } = await supabase.from("leads").select("*")

// Depois
const data = await api.get("/leads")
```

### Arquivos deletados

- `web/src/integrations/supabase/client.ts`
- `web/src/integrations/supabase/types.ts`
- Toda referência a `import { supabase } from "@/integrations/supabase/client"`

### Variáveis de ambiente

| Antes | Depois |
|---|---|
| `VITE_SUPABASE_URL` | `VITE_API_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | removida |
| `VITE_META_APP_ID` | mantida |
| `VITE_N8N_INGEST_SECRET` | removida (fica só no servidor) |

---

## 9. Deploy na VPS

### docker-compose.yml (raiz do monorepo)

```yaml
services:
  api:
    build: ./api
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: ${DATABASE_URL}
      CLERK_SECRET_KEY: ${CLERK_SECRET_KEY}
      MINIO_ENDPOINT: ${MINIO_ENDPOINT}
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
      N8N_INGEST_SECRET: ${N8N_INGEST_SECRET}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
      META_APP_SECRET: ${META_APP_SECRET}
    depends_on: [minio]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes: [minio_data:/data]
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}

volumes:
  minio_data:
```

### Domínios no Easypanel

| Serviço | Domínio |
|---|---|
| API Fastify | `api.upw28y.easypanel.host` |
| MinIO (S3) | `minio.upw28y.easypanel.host` |
| MinIO Console | `minio-console.upw28y.easypanel.host` |

---

## 10. Ordem de Execução (Big Bang)

1. **Prisma schema** — `prisma db pull` contra o banco existente, revisar e ajustar
2. **Estrutura do monorepo** — mover `src/` atual para `web/src/`, criar `api/`
3. **Plugins base** — auth (Clerk), CORS, Socket.io
4. **Rotas por domínio** — implementar na ordem: leads → pipelines → users → organizations → whatsapp → instagram → meta → automations → broadcasts → billing → ai
5. **Storage** — MinIO + service de upload
6. **Frontend** — criar `api.ts`, `socket.ts`, `useSocket.ts`; migrar hooks domínio por domínio
7. **Testes locais** — API local + banco de produção (read-only), depois write
8. **Deploy VPS** — subir API e MinIO no Easypanel
9. **Cutover** — apontar frontend para nova API, monitorar erros
10. **Desligar Supabase** — após 48h estável

---

## 11. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Bug de isolamento de dados (RLS manual) | Testes de integração com múltiplos orgIds antes do cutover |
| Perda de eventos Realtime durante migração | Manter polling como fallback temporário nos hooks críticos |
| Webhooks externos (Meta, Stripe, Evolution) offline | Testar em ambiente de staging antes do cutover |
| Schema Prisma divergente do banco real | `prisma db pull` + revisão manual de cada tabela |
