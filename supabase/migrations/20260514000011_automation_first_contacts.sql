-- ── 1. Per-automation dedup for keyword-based first_message triggers ──────────
-- Replaces the global whatsapp_first_touch for automations that use useKeyword=true.
-- A row is inserted here only after the keyword actually matched, so contacts
-- that send a non-matching first message are NOT permanently locked out.
CREATE TABLE IF NOT EXISTS public.automation_first_contacts (
  automation_id    uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone            text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (automation_id, organization_id, phone)
);

CREATE INDEX IF NOT EXISTS automation_first_contacts_org_phone_idx
  ON public.automation_first_contacts(organization_id, phone);

-- No RLS needed — only accessed via SUPABASE_SERVICE_ROLE_KEY in edge functions.

-- ── 2. Add has_keyword_trigger to automations for fast webhook lookup ─────────
-- Synced by automations-api save_flow handler so the webhook doesn't need to
-- load full flow configs just to decide dedup strategy.
ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS has_keyword_trigger boolean NOT NULL DEFAULT false;

-- Back-fill existing first_message automations that have useKeyword set in their
-- latest flow version (best-effort; edge function will keep it up-to-date going forward).
UPDATE public.automations a
SET has_keyword_trigger = true
WHERE a.trigger_type = 'first_message'
  AND EXISTS (
    SELECT 1
    FROM public.automation_flows af,
         jsonb_array_elements(af.nodes) AS n
    WHERE af.automation_id = a.id
      AND af.version = (
        SELECT MAX(af2.version)
        FROM public.automation_flows af2
        WHERE af2.automation_id = a.id
      )
      AND n->>'type' = 'trigger'
      AND (n->'data'->'config'->>'useKeyword')::boolean = true
  );
