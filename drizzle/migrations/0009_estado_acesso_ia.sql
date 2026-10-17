CREATE TABLE public.ia_acesso (id boolean PRIMARY KEY DEFAULT true CHECK (id), bloqueado boolean NOT NULL DEFAULT false, motivo text, atualizado_em timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.ia_acesso TO authenticated;
GRANT ALL ON public.ia_acesso TO service_role;
ALTER TABLE public.ia_acesso ENABLE ROW LEVEL SECURITY;
CREATE POLICY ia_acesso_leitura ON public.ia_acesso FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professor'));
CREATE POLICY ia_acesso_admin_insert ON public.ia_acesso FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY ia_acesso_admin_update ON public.ia_acesso FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));