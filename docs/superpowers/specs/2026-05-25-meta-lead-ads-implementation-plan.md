# Meta Lead Ads — Plano de Implementação
**Data:** 2026-05-25  
**Spec:** [2026-05-25-meta-lead-ads-integration-design.md](./2026-05-25-meta-lead-ads-integration-design.md)

---

## Ordem de implementação

```
1. Migrations SQL
2. Edge Function: ingest-meta-lead
3. Serviço N8N (auto-provisionamento)
4. OAuth Meta (backend + frontend)
5. UI: componente MetaLeadAdsIntegration
6. Registro na Settings.tsx
```

---

## Fase 1 — Migrations SQL

**Arquivo:** `supabase/migrations/20260525000001_meta_lead_ads.sql`

### O que criar

```sql
-- Tabela de contas Meta por organização
create table meta_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  meta_user_id text not null,
  meta_user_name text,
  access_token text not null,       -- criptografado com pgcrypto
  token_expires_at timestamptz,
  created_at timestamptz default now()
);

-- Tabela de integrações por campanha
create table meta_integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  meta_account_id uuid not null references meta_accounts(id) on delete cascade,
  campaign_name text not null,
  meta_page_id text not null,
  meta_form_id text not null,
  n8n_workflow_id text,
  n8n_folder_id text,
  pipeline_id uuid references pipelines(id),
  column_id uuid,
  seller_id uuid references profiles(id),
  field_mapping jsonb not null default '{}',
  status text not null default 'inactive',
  last_lead_at timestamptz,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table meta_accounts enable row level security;
alter table meta_integrations enable row level security;

-- Políticas: apenas admins da organização leem/escrevem
create policy "org_admin_meta_accounts" on meta_accounts
  using (org_id = get_user_org_id());

create policy "org_admin_meta_integrations" on meta_integrations
  using (org_id = get_user_org_id());
```

---

## Fase 2 — Edge Function: `ingest-meta-lead`

**Arquivo:** `supabase/functions/ingest-meta-lead/index.ts`

> Nota: já existe `meta-webhook`. Esta é uma função separada, chamada pelo N8N.

### Responsabilidades

1. Receber POST do N8N com payload do lead
2. Validar assinatura HMAC (secret compartilhado `N8N_INGEST_SECRET`)
3. Buscar `meta_integrations` pelo `integration_id` recebido
4. Inserir lead na tabela `leads` com campos mapeados
5. Chamar `automation-trigger` com evento `lead_created` + source `meta_lead_ads`
6. Atualizar `last_lead_at` em `meta_integrations`

### Payload esperado do N8N

```json
{
  "integration_id": "uuid",
  "lead_data": {
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "11999999999",
    "custom_field_1": "valor"
  }
}
```

### Headers obrigatórios

```
x-n8n-signature: hmac-sha256=<hash>
```

---

## Fase 3 — Serviço N8N (`src/services/n8nMetaProvisioning.ts`)

### Funções a implementar

```typescript
// Cria pasta Clientes/[org_name]/[campaign_name] se não existir
createN8nFolder(orgName: string, campaignName: string): Promise<string>

// Cria credencial Meta no N8N com o access_token
createMetaCredential(accessToken: string, credentialName: string): Promise<string>

// Cria workflow a partir do template parametrizado
createMetaWorkflow(params: {
  folderId: string,
  credentialId: string,
  integrationId: string,
  formId: string,
  campaignName: string,
  ingestUrl: string,
  ingestSecret: string
}): Promise<string>

// Ativa ou desativa workflow
setWorkflowActive(workflowId: string, active: boolean): Promise<void>

// Remove workflow e credencial ao deletar integração
deleteWorkflow(workflowId: string, credentialId: string): Promise<void>
```

### Template do workflow N8N (JSON base)

O template é um objeto JSON com placeholders substituídos antes da criação:
- `{{FORM_ID}}` → meta_form_id
- `{{CREDENTIAL_ID}}` → ID da credencial Meta criada
- `{{INGEST_URL}}` → URL da Edge Function ingest-meta-lead
- `{{INGEST_SECRET}}` → secret HMAC
- `{{FIELD_MAPPING}}` → JSON de mapeamento de campos
- `{{INTEGRATION_ID}}` → ID da integração

### Configuração de ambiente

O serviço lê do Supabase (tabela `organization_settings` ou similar) a URL e API key do N8N:
- `N8N_BASE_URL` — ex: `https://n8n.suaempresa.com`
- `N8N_API_KEY` — chave de API do N8N self-hosted

---

## Fase 4 — OAuth Meta

### Backend: Edge Function `meta-oauth-callback`

**Arquivo:** `supabase/functions/meta-oauth-callback/index.ts`

Fluxo:
1. Recebe `code` + `state` (contém `org_id`)
2. Troca `code` por short-lived token via Graph API
3. Troca por long-lived token (válido ~60 dias)
4. Busca nome e ID do usuário Meta
5. Upsert em `meta_accounts` com token criptografado
6. Redireciona para `/settings?tab=integrations&meta=connected`

**Variáveis de ambiente necessárias:**
- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI`

### Frontend: hook `useMetaOAuth.ts`

```typescript
// Gera URL de autorização e redireciona
initiateOAuth(orgId: string): void

// Lê resultado do redirect (?meta=connected) e atualiza estado
checkOAuthResult(): 'connected' | 'error' | null
```

**Permissões OAuth solicitadas:**
- `leads_retrieval`
- `pages_read_engagement`  
- `pages_manage_ads`

---

## Fase 5 — UI: `MetaLeadAdsIntegration`

**Arquivo:** `src/components/settings/MetaLeadAdsIntegration.tsx`

### Subcomponentes

```
MetaLeadAdsIntegration/
  ├── MetaAccountConnect     — botão OAuth + status da conta conectada
  ├── IntegrationList        — tabela de integrações ativas/inativas
  ├── IntegrationFormModal   — wizard de criação (4 passos)
  │     ├── Step1Identity    — nome campanha + página + formulário
  │     ├── Step2Destination — pipeline + coluna + vendedor
  │     └── Step3FieldMap    — mapeamento de campos
  └── IntegrationStatusBadge — 🟢 Ativo / 🔴 Erro / ⚫ Inativo
```

### Hook: `useMetaIntegrations.ts`

```typescript
// Estado
metaAccount: MetaAccount | null
integrations: MetaIntegration[]
loading: boolean

// Ações
connectMeta(): void                                    // inicia OAuth
disconnectMeta(): Promise<void>
fetchPages(): Promise<MetaPage[]>                      // via Graph API com token salvo
fetchForms(pageId: string): Promise<MetaForm[]>        // via Graph API
createIntegration(data: IntegrationFormData): Promise<void>  // cria + provisiona N8N
toggleIntegration(id: string, active: boolean): Promise<void>
deleteIntegration(id: string): Promise<void>
```

### Listagem de páginas e formulários

Chamadas à Graph API feitas via Edge Function `meta-graph-proxy` (evita expor token no frontend):
- `GET /me/accounts` → lista páginas
- `GET /{page_id}/leadgen_forms` → lista formulários da página

---

## Fase 6 — Registro na Settings.tsx

Adicionar ao switch de tabs em `src/pages/Settings.tsx`:

```typescript
// import
import { MetaLeadAdsIntegration } from "@/components/settings/MetaLeadAdsIntegration";

// no array de tabs (junto com N8N, Evolution, etc.)
{ id: "meta-leads", label: "Meta Lead Ads", icon: <FacebookIcon />, adminOnly: true }

// no switch de renderização
case "meta-leads":
  return <MetaLeadAdsIntegration />;
```

---

## Fase 7 — Integração com Automações

Nenhuma mudança no sistema de automações é necessária. O evento disparado pela `ingest-meta-lead` usa o mesmo fluxo de `lead_created` já existente.

Para permitir filtro por origem futuramente, garantir que a chamada à `automation-trigger` passe `source: "meta_lead_ads"` no payload — verificar se o schema atual suporta esse campo extra.

---

## Variáveis de ambiente necessárias

| Variável | Onde usar |
|---|---|
| `META_APP_ID` | Edge Functions OAuth |
| `META_APP_SECRET` | Edge Functions OAuth |
| `META_REDIRECT_URI` | Edge Functions OAuth |
| `N8N_BASE_URL` | Serviço de provisionamento |
| `N8N_API_KEY` | Serviço de provisionamento |
| `N8N_INGEST_SECRET` | Edge Function ingest + N8N workflow |
| `ENCRYPTION_KEY` | Criptografia de tokens Meta |

---

## Ordem de arquivos a criar/editar

| # | Arquivo | Ação |
|---|---|---|
| 1 | `supabase/migrations/20260525000001_meta_lead_ads.sql` | criar |
| 2 | `supabase/functions/ingest-meta-lead/index.ts` | criar |
| 3 | `supabase/functions/meta-oauth-callback/index.ts` | criar |
| 4 | `supabase/functions/meta-graph-proxy/index.ts` | criar |
| 5 | `src/services/n8nMetaProvisioning.ts` | criar |
| 6 | `src/hooks/useMetaOAuth.ts` | criar |
| 7 | `src/hooks/useMetaIntegrations.ts` | criar |
| 8 | `src/components/settings/MetaLeadAdsIntegration.tsx` | criar |
| 9 | `src/pages/Settings.tsx` | editar (adicionar tab) |
| 10 | `src/integrations/supabase/types.ts` | editar (regenerar ou adicionar tipos manuais) |
