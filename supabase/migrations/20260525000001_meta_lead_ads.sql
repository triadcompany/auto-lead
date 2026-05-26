-- Meta Lead Ads integration tables
-- meta_accounts: one OAuth connection per organization
-- meta_integrations: one N8N workflow per campaign/form

-- ── meta_accounts ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meta_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  meta_user_id text NOT NULL,
  meta_user_name text,
  access_token text NOT NULL,
  token_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.meta_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'meta_accounts' AND policyname = 'clerk_select_meta_accounts'
  ) THEN
    CREATE POLICY "clerk_select_meta_accounts" ON public.meta_accounts
      FOR SELECT USING (
        organization_id IN (
          SELECT p.organization_id FROM public.profiles p
          WHERE p.clerk_user_id = public.get_clerk_user_id()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'meta_accounts' AND policyname = 'clerk_insert_meta_accounts'
  ) THEN
    CREATE POLICY "clerk_insert_meta_accounts" ON public.meta_accounts
      FOR INSERT WITH CHECK (
        organization_id IN (
          SELECT p.organization_id FROM public.profiles p
          WHERE p.clerk_user_id = public.get_clerk_user_id()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'meta_accounts' AND policyname = 'clerk_update_meta_accounts'
  ) THEN
    CREATE POLICY "clerk_update_meta_accounts" ON public.meta_accounts
      FOR UPDATE USING (
        organization_id IN (
          SELECT p.organization_id FROM public.profiles p
          WHERE p.clerk_user_id = public.get_clerk_user_id()
        )
      ) WITH CHECK (
        organization_id IN (
          SELECT p.organization_id FROM public.profiles p
          WHERE p.clerk_user_id = public.get_clerk_user_id()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'meta_accounts' AND policyname = 'clerk_delete_meta_accounts'
  ) THEN
    CREATE POLICY "clerk_delete_meta_accounts" ON public.meta_accounts
      FOR DELETE USING (
        organization_id IN (
          SELECT p.organization_id FROM public.profiles p
          WHERE p.clerk_user_id = public.get_clerk_user_id()
        )
      );
  END IF;
END $$;

-- ── meta_integrations ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meta_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  meta_account_id uuid NOT NULL REFERENCES public.meta_accounts(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  meta_page_id text NOT NULL,
  meta_page_name text,
  meta_form_id text NOT NULL,
  meta_form_name text,
  n8n_workflow_id text,
  n8n_folder_id text,
  n8n_credential_id text,
  pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  field_mapping jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('inactive', 'active', 'error', 'provisioning')),
  last_lead_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.meta_integrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'meta_integrations' AND policyname = 'clerk_select_meta_integrations'
  ) THEN
    CREATE POLICY "clerk_select_meta_integrations" ON public.meta_integrations
      FOR SELECT USING (
        organization_id IN (
          SELECT p.organization_id FROM public.profiles p
          WHERE p.clerk_user_id = public.get_clerk_user_id()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'meta_integrations' AND policyname = 'clerk_insert_meta_integrations'
  ) THEN
    CREATE POLICY "clerk_insert_meta_integrations" ON public.meta_integrations
      FOR INSERT WITH CHECK (
        organization_id IN (
          SELECT p.organization_id FROM public.profiles p
          WHERE p.clerk_user_id = public.get_clerk_user_id()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'meta_integrations' AND policyname = 'clerk_update_meta_integrations'
  ) THEN
    CREATE POLICY "clerk_update_meta_integrations" ON public.meta_integrations
      FOR UPDATE USING (
        organization_id IN (
          SELECT p.organization_id FROM public.profiles p
          WHERE p.clerk_user_id = public.get_clerk_user_id()
        )
      ) WITH CHECK (
        organization_id IN (
          SELECT p.organization_id FROM public.profiles p
          WHERE p.clerk_user_id = public.get_clerk_user_id()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'meta_integrations' AND policyname = 'clerk_delete_meta_integrations'
  ) THEN
    CREATE POLICY "clerk_delete_meta_integrations" ON public.meta_integrations
      FOR DELETE USING (
        organization_id IN (
          SELECT p.organization_id FROM public.profiles p
          WHERE p.clerk_user_id = public.get_clerk_user_id()
        )
      );
  END IF;
END $$;

-- Edge Functions (service_role) precisam acesso sem RLS
CREATE POLICY "service_role_meta_accounts" ON public.meta_accounts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_meta_integrations" ON public.meta_integrations
  FOR ALL USING (auth.role() = 'service_role');

-- updated_at automático
CREATE OR REPLACE FUNCTION public.update_meta_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_meta_accounts_updated_at
  BEFORE UPDATE ON public.meta_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_meta_updated_at();

CREATE TRIGGER set_meta_integrations_updated_at
  BEFORE UPDATE ON public.meta_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_meta_updated_at();
