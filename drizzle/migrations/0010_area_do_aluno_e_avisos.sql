CREATE TABLE public.aluno_aparelhos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  codigo_hash text,
  codigo_final text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','liberado','recusado','revogado')),
  pedido_em timestamptz NOT NULL DEFAULT now(),
  pedido_expira_em timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  liberado_em timestamptz,
  liberado_ate timestamptz,
  liberado_por uuid,
  liberado_por_nome text,
  sessao_ate timestamptz,
  login_salvo boolean NOT NULL DEFAULT false,
  consentimento_em timestamptz,
  ultimo_acesso timestamptz,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX aluno_aparelhos_aluno_idx ON public.aluno_aparelhos (aluno_id);
CREATE INDEX aluno_aparelhos_codigo_idx ON public.aluno_aparelhos (codigo_hash) WHERE codigo_hash IS NOT NULL;
GRANT SELECT ON public.aluno_aparelhos TO authenticated;
GRANT ALL ON public.aluno_aparelhos TO service_role;
ALTER TABLE public.aluno_aparelhos ENABLE ROW LEVEL SECURITY;
CREATE POLICY aluno_aparelhos_admin_select ON public.aluno_aparelhos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.aluno_tentativas_acesso (
  id bigserial PRIMARY KEY,
  rede_hash text NOT NULL,
  aparelho_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX aluno_tentativas_rede_idx ON public.aluno_tentativas_acesso (rede_hash, created_at);
CREATE INDEX aluno_tentativas_aparelho_idx ON public.aluno_tentativas_acesso (aparelho_hash, created_at);
GRANT ALL ON public.aluno_tentativas_acesso TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.aluno_tentativas_acesso_id_seq TO service_role;
ALTER TABLE public.aluno_tentativas_acesso ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 100),
  mensagem text NOT NULL CHECK (char_length(btrim(mensagem)) BETWEEN 1 AND 1000),
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE CASCADE,
  enviado_por uuid,
  enviado_por_nome text,
  notificados integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX avisos_aluno_idx ON public.avisos (aluno_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.avisos TO authenticated;
GRANT ALL ON public.avisos TO service_role;
ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;
CREATE POLICY avisos_admin_select ON public.avisos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY avisos_admin_insert ON public.avisos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY avisos_admin_update ON public.avisos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.avisos_leituras (
  aviso_id uuid NOT NULL REFERENCES public.avisos(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  lido_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (aviso_id, aluno_id)
);
GRANT SELECT ON public.avisos_leituras TO authenticated;
GRANT ALL ON public.avisos_leituras TO service_role;
ALTER TABLE public.avisos_leituras ENABLE ROW LEVEL SECURITY;
CREATE POLICY avisos_leituras_admin_select ON public.avisos_leituras FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.aluno_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aparelho_id uuid NOT NULL REFERENCES public.aluno_aparelhos(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX aluno_push_tokens_aluno_idx ON public.aluno_push_tokens (aluno_id);
GRANT ALL ON public.aluno_push_tokens TO service_role;
ALTER TABLE public.aluno_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.localizar_aluno_acesso(_identificador text, _nascimento date)
RETURNS TABLE(id uuid, ativo boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.ativo
  FROM public.alunos a
  WHERE a.data_nascimento = _nascimento
    AND (
      (length(regexp_replace(_identificador, '\D', '', 'g')) = 11
        AND regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g') = regexp_replace(_identificador, '\D', '', 'g'))
      OR upper(a.codigo) = upper(regexp_replace(_identificador, '[^A-Za-z0-9]', '', 'g'))
    )
$$;
REVOKE ALL ON FUNCTION public.localizar_aluno_acesso(text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.localizar_aluno_acesso(text, date) TO service_role;

CREATE OR REPLACE FUNCTION public.buscar_pedido_aparelho(_codigo text)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem liberar aparelhos.';
  END IF;
  SELECT p.id INTO _id FROM public.aluno_aparelhos p
  WHERE p.codigo_hash = encode(sha256(convert_to(upper(regexp_replace(coalesce(_codigo, ''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex')
    AND p.status = 'pendente' AND p.pedido_expira_em > now()
  LIMIT 1;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.buscar_pedido_aparelho(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_pedido_aparelho(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.liberar_aparelho_aluno(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem liberar aparelhos.';
  END IF;
  UPDATE public.aluno_aparelhos p
  SET status = 'liberado', liberado_em = now(), liberado_ate = now() + interval '180 days',
      liberado_por = auth.uid(), liberado_por_nome = public.nome_usuario(auth.uid()),
      sessao_ate = now() + interval '12 hours', codigo_hash = NULL
  WHERE p.id = _id AND p.status = 'pendente' AND p.pedido_expira_em > now()
    AND EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = p.aluno_id AND a.ativo);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido expirado, já respondido ou aluno inativo.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.liberar_aparelho_aluno(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.liberar_aparelho_aluno(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.recusar_aparelho_aluno(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem recusar aparelhos.';
  END IF;
  UPDATE public.aluno_aparelhos SET status = 'recusado', codigo_hash = NULL, sessao_ate = NULL
  WHERE id = _id AND status = 'pendente';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado ou já respondido.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.recusar_aparelho_aluno(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recusar_aparelho_aluno(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.revogar_aparelho_aluno(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem revogar aparelhos.';
  END IF;
  UPDATE public.aluno_aparelhos SET status = 'revogado', sessao_ate = NULL, login_salvo = false
  WHERE id = _id AND status = 'liberado';
  IF NOT FOUND THEN RAISE EXCEPTION 'Aparelho não encontrado ou já revogado.'; END IF;
  DELETE FROM public.aluno_push_tokens WHERE aparelho_id = _id;
END $$;
REVOKE ALL ON FUNCTION public.revogar_aparelho_aluno(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revogar_aparelho_aluno(uuid) TO authenticated, service_role;