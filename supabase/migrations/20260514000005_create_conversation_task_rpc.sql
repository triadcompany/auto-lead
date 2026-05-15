-- RPC to create a task linked to a conversation (bypasses RLS for Clerk users)
CREATE OR REPLACE FUNCTION public.create_conversation_task(
  p_conversation_id uuid,
  p_titulo text,
  p_data_hora timestamptz,
  p_descricao text DEFAULT NULL,
  p_prioridade text DEFAULT NULL,
  p_responsavel_id uuid DEFAULT NULL
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
  v_responsavel uuid;
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

  -- Default responsavel to caller if not provided
  v_responsavel := COALESCE(p_responsavel_id, v_profile_id);

  INSERT INTO tasks (
    titulo,
    data_hora,
    descricao,
    prioridade,
    responsavel_id,
    organization_id,
    conversation_id,
    status
  ) VALUES (
    p_titulo,
    p_data_hora,
    p_descricao,
    p_prioridade::task_priority,
    v_responsavel,
    v_org_id,
    p_conversation_id,
    'pendente'
  );
END;
$$;
