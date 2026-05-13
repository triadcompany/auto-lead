-- Fix set_pipeline_permissions: has_role() uses user_roles.user_id (Supabase auth UID)
-- which is never populated for Clerk users. Check admin via org_members instead.
CREATE OR REPLACE FUNCTION public.set_pipeline_permissions(
  p_pipeline_id uuid,
  p_profile_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_clerk_id text;
  v_caller_profile_id uuid;
  v_is_admin boolean;
  v_is_owner boolean;
  v_owner_profile_id uuid;
BEGIN
  SELECT pl.organization_id INTO v_org_id FROM pipelines pl WHERE pl.id = p_pipeline_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline not found';
  END IF;

  v_clerk_id := get_clerk_user_id();
  SELECT id INTO v_caller_profile_id FROM profiles WHERE clerk_user_id = v_clerk_id LIMIT 1;
  v_is_owner := public.is_org_owner(v_org_id);

  -- Check admin via org_members (works for Clerk users)
  v_is_admin := EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.clerk_user_id = v_clerk_id
      AND om.organization_id = v_org_id
      AND om.role = 'admin'
      AND om.status = 'active'
  );

  -- Fallback: check user_roles by clerk_user_id (legacy)
  IF NOT v_is_admin THEN
    v_is_admin := EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.clerk_user_id = v_clerk_id
        AND ur.organization_id = v_org_id
        AND ur.role = 'admin'
    );
  END IF;

  IF NOT (v_is_owner OR v_is_admin) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT owner_profile_id INTO v_owner_profile_id FROM organizations WHERE id = v_org_id;

  DELETE FROM pipeline_permissions
  WHERE pipeline_id = p_pipeline_id
    AND (v_owner_profile_id IS NULL OR profile_id <> v_owner_profile_id);

  IF p_profile_ids IS NOT NULL AND array_length(p_profile_ids, 1) > 0 THEN
    INSERT INTO pipeline_permissions (pipeline_id, profile_id, created_by)
    SELECT p_pipeline_id, pid, v_caller_profile_id
    FROM unnest(p_profile_ids) AS pid
    WHERE (v_owner_profile_id IS NULL OR pid <> v_owner_profile_id)
      AND EXISTS (SELECT 1 FROM profiles WHERE id = pid)
    ON CONFLICT (pipeline_id, profile_id) DO NOTHING;
  END IF;
END;
$$;
