-- Fix conversation_notes RLS: auth.uid() is always null for Clerk users.
-- Replace the policy with one that uses get_clerk_user_id() via org_members,
-- and add a SECURITY DEFINER RPC for inserts.

DROP POLICY IF EXISTS "org_members_can_manage_notes" ON public.conversation_notes;

-- SELECT: check org membership via clerk_user_id
CREATE POLICY "org_members_can_read_notes"
  ON public.conversation_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.clerk_user_id = public.get_clerk_user_id()
        AND om.organization_id = conversation_notes.organization_id
        AND om.status = 'active'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.clerk_user_id = public.get_clerk_user_id()
        AND p.organization_id = conversation_notes.organization_id
    )
  );

-- INSERT via SECURITY DEFINER RPC (bypasses RLS for Clerk users)
CREATE OR REPLACE FUNCTION public.create_conversation_note(
  p_conversation_id uuid,
  p_content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clerk_id text;
  v_profile_id uuid;
  v_org_id uuid;
BEGIN
  v_clerk_id := get_clerk_user_id();

  SELECT id, organization_id
    INTO v_profile_id, v_org_id
  FROM profiles
  WHERE clerk_user_id = v_clerk_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Verify conversation belongs to the same org
  IF NOT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = p_conversation_id
      AND organization_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'Conversation not found or access denied';
  END IF;

  INSERT INTO conversation_notes (conversation_id, organization_id, content, created_by)
  VALUES (p_conversation_id, v_org_id, p_content, v_profile_id);
END;
$$;
