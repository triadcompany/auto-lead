# Fluxo de Transferência de Conversas — Spec

**Data:** 2026-05-14  
**Status:** Aprovado para implementação

---

## Contexto

O CRM atende concessionárias de automóveis que recebem leads via Meta Ads e WhatsApp. Hoje existe um único número de WhatsApp por organização e conversas podem ser atribuídas a usuários via `conversations.assigned_to`, mas não há um fluxo estruturado de pré-vendas → vendedor.

O objetivo é permitir que um pré-vendas qualifique o lead e o transfira para um vendedor com histórico completo, mensagem de apresentação automática e visibilidade segmentada por papel.

---

## Decisões de design

- **Modelo de WhatsApp:** número único da empresa — o padrão do mercado (Kommo, Datacrazy). A conversa permanece no mesmo número durante toda a jornada do lead.
- **Abordagem:** Approach A — transferência simples aproveitando infraestrutura existente (`assigned_to`, filtros de inbox, `evolution-send`).
- **Distribuição automática:** não muda — round-robin e regras de horário existentes continuam funcionando.

---

## Papéis

| Papel | `org_members.role` | O que vê no inbox |
|---|---|---|
| Admin | `admin` | Tudo — sem mudança |
| Pré-vendas | `pre_sales` (novo) | Abas: "Não atribuídas" + "Todas" |
| Vendedor | `seller` | Aba "Minhas" apenas — "Todas" bloqueada |

A enum `role` no banco hoje aceita `admin` e `seller`. Será estendida com `pre_sales`.

---

## Fluxo de atendimento

1. **Lead chega** via Meta Ads ou WhatsApp → conversa criada com `assigned_to = null`
2. **Pré-vendas** abre a aba "Não atribuídas", seleciona a conversa e qualifica o lead
3. **Transferência:** pré-vendas clica em "Transferir" → escolhe vendedor → confirma
4. Ao confirmar, o sistema:
   a. Atribui `conversations.assigned_to = vendedor_id`
   b. Envia mensagem automática de apresentação ao lead via `whatsapp-send`
   c. Salva nota interna na conversa (se o pré-vendas preencheu o campo opcional)
   d. Registra entrada na tabela `conversation_transfers` (auditoria)
5. **Vendedor** vê a conversa aparecer no inbox com tag "Transferida" e continua o atendimento

---

## Componentes novos

### Backend

**Migração: `pre_sales` role**
- Estender a constraint/enum de `org_members.role` para aceitar `pre_sales`

**Nova coluna: `transfer_intro_message`**
- Adicionada em `organization_settings` (ou tabela equivalente da org)
- Tipo: `text`, nullable
- Suporta variáveis: `{nome_lead}`, `{nome_vendedor}`, `{nome_empresa}`
- Valor padrão: `"Olá {nome_lead}! Vou te conectar com {nome_vendedor}, nosso consultor especialista. Ele dará continuidade ao seu atendimento."`

**Nova tabela: `conversation_transfers`**
- `id uuid PK`
- `conversation_id uuid REFERENCES conversations(id)`
- `from_user_id uuid` — quem transferiu
- `to_user_id uuid` — quem recebeu
- `note text` — nota interna opcional
- `created_at timestamptz`
- RLS: leitura para membros da org, escrita via RPC

**Nova RPC: `transfer_conversation(p_conversation_id, p_to_user_id, p_note)`**
- SECURITY DEFINER
- Valida que a conversa pertence à org do chamador
- Valida que `p_to_user_id` é `seller` na mesma org
- Atualiza `conversations.assigned_to`
- Insere em `conversation_transfers`
- Resolve variáveis da mensagem de apresentação e chama `whatsapp-send`
- Se `p_note` não vazio, insere em `conversation_notes` via `create_conversation_note`
- Retorna `{ success: boolean, error?: string }`

### Frontend

**`src/hooks/useConversationTransfer.ts`** (novo)
- `transferConversation(conversationId, toUserId, note?)` — chama a RPC
- Invalida queries `['conversations']` e `['inbox']` após sucesso

**`src/components/inbox/TransferModal.tsx`** (novo)
- Lista vendedores da org com contagem de conversas abertas (online primeiro)
- Campo de nota opcional
- Prévia da mensagem automática (substituindo variáveis)
- Botão "Transferir para {nome}"

**`src/components/inbox/ConversationHeader.tsx`** (modificado ou novo)
- Adiciona botão "↗ Transferir" visível para `pre_sales` e `admin`
- Abre `TransferModal`

**`src/pages/Inbox.tsx`** (modificado)
- Filtra abas disponíveis conforme `profile.role`:
  - `seller`: apenas aba "Minhas", aba "Todas" renderizada como desabilitada
  - `pre_sales`: abas "Não atribuídas" (padrão) e "Todas"
  - `admin`: sem mudança

**`src/components/settings/LeadDistribution.tsx`** (modificado)
- Novo card "Mensagem de Apresentação na Transferência"
- Textarea com o template
- Chips clicáveis das variáveis disponíveis
- Salvo junto com as demais configurações de distribuição (ou campo separado na mesma tela)

---

## Dados necessários no frontend

Para renderizar o `TransferModal` com contagem de conversas por vendedor, o frontend precisa:
- Lista de vendedores da org: já disponível via `get_org_profiles` RPC (filtrar por role `seller`)
- Contagem de conversas abertas por vendedor: nova query ou campo adicional no RPC acima

Opção adotada: adicionar parâmetro `p_role` ao `get_org_profiles` para filtrar por papel e retornar também `open_conversation_count` por join com `conversations`.

---

## O que NÃO muda

- Distribuição automática de leads (round-robin, menor carga, regras de horário) — intacta
- Estrutura de conversas e mensagens — intacta
- Integração Evolution API / WhatsApp — reusa `whatsapp-send` existente
- Autenticação e RLS — mesmo padrão Clerk + SECURITY DEFINER RPCs

---

## Fora de escopo

- Notificações push/push mobile ao vendedor quando conversa é atribuída (pode ser próximo passo)
- Painel de capacidade da equipe (load balancing visual) — Approach B, futuro
- Pipeline de atendimento estilo Kanban — Approach C, futuro
