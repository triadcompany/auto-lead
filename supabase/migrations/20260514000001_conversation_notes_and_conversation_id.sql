-- 1. Create conversation_notes table
CREATE TABLE IF NOT EXISTS public.conversation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_manage_notes"
  ON public.conversation_notes
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 2. Add conversation_id to tasks (nullable)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;

-- 3. Add conversation_id to appointments (nullable)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;

-- 4. Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_conversation_notes_conversation_id
  ON public.conversation_notes(conversation_id);

CREATE INDEX IF NOT EXISTS idx_tasks_conversation_id
  ON public.tasks(conversation_id);

CREATE INDEX IF NOT EXISTS idx_appointments_conversation_id
  ON public.appointments(conversation_id);
