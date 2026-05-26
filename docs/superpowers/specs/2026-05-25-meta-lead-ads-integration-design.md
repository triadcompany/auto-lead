# Meta Lead Ads Integration — Design Spec
**Data:** 2026-05-25  
**Status:** Aprovado

---

## Objetivo

Permitir que clientes conectem sua conta do Meta e capturem leads de formulários de anúncio (Lead Ads) diretamente no CRM, sem configuração técnica. Cada formulário de campanha é mapeado para um pipeline, coluna e mapeamento de campos específicos.

---

## Arquitetura

### Modo de execução: N8N Auto-Provisionado

```
Cliente preenche formulário Meta
        ↓
Meta dispara webhook para N8N
        ↓
N8N (workflow criado pelo sistema via API)
        ↓
HTTP POST → Supabase (Edge Function ou REST)
        ↓
Lead criado no CRM (pipeline + coluna configurados)
        ↓
automationEventBus dispara evento
        ↓
Automações do cliente rodam normalmente
```

### Por que N8N e não Edge Function direta

- N8N possui node nativo de Meta Lead Ads (OAuth, webhook, busca de dados)
- Reduz código a manter significativamente
- Melhor observabilidade e retry por campanha
- N8N self-hosted já faz parte da infraestrutura

### Granularidade: por campanha (formulário)

Um workflow N8N por formulário de campanha. Cada workflow é independente — ativar/desativar ou errar numa campanha não afeta as outras.

### Organização no N8N

```
Clientes/
  └── [Nome da Empresa]/
        └── [Nome da Campanha]
```

Pastas criadas automaticamente via N8N API ao ativar a integração.

---

## Banco de Dados

### Nova tabela: `meta_integrations`

```sql
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
  column_id uuid, -- id da coluna/estágio do kanban
  seller_id uuid references profiles(id), -- null = distribuição automática
  field_mapping jsonb not null default '{}',
  status text not null default 'inactive', -- inactive | active | error
  last_lead_at timestamptz,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### `field_mapping` — estrutura JSON

```json
{
  "full_name": "name",
  "email": "email",
  "phone_number": "phone",
  "cidade": "city",
  "interesse": "custom_field_1"
}
```

Chave = nome do campo no formulário Meta. Valor = campo no modelo de Lead do CRM.

### Nova tabela: `meta_accounts`

Armazena a conexão OAuth por organização (uma conta Meta pode ter múltiplas integrações).

```sql
create table meta_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  meta_user_id text not null,
  meta_user_name text,
  access_token text not null, -- long-lived token, criptografado
  token_expires_at timestamptz,
  created_at timestamptz default now()
);
```

---

## Interface do Cliente

Local: **Configurações → Integrações → Meta Lead Ads**

### Fluxo de configuração (4 passos)

**1. Conectar conta Meta (uma vez por organização)**
- Botão "Conectar com Facebook"
- OAuth com permissões: `leads_retrieval`, `pages_read_engagement`, `pages_manage_ads`
- Token long-lived salvo criptografado em `meta_accounts`
- Exibe: nome do usuário conectado + botão de desconectar

**2. Nova integração — identificação**
- Nome da campanha (texto livre — vira o nome da pasta no N8N)
- Página do Facebook (dropdown carregado da Graph API com o token)
- Formulário (dropdown carregado conforme página selecionada)

**3. Destino no CRM**
- Pipeline (dropdown dos pipelines da organização)
- Coluna inicial (dropdown dinâmico baseado no pipeline)
- Vendedor responsável (dropdown ou "Distribuição automática")

**4. Mapeamento de campos**
- Campos fixos (sempre mapeados): `full_name → Nome`, `email → E-mail`, `phone_number → Telefone`
- Campos customizados do formulário Meta listados dinamicamente
- Para cada campo custom: dropdown com campos disponíveis no Lead do CRM
- Campos não mapeados são ignorados

**Ativar:**
- Botão "Salvar e Ativar"
- Sistema chama N8N API para criar pasta + workflow + ativar
- Status exibido: 🟢 Ativo / 🔴 Erro / ⚫ Inativo
- Último lead recebido exibido com timestamp

### Lista de integrações

Tabela com todas as integrações da organização:

| Campanha | Formulário | Pipeline | Status | Último lead |
|---|---|---|---|---|
| Black Friday | Form BF26 | Vendas | 🟢 Ativo | há 2h |
| Captação WA | Form Geral | Prospecção | ⚫ Inativo | — |

---

## Fluxo Técnico N8N

### Criação do workflow via API

Ao clicar em "Salvar e Ativar", o backend:

1. Verifica/cria pasta `Clientes/[org_name]/` no N8N via `POST /api/v1/folders`
2. Cria workflow a partir de um template JSON parametrizado via `POST /api/v1/workflows`
3. Injeta credencial Meta (token) via `POST /api/v1/credentials`
4. Ativa workflow via `PATCH /api/v1/workflows/:id` com `{ active: true }`
5. Salva `n8n_workflow_id` e `n8n_folder_id` em `meta_integrations`

### Template do workflow N8N

```
[Meta Lead Ads Trigger]
  → form_id configurado
  → credencial Meta injetada
        ↓
[Transform Node]
  → aplica field_mapping
  → monta payload do lead
        ↓
[HTTP Request]
  → POST para Edge Function /ingest-meta-lead
  → body: { org_id, pipeline_id, column_id, seller_id, lead_data }
        ↓
[Error Handler]
  → atualiza status para "error" em meta_integrations
```

### Edge Function: `ingest-meta-lead`

Recebe o payload do N8N, valida `org_id` e a assinatura HMAC, insere o lead diretamente via Supabase Admin Client (insert na tabela `leads` com os campos mapeados) e chama a função RPC de disparo de automações com evento `lead_created` e source `meta_lead_ads`.

---

## Integração com Automações Existentes

Quando o lead é criado via Meta, o evento disparado no `automationEventBus` inclui:

```json
{
  "event": "lead_created",
  "source": "meta_lead_ads",
  "campaign_name": "Black Friday",
  "meta_form_id": "abc123",
  "lead_id": "uuid",
  "pipeline_id": "uuid",
  "column_id": "uuid"
}
```

O cliente pode criar automações normalmente na página de Automações usando o gatilho "Lead criado" — os leads do Meta chegam por esse mesmo gatilho, sem tratamento especial. Se quiser filtrar por origem (Meta vs manual), pode usar condição por `source`.

---

## Segurança

- Tokens Meta armazenados criptografados (AES-256 ou `pgcrypto` do Postgres)
- Edge Function `ingest-meta-lead` valida assinatura HMAC do N8N (secret compartilhado)
- RLS garante que cada organização acessa apenas suas próprias integrações
- Token de acesso N8N armazenado em variável de ambiente do servidor, nunca exposto ao frontend

---

## Fora do Escopo (MVP)

- Renovação automática de token Meta expirado (avisar ao usuário para reconectar)
- Histórico de leads recebidos por integração
- Múltiplas contas Meta por organização
- Webhook de teste ("enviar lead de teste")
- Relatórios de performance por campanha Meta
