-- Fix RLS on tasks and appointments for Clerk users.
-- auth.uid() is always null for Clerk; policies must use get_clerk_user_id() via profiles.
-- We add new permissive policies — Postgres ORs permissive policies together,
-- so existing Supabase-auth policies still work alongside these.

-- ── TASKS ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'clerk_select_tasks'
  ) THEN
    CREATE POLICY "clerk_select_tasks" ON public.tasks
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
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'clerk_insert_tasks'
  ) THEN
    CREATE POLICY "clerk_insert_tasks" ON public.tasks
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
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'clerk_update_tasks'
  ) THEN
    CREATE POLICY "clerk_update_tasks" ON public.tasks
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
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'clerk_delete_tasks'
  ) THEN
    CREATE POLICY "clerk_delete_tasks" ON public.tasks
      FOR DELETE USING (
        organization_id IN (
          SELECT p.organization_id FROM public.profiles p
          WHERE p.clerk_user_id = public.get_clerk_user_id()
        )
      );
  END IF;
END $$;

-- ── APPOINTMENTS ────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'clerk_select_appointments'
  ) THEN
    CREATE POLICY "clerk_select_appointments" ON public.appointments
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
    SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'clerk_insert_appointments'
  ) THEN
    CREATE POLICY "clerk_insert_appointments" ON public.appointments
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
    SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'clerk_update_appointments'
  ) THEN
    CREATE POLICY "clerk_update_appointments" ON public.appointments
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
    SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'clerk_delete_appointments'
  ) THEN
    CREATE POLICY "clerk_delete_appointments" ON public.appointments
      FOR DELETE USING (
        organization_id IN (
          SELECT p.organization_id FROM public.profiles p
          WHERE p.clerk_user_id = public.get_clerk_user_id()
        )
      );
  END IF;
END $$;
