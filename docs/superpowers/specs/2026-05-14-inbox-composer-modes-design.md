# Inbox Composer Modes — Design Spec
**Data:** 2026-05-14  
**Status:** Aprovado

---

## Visão geral

Adicionar um seletor de modo ao compositor do Inbox que permite criar **Notas internas**, **Tarefas** e **Agendamentos** diretamente da conversa, sem sair da tela. Os itens criados aparecem no histórico da conversa como cards visuais intercalados com as mensagens, em ordem cronológica.

---

## Modelo de dados

### Nova tabela: `conversation_notes`
| Campo | Tipo | Obrigatório |
|---|---|---|
| `id` | uuid PK | sim |
| `conversation_id` | uuid FK conversations | sim |
| `organization_id` | uuid FK organizations | sim |
| `content` | text | sim |
| `created_by` | uuid FK profiles | sim |
| `created_at` | timestamptz | sim |

RLS: leitura e escrita apenas para membros da organização (via `organization_id`).

### Alterações em tabelas existentes
- **`tasks`**: adicionar coluna `conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL` (nullable)
- **`appointments`**: adicionar coluna `conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL` (nullable)

---

## Arquitetura de componentes

### Modificações no existente

**`src/components/inbox/MessageComposer.tsx`**
- Adiciona dropdown de seletor de modo acima do campo de texto
- Modos: `chat` | `note` | `task` | `appointment`
- Ao selecionar um modo, renderiza o compositor correspondente no lugar do campo atual
- Ao salvar/enviar, retorna automaticamente para modo `chat`

**`src/hooks/useInbox.ts`**
- Integra `useConversationTimeline` para mesclar mensagens com itens das outras tabelas

### Novos componentes

| Componente | Caminho | Responsabilidade |
|---|---|---|
| `NoteComposer` | `src/components/inbox/NoteComposer.tsx` | Textarea + botão Salvar nota |
| `TaskComposer` | `src/components/inbox/TaskComposer.tsx` | Título + prazo + "Mais opções" colapsável |
| `AppointmentComposer` | `src/components/inbox/AppointmentComposer.tsx` | Date/time + tipo + "Mais opções" colapsável |
| `NoteCard` | `src/components/inbox/NoteCard.tsx` | Card amarelo no timeline |
| `AppointmentCard` | `src/components/inbox/AppointmentCard.tsx` | Card azul no timeline |

`TaskCard` já existe em `src/components/tasks/TaskCard.tsx` — adaptar para uso no inbox.

### Novos hooks

**`src/hooks/useConversationNotes.ts`**
- `fetchNotes(conversationId)` — lista notas da conversa
- `createNote(conversationId, content)` — cria nota e invalida cache
- Realtime: subscribe em `conversation_notes` filtrado por `conversation_id`

**`src/hooks/useConversationTimeline.ts`**
- Recebe: array de mensagens, notas, tarefas, agendamentos
- Retorna: array unificado ordenado por `created_at`, cada item com campo `_type: 'message' | 'note' | 'task' | 'appointment'`
- Sem chamada de rede — apenas transformação de dados

---

## UX por modo

### Seletor de modo
- Dropdown discreto acima do compositor, alinhado à esquerda
- Label: `"Bate-papo ▾"` (modo padrão)
- Opções: Bate-papo · Nota · Tarefa · Agendamento
- Trocar de modo muda o compositor instantaneamente
- Salvar/enviar qualquer modo retorna para Bate-papo

### Modo Nota
- Textarea com placeholder: *"Nota interna... (visível só para a equipe)"*
- Botão "Salvar nota" — não envia com Enter (evita envio acidental)
- Card resultante: fundo amarelo claro, borda esquerda âmbar, ícone 🔒, label "Nota interna", texto, autor e hora

### Modo Tarefa
- Campo obrigatório: título (text input)
- Campo obrigatório: prazo (date + time picker)
- "Mais opções ▾" expande: descrição, prioridade (baixa/média/alta), responsável (select de membros da org)
- Botão "Criar tarefa"
- Card resultante: borda esquerda roxa, ícone de check, título, prazo, responsável. Clicável para abrir modal completo de tarefa

### Modo Agendamento
- Campo obrigatório: data e hora (date/time picker)
- Campo obrigatório: tipo (select com valores da tabela `appointments.tipo`)
- "Mais opções ▾" expande: duração em minutos, anotações (textarea)
- Botão "Agendar"
- Card resultante: borda esquerda azul, ícone de calendário, data/hora e tipo

---

## Timeline unificada

- Cards de nota/tarefa/agendamento aparecem intercalados com mensagens por `created_at`
- Design visual: sem balão de mensagem, fundo colorido sutil por tipo, borda esquerda colorida
- Cores por tipo: amarelo (nota), roxo (tarefa), azul (agendamento)
- Renderização no mesmo scroll das mensagens — não em seção separada
- Realtime: novos itens aparecem sem reload via Supabase Realtime

---

## Migrações SQL necessárias

```sql
-- 1. Tabela conversation_notes
CREATE TABLE public.conversation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;
-- RLS policy: membros da org podem ler e escrever

-- 2. Coluna conversation_id em tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;

-- 3. Coluna conversation_id em appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;
```

---

## Escopo fora desta spec

- Edição ou exclusão de notas criadas (fase 2)
- Notificações para responsável de tarefa criada via inbox (fase 2)
- Visualização de agendamentos num calendário dedicado (já existe tabela, UI separada)
- Recorrência de agendamentos (fase 2)
