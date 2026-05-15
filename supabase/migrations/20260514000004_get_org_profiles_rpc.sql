-- RPC to fetch org member profiles for Clerk users (bypasses RLS on profiles)
CREATE OR REPLACE FUNCTION public.get_org_profiles(
  p_org_id uuid
)
RETURNS TABLE (
  id uuid,
  name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clerk_id text;
  v_caller_org_id uuid;
BEGIN
  v_clerk_id := get_clerk_user_id();

  SELECT organization_id INTO v_caller_org_id
  FROM profiles
  WHERE clerk_user_id = v_clerk_id
  LIMIT 1;

  -- Only return members of the same org the caller belongs to
  IF v_caller_org_id IS NULL OR v_caller_org_id <> p_org_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.name
  FROM profiles p
  WHERE p.organization_id = p_org_id
  ORDER BY p.name;
END;
$$;
