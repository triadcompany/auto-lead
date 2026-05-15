-- RPC to fetch org tasks with filters (bypasses RLS for Clerk users)
CREATE OR REPLACE FUNCTION public.get_org_tasks(
  p_status text DEFAULT NULL,
  p_prioridade text DEFAULT NULL,
  p_responsavel_id uuid DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
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
  completed_at timestamptz,
  notificado boolean,
  lead_name text,
  lead_phone text
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
    t.id,
    t.titulo,
    t.data_hora,
    t.descricao,
    t.prioridade::text,
    t.status::text,
    t.responsavel_id,
    t.lead_id,
    t.organization_id,
    t.conversation_id,
    t.created_at,
    t.updated_at,
    t.completed_at,
    t.notificado,
    l.name AS lead_name,
    l.phone AS lead_phone
  FROM tasks t
  LEFT JOIN leads l ON l.id = t.lead_id
  WHERE t.organization_id = v_org_id
    AND (p_status IS NULL OR t.status::text = p_status)
    AND (p_prioridade IS NULL OR t.prioridade::text = p_prioridade)
    AND (p_responsavel_id IS NULL OR t.responsavel_id = p_responsavel_id)
    AND (p_lead_id IS NULL OR t.lead_id = p_lead_id)
    AND (p_start_date IS NULL OR t.data_hora >= p_start_date)
    AND (p_end_date IS NULL OR t.data_hora <= p_end_date)
  ORDER BY t.data_hora ASC;
END;
$$;
