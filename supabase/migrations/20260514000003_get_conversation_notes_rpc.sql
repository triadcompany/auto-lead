-- RPC to fetch conversation notes for Clerk users (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_conversation_notes(
  p_conversation_id uuid
)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  organization_id uuid,
  content text,
  created_by uuid,
  created_at timestamptz,
  author_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clerk_id text;
  v_org_id uuid;
BEGIN
  v_clerk_id := get_clerk_user_id();

  SELECT p.organization_id INTO v_org_id
  FROM profiles p
  WHERE p.clerk_user_id = v_clerk_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    cn.id,
    cn.conversation_id,
    cn.organization_id,
    cn.content,
    cn.created_by,
    cn.created_at,
    pr.name AS author_name
  FROM conversation_notes cn
  LEFT JOIN profiles pr ON pr.id = cn.created_by
  WHERE cn.conversation_id = p_conversation_id
    AND cn.organization_id = v_org_id
  ORDER BY cn.created_at ASC;
END;
$$;
