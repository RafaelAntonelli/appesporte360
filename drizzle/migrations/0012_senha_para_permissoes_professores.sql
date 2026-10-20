CREATE TABLE public.desbloqueios_permissoes (
  user_id uuid PRIMARY KEY,
  valido_ate timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.desbloqueios_permissoes TO service_role;

ALTER TABLE public.desbloqueios_permissoes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.permissoes_desbloqueadas(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
    AND EXISTS (
      SELECT 1 FROM public.desbloqueios_permissoes d
      WHERE d.user_id = _user_id AND d.valido_ate > now()
    )
$$;

DROP POLICY IF EXISTS permissoes_admin_insert ON public.permissoes_professor;
DROP POLICY IF EXISTS permissoes_admin_update ON public.permissoes_professor;

CREATE POLICY permissoes_admin_insert ON public.permissoes_professor
  FOR INSERT TO authenticated
  WITH CHECK (public.permissoes_desbloqueadas(auth.uid()));

CREATE POLICY permissoes_admin_update ON public.permissoes_professor
  FOR UPDATE TO authenticated
  USING (public.permissoes_desbloqueadas(auth.uid()))
  WITH CHECK (public.permissoes_desbloqueadas(auth.uid()));