-- ── 1. Extend org_members.role to include pre_sales ──────────────────────────
ALTER TABLE public.org_members
  DROP CONSTRAINT IF EXISTS org_members_role_check;

ALTER TABLE public.org_members
  ADD CONSTRAINT org_members_role_check
  CHECK (role IN ('admin', 'seller', 'pre_sales'));

-- ── 2. conversation_transfers (audit log) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversation_transfers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  from_user_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_transfers_conversation_idx
  ON public.conversation_transfers(conversation_id);

ALTER TABLE public.conversation_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view transfers"
  ON public.conversation_transfers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.org_members om
        ON om.organization_id = c.organization_id
        AND om.clerk_user_id = get_clerk_user_id()
      WHERE c.id = conversation_id
    )
  );

-- ── 3. Add transfer_intro_message to whatsapp_routing_settings ────────────────
ALTER TABLE public.whatsapp_routing_settings
  ADD COLUMN IF NOT EXISTS transfer_intro_message text;

-- ── 4. Update get_org_profiles: add p_role filter + open_conversation_count ───
CREATE OR REPLACE FUNCTION public.get_org_profiles(
  p_org_id  uuid,
  p_role    text DEFAULT NULL
)
RETURNS TABLE (
  id                     uuid,
  name                   text,
  role                   text,
  open_conversation_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_org uuid;
BEGIN
  -- Verify caller belongs to the requested org
  SELECT om.organization_id INTO v_caller_org
  FROM org_members om
  JOIN profiles p ON p.clerk_user_id = om.clerk_user_id
  WHERE om.clerk_user_id = get_clerk_user_id()
    AND om.organization_id = p_org_id
  LIMIT 1;

  IF v_caller_org IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    pr.id,
    pr.name,
    om.role,
    COUNT(c.id) AS open_conversation_count
  FROM org_members om
  JOIN profiles pr ON pr.clerk_user_id = om.clerk_user_id
  LEFT JOIN conversations c
    ON c.assigned_to = pr.id
    AND c.organization_id = p_org_id
    AND c.status NOT IN ('closed')
  WHERE om.organization_id = p_org_id
    AND (p_role IS NULL OR om.role = p_role)
  GROUP BY pr.id, pr.name, om.role
  ORDER BY pr.name;
END;
$$;

-- ── 5. transfer_conversation RPC ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transfer_conversation(
  p_conversation_id uuid,
  p_to_user_id      uuid,
  p_note            text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_clerk  text;
  v_caller_profile profiles%ROWTYPE;
  v_org_id        uuid;
  v_conv          conversations%ROWTYPE;
  v_to_profile    profiles%ROWTYPE;
  v_to_role       text;
  v_lead_name     text;
  v_org_name      text;
  v_intro_msg     text;
  v_final_msg     text;
BEGIN
  v_caller_clerk := get_clerk_user_id();
  IF v_caller_clerk IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  -- Load caller profile
  SELECT * INTO v_caller_profile
  FROM profiles WHERE clerk_user_id = v_caller_clerk LIMIT 1;

  IF v_caller_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil não encontrado');
  END IF;

  v_org_id := v_caller_profile.organization_id;

  -- Load conversation (must belong to caller's org)
  SELECT * INTO v_conv
  FROM conversations
  WHERE id = p_conversation_id AND organization_id = v_org_id;

  IF v_conv.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conversa não encontrada');
  END IF;

  -- Load target profile
  SELECT * INTO v_to_profile FROM profiles WHERE id = p_to_user_id LIMIT 1;
  IF v_to_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vendedor não encontrado');
  END IF;

  -- Validate target is a seller or admin in the same org
  SELECT role INTO v_to_role
  FROM org_members
  WHERE org_id = v_org_id AND clerk_user_id = v_to_profile.clerk_user_id;

  IF v_to_role NOT IN ('seller', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário de destino não é vendedor');
  END IF;

  -- Update conversation assignment
  UPDATE conversations
  SET assigned_to = p_to_user_id,
      status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END
  WHERE id = p_conversation_id;

  -- Log the transfer
  INSERT INTO conversation_transfers (conversation_id, from_user_id, to_user_id, note)
  VALUES (p_conversation_id, v_caller_profile.id, p_to_user_id, NULLIF(TRIM(p_note), ''));

  -- Save note as internal conversation note (if provided)
  IF p_note IS NOT NULL AND TRIM(p_note) != '' THEN
    INSERT INTO conversation_notes (conversation_id, organization_id, author_id, content)
    VALUES (p_conversation_id, v_org_id, v_caller_profile.id, TRIM(p_note));
  END IF;

  -- Resolve intro message template
  SELECT transfer_intro_message INTO v_intro_msg
  FROM whatsapp_routing_settings
  WHERE organization_id = v_org_id
  LIMIT 1;

  IF v_intro_msg IS NULL OR TRIM(v_intro_msg) = '' THEN
    v_intro_msg := 'Olá {nome_lead}! Vou te conectar com {nome_vendedor}, nosso consultor especialista. Ele dará continuidade ao seu atendimento.';
  END IF;

  -- Resolve lead name (from leads table or fallback to phone)
  SELECT COALESCE(l.name, v_conv.contact_phone) INTO v_lead_name
  FROM leads l
  WHERE l.phone = v_conv.contact_phone AND l.organization_id = v_org_id
  LIMIT 1;

  IF v_lead_name IS NULL THEN
    v_lead_name := v_conv.contact_phone;
  END IF;

  -- Resolve org name
  SELECT name INTO v_org_name FROM organizations WHERE id = v_org_id LIMIT 1;

  -- Replace variables
  v_final_msg := v_intro_msg;
  v_final_msg := REPLACE(v_final_msg, '{nome_lead}',     COALESCE(v_lead_name, ''));
  v_final_msg := REPLACE(v_final_msg, '{nome_vendedor}', COALESCE(v_to_profile.name, ''));
  v_final_msg := REPLACE(v_final_msg, '{nome_empresa}',  COALESCE(v_org_name, ''));

  RETURN jsonb_build_object(
    'success',        true,
    'intro_message',  v_final_msg,
    'instance_name',  v_conv.instance_name,
    'contact_phone',  v_conv.contact_phone,
    'organization_id', v_org_id::text
  );
END;
$$;
