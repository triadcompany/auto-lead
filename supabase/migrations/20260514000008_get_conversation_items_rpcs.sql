-- RPCs to fetch tasks and appointments linked to a conversation (bypass RLS for Clerk)

CREATE OR REPLACE FUNCTION public.get_conversation_tasks(
  p_conversation_id uuid
)
RETURNS TABLE (
  id uuid,
  titulo text,
  data_hora timestamptz,
  descricao text,
  prioridade text,
  status text,
  responsavel_id uuid,
  lead_id uuid,
  organization_id uuid,
  conversation_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  responsavel_name text
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
  FROM profiles p WHERE p.clerk_user_id = v_clerk_id LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    t.id, t.titulo, t.data_hora, t.descricao,
    t.prioridade::text, t.status::text,
    t.responsavel_id, t.lead_id, t.organization_id,
    t.conversation_id, t.created_at, t.updated_at,
    pr.name AS responsavel_name
  FROM tasks t
  LEFT JOIN profiles pr ON pr.id = t.responsavel_id
  WHERE t.conversation_id = p_conversation_id
    AND t.organization_id = v_org_id
  ORDER BY t.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_conversation_appointments(
  p_conversation_id uuid
)
RETURNS TABLE (
  id uuid,
  datetime timestamptz,
  tipo text,
  duration_minutes int,
  anotacoes text,
  organization_id uuid,
  conversation_id uuid,
  created_at timestamptz
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
  FROM profiles p WHERE p.clerk_user_id = v_clerk_id LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    a.id, a.datetime, a.tipo, a.duration_minutes, a.anotacoes,
    a.organization_id, a.conversation_id, a.created_at
  FROM appointments a
  WHERE a.conversation_id = p_conversation_id
    AND a.organization_id = v_org_id
  ORDER BY a.created_at ASC;
END;
$$;
