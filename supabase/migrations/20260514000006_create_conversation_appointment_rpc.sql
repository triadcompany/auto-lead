-- RPC to create an appointment linked to a conversation (bypasses RLS for Clerk users)
CREATE OR REPLACE FUNCTION public.create_conversation_appointment(
  p_conversation_id uuid,
  p_datetime timestamptz,
  p_tipo text,
  p_duration_minutes int DEFAULT NULL,
  p_anotacoes text DEFAULT NULL
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

  IF NOT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = p_conversation_id AND organization_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'Conversation not found or access denied';
  END IF;

  INSERT INTO appointments (
    datetime,
    tipo,
    duration_minutes,
    anotacoes,
    organization_id,
    conversation_id,
    criado_por
  ) VALUES (
    p_datetime,
    p_tipo,
    p_duration_minutes,
    p_anotacoes,
    v_org_id,
    p_conversation_id,
    v_profile_id::text
  );
END;
$$;
